// An auth 5xx must still say who it hit when D1 is down (2026-11-18): the
// email comes from the sign-in body or a verify token remembered in KV, logs
// carry only fingerprints, and the event + R&D alert both fire.

import type { EventEmitter, ProductEvent } from "@nlqdb/events";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_FAILED_DAILY_CAP,
  authRequestEmail,
  credentialFingerprint,
  rememberMagicLinkRecipient,
  reportAuthServerError,
} from "../src/auth/failure-report.ts";

function fakeKv() {
  const store = new Map<string, string>();
  const kv = {
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    put: vi.fn(async (k: string, v: string, _opts?: KVNamespacePutOptions) => {
      store.set(k, v);
    }),
  };
  return { kv: kv as unknown as KVNamespace, store, raw: kv };
}

const VERIFY = "https://app.nlqdb.com/api/auth/magic-link/verify";

afterEach(() => vi.restoreAllMocks());

describe("magic-link recipient", () => {
  it("names the owner of a verify token remembered at send time", async () => {
    const { kv, raw } = fakeKv();
    await rememberMagicLinkRecipient(kv, `${VERIFY}?token=tok_1&callbackURL=%2F`, " A@B.co ", 600);
    expect(raw.put.mock.calls[0]?.[2]).toEqual({ expirationTtl: 600 });
    // The KV key is a hash, never the token itself.
    expect([...raw.put.mock.calls.map((c) => c[0])].join()).not.toContain("tok_1");
    expect(await authRequestEmail(kv, new URL(`${VERIFY}?token=tok_1`), null)).toBe("a@b.co");
    expect(await authRequestEmail(kv, new URL(`${VERIFY}?token=other`), null)).toBeNull();
  });

  it("reads the email from the sign-in body, and nothing from other paths", async () => {
    const { kv } = fakeKv();
    const send = new URL("https://app.nlqdb.com/api/auth/sign-in/magic-link");
    expect(await authRequestEmail(kv, send, '{"email":"X@Y.io"}')).toBe("x@y.io");
    expect(await authRequestEmail(kv, send, "not json")).toBeNull();
    // Unauthenticated input bound for LogSnag: only address-shaped strings pass.
    expect(await authRequestEmail(kv, send, '{"email":"no at sign"}')).toBeNull();
    expect(await authRequestEmail(kv, send, `{"email":"${"a".repeat(250)}@b.co"}`)).toBeNull();
    const cb = new URL("https://app.nlqdb.com/api/auth/callback/github?code=c");
    expect(await authRequestEmail(kv, cb, null)).toBeNull();
  });
});

describe("credentialFingerprint", () => {
  const req = (headers: Record<string, string>) =>
    new Request("https://x/v1/databases", { headers });

  it("keeps an API key's type and last 4 only", async () => {
    const fp = await credentialFingerprint(req({ authorization: "Bearer sk_live_abcdefgh1234" }));
    expect(fp).toBe("key:sk_live…1234");
  });

  it("hashes the session token in prod and dev cookie names", async () => {
    const prod = await credentialFingerprint(
      req({ cookie: "a=1; __Secure-__Secure.session_token=tok.sig" }),
    );
    const dev = await credentialFingerprint(req({ cookie: "better-auth.session_token=tok.sig" }));
    expect(prod).toMatch(/^session:[0-9a-f]{16}$/);
    expect(dev).toBe(prod); // same token, the signature is not part of it
    expect(prod).not.toContain("tok");
  });

  it("says none without a credential, anon for an anon bearer", async () => {
    expect(await credentialFingerprint(req({}))).toBe("none");
    expect(await credentialFingerprint(req({ authorization: "Bearer anon_xyz" }))).toBe("anon");
  });

  it("hashes a bearer that is not an API key instead of printing its tail", async () => {
    const fp = await credentialFingerprint(req({ authorization: "Bearer opaque-session-WXYZ" }));
    expect(fp).toMatch(/^bearer:[0-9a-f]{16}$/);
    expect(fp).not.toContain("WXYZ");
  });
});

describe("reportAuthServerError", () => {
  it("logs a fingerprint, alerts R&D and emits user.auth_failed with the email", async () => {
    const { kv, raw } = fakeKv();
    await rememberMagicLinkRecipient(kv, `${VERIFY}?token=tok_9`, "who@ex.am", 600);
    const emitted: ProductEvent[] = [];
    const events: EventEmitter = { emit: async (e) => void emitted.push(e) };
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await reportAuthServerError({
      env: { MOCK_IDP: "1", KV: kv },
      events,
      req: new Request(`${VERIFY}?token=tok_9`, { headers: { "cf-ray": "ray1" } }),
      body: null,
      status: 500,
      utcDay: "2026-11-18",
    });

    expect(emitted).toEqual([
      expect.objectContaining({
        name: "user.auth_failed",
        email: "who@ex.am",
        path: "/api/auth/magic-link/verify",
        status: 500,
      }),
    ]);
    const line = String(log.mock.calls[0]?.[0]);
    expect(line).toContain('"msg":"auth_server_error"');
    expect(line).toContain('"cfRay":"ray1"');
    expect(line).not.toContain("who@ex.am"); // logs stay PII-free
    // The alert reached the (MOCK_IDP) R&D mail sink.
    expect(raw.put.mock.calls.some((c) => String(c[0]).startsWith("mock-email:"))).toBe(true);
  });

  it("alerts without an event when no email is recoverable", async () => {
    const { kv } = fakeKv();
    const emit = vi.fn(async () => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await reportAuthServerError({
      env: { MOCK_IDP: "1", KV: kv },
      events: { emit },
      req: new Request("https://app.nlqdb.com/api/auth/callback/github?code=c"),
      body: null,
      status: 502,
      utcDay: "2026-11-18",
    });
    expect(emit).not.toHaveBeenCalled();
  });

  it("only emits the event when the handler threw (app.onError logs and alerts)", async () => {
    const { kv, raw } = fakeKv();
    const emitted: ProductEvent[] = [];
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await reportAuthServerError({
      env: { MOCK_IDP: "1", KV: kv },
      events: { emit: async (e) => void emitted.push(e) },
      req: new Request("https://app.nlqdb.com/api/auth/sign-in/magic-link", { method: "POST" }),
      body: '{"email":"t@h.rown"}',
      status: 500,
      utcDay: "2026-11-18",
      thrown: true,
    });
    expect(emitted).toEqual([
      expect.objectContaining({ name: "user.auth_failed", email: "t@h.rown" }),
    ]);
    expect(log).not.toHaveBeenCalled();
    expect(raw.put.mock.calls.some((c) => String(c[0]).startsWith("mock-email:"))).toBe(false);
  });

  it("caps user.auth_failed per UTC day, so invented emails can't page LogSnag", async () => {
    const { kv } = fakeKv();
    const emit = vi.fn(async () => undefined);
    const send = (i: number, utcDay: string) =>
      reportAuthServerError({
        env: { MOCK_IDP: "1", KV: kv },
        events: { emit },
        req: new Request("https://app.nlqdb.com/api/auth/sign-in/magic-link", { method: "POST" }),
        body: `{"email":"u${i}@spam.io"}`,
        status: 500,
        utcDay,
        thrown: true,
      });
    for (let i = 0; i < AUTH_FAILED_DAILY_CAP + 5; i++) await send(i, "2026-11-18");
    expect(emit).toHaveBeenCalledTimes(AUTH_FAILED_DAILY_CAP);
    await send(0, "2026-11-19"); // a new UTC day starts a new count
    expect(emit).toHaveBeenCalledTimes(AUTH_FAILED_DAILY_CAP + 1);
  });

  it("counts distinct emails, so one person retrying can't use up the cap", async () => {
    const { kv } = fakeKv();
    const emit = vi.fn(async () => undefined);
    const send = (email: string) =>
      reportAuthServerError({
        env: { MOCK_IDP: "1", KV: kv },
        events: { emit },
        req: new Request("https://app.nlqdb.com/api/auth/sign-in/magic-link", { method: "POST" }),
        body: JSON.stringify({ email }),
        status: 500,
        utcDay: "2026-11-18",
        thrown: true,
      });
    for (let i = 0; i < AUTH_FAILED_DAILY_CAP + 5; i++) await send("retry@ex.am");
    await send("other@ex.am");
    expect(emit.mock.calls.map((c) => (c as unknown[])[0])).toEqual([
      expect.objectContaining({ email: "retry@ex.am" }),
      expect.objectContaining({ email: "other@ex.am" }),
    ]);
  });
});
