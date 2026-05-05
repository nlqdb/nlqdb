// End-to-end magic-link lifecycle (Slice 10):
//   POST /api/auth/sign-in/magic-link → email "sent"
//   click verify URL → session cookie set
//   GET /api/auth/get-session → returns the new user
//
// `RESEND_API_KEY` is unset under Miniflare (vitest.config.ts), so the
// email sender falls through to the console-logging dev stub. We spy
// on console.info to extract the verify URL from the rendered email
// body — the same URL the recipient would click.
//
// vi.mock of worker-internal modules is broken under
// @cloudflare/vitest-pool-workers (cloudflare/workers-sdk#10201), so
// we drive the real Better Auth instance via SELF.fetch and read the
// stub-emitted URL out-of-band.

import { SELF } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGIN = "https://example.com";

function extractMagicLinkUrl(logs: string[]): string {
  // Dev-stub log format (src/email.ts):
  //   [email:dev-stub] to=… subject=… body=<text containing the URL>
  // Email links go through `/auth/continue?next=<encoded verify URL>`
  // (prefetch protection — docs/architecture.md §4.3); decode `next` to get the
  // actual verify URL the user would land on after clicking through.
  const joined = logs.join("\n");
  const wrapped = joined.match(/https?:\/\/[^\s"]+\/auth\/continue\?next=([^\s"]+)/);
  if (wrapped?.[1]) return decodeURIComponent(wrapped[1]);
  throw new Error(`no magic-link continue URL found in console output:\n${joined}`);
}

describe("magic-link lifecycle", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let logs: string[];

  beforeEach(() => {
    logs = [];
    logSpy = vi.spyOn(console, "info").mockImplementation((...args: unknown[]) => {
      logs.push(args.map((a) => String(a)).join(" "));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("send → verify → get-session returns the freshly-signed-in user", async () => {
    const email = `t-${crypto.randomUUID()}@example.com`;

    const sendRes = await SELF.fetch(`${ORIGIN}/api/auth/sign-in/magic-link`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify({ email, callbackURL: `${ORIGIN}/app` }),
    });
    expect(sendRes.status).toBe(200);

    const verifyUrl = extractMagicLinkUrl(logs);

    // Better Auth's verify endpoint sets the session cookie via
    // Set-Cookie and 302-redirects to the callbackURL on success.
    // `redirect: "manual"` keeps the cookie addressable on this
    // response; following the redirect would land on a 404 in the
    // test worker.
    const verifyRes = await SELF.fetch(verifyUrl, { redirect: "manual" });
    expect([200, 302]).toContain(verifyRes.status);
    const setCookie = verifyRes.headers.get("set-cookie");
    if (!setCookie) throw new Error("expected set-cookie header on verify response");
    expect(setCookie).toMatch(/session/i);

    const cookieFirst = setCookie.split(";")[0];
    if (!cookieFirst) throw new Error("expected cookie value before first `;`");
    const sessionRes = await SELF.fetch(`${ORIGIN}/api/auth/get-session`, {
      headers: { cookie: cookieFirst },
    });
    expect(sessionRes.status).toBe(200);
    const sessionBody = (await sessionRes.json()) as {
      user?: { email?: string };
    } | null;
    expect(sessionBody?.user?.email).toBe(email);
  });

  it("per-IP customRules: 6th /sign-in/magic-link in 60s from one IP is rate-limited", async () => {
    // Better Auth's `customRules` key is the path it dispatches under
    // internally. If the key doesn't match (e.g. it's actually
    // `/magic-link` rather than `/sign-in/magic-link`), the global
    // 100/min default applies and there's no per-IP gate distinct from
    // the rest of `/api/auth/*`. This test pins the actual behavior:
    // 5 successful sends from one X-Forwarded-For, then the 6th gets
    // a 4xx (Better Auth returns 429 for rate-limit; we assert >=400
    // so a non-429 4xx from a future BA bump still flags here).
    //
    // Distinct emails per send so the per-email throttle (3/10min)
    // doesn't fire first — we want to isolate the per-IP path.
    const ip = "203.0.113.42";
    const headers = {
      "content-type": "application/json",
      "x-forwarded-for": ip,
      origin: ORIGIN,
    };
    for (let i = 0; i < 5; i++) {
      const res = await SELF.fetch(`${ORIGIN}/api/auth/sign-in/magic-link`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: `t-ip-${i}-${crypto.randomUUID()}@example.com`,
          callbackURL: `${ORIGIN}/app`,
        }),
      });
      expect(res.status).toBe(200);
    }
    const blocked = await SELF.fetch(`${ORIGIN}/api/auth/sign-in/magic-link`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        email: `t-ip-blocked-${crypto.randomUUID()}@example.com`,
        callbackURL: `${ORIGIN}/app`,
      }),
    });
    expect(blocked.status).toBeGreaterThanOrEqual(400);
    expect(blocked.status).toBeLessThan(500);
  });

  it("a previously-redeemed token cannot mint a second session (single-use)", async () => {
    const email = `t-${crypto.randomUUID()}@example.com`;
    await SELF.fetch(`${ORIGIN}/api/auth/sign-in/magic-link`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify({ email, callbackURL: `${ORIGIN}/app` }),
    });
    const verifyUrl = extractMagicLinkUrl(logs);

    const first = await SELF.fetch(verifyUrl, { redirect: "manual" });
    expect([200, 302]).toContain(first.status);
    expect(first.headers.get("set-cookie")).toBeTruthy();

    // Second attempt: Better Auth's response shape varies (4xx body
    // vs. 302→/error?error=…), but in every healthy variant the
    // response does NOT carry a Set-Cookie that would mint a new
    // session. That's the invariant we lock down here — the cookie
    // is the user-visible side-effect of redemption.
    const second = await SELF.fetch(verifyUrl, { redirect: "manual" });
    const replayCookie = second.headers.get("set-cookie") ?? "";
    expect(replayCookie.toLowerCase()).not.toMatch(/session_token=/);
  });

  it("sign-out: POST with content-type:application/json + body `{}` returns 200", async () => {
    // Pins the shape that `apps/web/src/lib/session.ts#signOut` sends.
    // Background: in production we observed 500s on POST /api/auth/sign-out
    // with `error: SyntaxError: Unexpected end of JSON input`. Root cause
    // is in better-call v1.3.5's `getBody`: if the request advertises
    // `content-type: application/json`, it calls `request.json()`
    // unconditionally. On Workers, `request.body` is a non-null
    // ReadableStream even when zero bytes were written, so the
    // upstream `if (!request.body) return undefined` early-return never
    // fires — and `JSON.parse("")` throws. The fix is on the client:
    // send `body: "{}"` instead of no body. This test would have caught
    // the regression had it existed.
    const email = `t-${crypto.randomUUID()}@example.com`;
    await SELF.fetch(`${ORIGIN}/api/auth/sign-in/magic-link`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify({ email, callbackURL: `${ORIGIN}/app` }),
    });
    const verifyUrl = extractMagicLinkUrl(logs);
    const verifyRes = await SELF.fetch(verifyUrl, { redirect: "manual" });
    const setCookie = verifyRes.headers.get("set-cookie");
    if (!setCookie) throw new Error("expected set-cookie on verify response");
    const cookieFirst = setCookie.split(";")[0];
    if (!cookieFirst) throw new Error("expected cookie value before first `;`");

    const signOutRes = await SELF.fetch(`${ORIGIN}/api/auth/sign-out`, {
      method: "POST",
      headers: {
        cookie: cookieFirst,
        origin: ORIGIN,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: "{}",
    });
    expect(signOutRes.status).toBe(200);
    const signOutBody = (await signOutRes.json()) as { success?: boolean };
    expect(signOutBody.success).toBe(true);
  });
});
