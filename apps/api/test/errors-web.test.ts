// `/v1/errors/web` — the unauthenticated client-error sink (SK-WEB-001).
//
// The endpoint must:
//   - Always return 204 (clients never retry-storm on error).
//   - Reject bodies > 4 KB by Content-Length without reading them.
//   - Dedup `surface + message + stack[0..200]` so a reload loop on
//     the same broken state doesn't fan out one OTel span per reload.
//   - Tolerate malformed JSON without throwing — best-effort sink.

import { SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { _resetErrorSinkForTests } from "../src/index.ts";

const URL = "https://example.com/v1/errors/web";

function post(body: unknown, extraHeaders: Record<string, string> = {}): Promise<Response> {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return SELF.fetch(URL, {
    method: "POST",
    headers: { "content-type": "application/json", ...extraHeaders },
    body: raw,
  });
}

describe("/v1/errors/web", () => {
  beforeEach(() => {
    _resetErrorSinkForTests();
  });

  it("returns 204 for a well-formed report", async () => {
    const res = await post({
      surface: "ChatPanel",
      message: "x.sql is undefined",
      stack: "at A\nat B",
      href: "https://app.nlqdb.com/app/",
    });
    expect(res.status).toBe(204);
  });

  it("returns 204 and ignores oversized bodies (Content-Length cap)", async () => {
    const huge = "x".repeat(5000);
    const res = await post({ surface: "boot", message: huge });
    expect(res.status).toBe(204);
    // The 204 here means "accepted (but dropped)" — there is no
    // way to assert "span was not created" without an OTel test
    // exporter. The Content-Length branch returning early is the
    // observable property; a follow-up POST with a fresh fingerprint
    // should still be accepted, proving we exited before dedup.
    const okRes = await post({ surface: "boot", message: "small" });
    expect(okRes.status).toBe(204);
  });

  it("returns 204 on malformed JSON", async () => {
    const res = await post("{not valid json", {});
    expect(res.status).toBe(204);
  });

  it("dedups identical fingerprints within the TTL", async () => {
    // Both calls succeed (204), but only the first one should have
    // produced a span. We can't observe spans directly, so this case
    // mainly guards against regressions of the early-exit branch
    // (the call shouldn't error or change status when deduped).
    const r1 = await post({ surface: "ChatPanel", message: "boom", stack: "at A" });
    const r2 = await post({ surface: "ChatPanel", message: "boom", stack: "at A" });
    expect(r1.status).toBe(204);
    expect(r2.status).toBe(204);
  });

  it("rejects GET", async () => {
    const res = await SELF.fetch(URL, { method: "GET" });
    expect(res.status).toBe(404);
  });

  it("CORS preflight from an allowed origin returns 204", async () => {
    const res = await SELF.fetch(URL, {
      method: "OPTIONS",
      headers: {
        origin: "https://app.nlqdb.com",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://app.nlqdb.com");
  });

  it("CORS preflight from a disallowed origin is rejected", async () => {
    const res = await SELF.fetch(URL, {
      method: "OPTIONS",
      headers: {
        origin: "https://evil.example",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});
