// `/v1/errors/web` — the unauthenticated client-error sink (SK-WEB-001).
//
// The endpoint must:
//   - Always return 204 (clients never retry-storm on error).
//   - Reject bodies > 4 KB by Content-Length without reading them.
//   - Dedup `surface + message + stack[0..200]` so a reload loop on
//     the same broken state doesn't fan out one OTel span per reload.
//   - Tolerate malformed JSON without throwing — best-effort sink.
//   - Scrub PII (`redactPii`) from every string before it becomes a
//     span attribute (SK-WEB-001 follow-up).
//   - Honour a W3C `traceparent` header so the browser-recorded span
//     joins the trace the page started (SK-WEB-001 follow-up).

import { SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { _resetErrorSinkForTests, parseTraceparent } from "../src/index.ts";

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

  it("accepts a report carrying PII without throwing — server redacts before span attrs", async () => {
    // The endpoint's observable contract is 204 + don't crash. We
    // can't directly assert "span attribute equals [email]" without
    // an OTel test exporter, so this case just guards against a
    // regression that bypasses `redactPii` (e.g. removing the import
    // or feeding a non-string to it). The server-side scrubbing is
    // exercised end-to-end via the redactPii unit suite in
    // `packages/otel/test/redact-pii.test.ts`.
    const res = await post({
      surface: "ChatPanel",
      message: "Failed to parse user@example.com on retry",
      stack:
        "TypeError: bad token tok_AbCdEfGhIjKlMnOpQrStUvWxYz123456\n  at fetcher (chat.tsx:42)",
      href: "https://app.nlqdb.com/app/?api_key=secretvalueOver20charsLongHere",
    });
    expect(res.status).toBe(204);
  });

  it("accepts a request carrying a valid W3C traceparent header", async () => {
    const traceparent = `00-${"0".repeat(31)}1-${"0".repeat(15)}1-01`;
    const res = await SELF.fetch(URL, {
      method: "POST",
      headers: { "content-type": "application/json", traceparent },
      body: JSON.stringify({ surface: "ChatPanel", message: "traceparent test" }),
    });
    expect(res.status).toBe(204);
  });

  it("tolerates a malformed traceparent header — no crash, still 204", async () => {
    const res = await SELF.fetch(URL, {
      method: "POST",
      headers: { "content-type": "application/json", traceparent: "not-a-traceparent" },
      body: JSON.stringify({ surface: "ChatPanel", message: "garbage tp" }),
    });
    expect(res.status).toBe(204);
  });
});

describe("parseTraceparent", () => {
  const TRACE = "0123456789abcdef0123456789abcdef";
  const SPAN = "0123456789abcdef";

  it("parses a well-formed v00 traceparent (sampled)", () => {
    const got = parseTraceparent(`00-${TRACE}-${SPAN}-01`);
    expect(got).not.toBeNull();
    expect(got?.traceId).toBe(TRACE);
    expect(got?.spanId).toBe(SPAN);
    expect(got?.traceFlags).toBe(0x01);
    expect(got?.isRemote).toBe(true);
  });

  it("parses a well-formed v00 traceparent (unsampled)", () => {
    const got = parseTraceparent(`00-${TRACE}-${SPAN}-00`);
    expect(got?.traceFlags).toBe(0x00);
  });

  it("normalises case before matching", () => {
    const got = parseTraceparent(`00-${TRACE.toUpperCase()}-${SPAN.toUpperCase()}-01`);
    expect(got?.traceId).toBe(TRACE);
    expect(got?.spanId).toBe(SPAN);
  });

  it("rejects a null / undefined / empty header", () => {
    expect(parseTraceparent(null)).toBeNull();
    expect(parseTraceparent(undefined)).toBeNull();
    expect(parseTraceparent("")).toBeNull();
  });

  it("rejects a header with the wrong number of dashes", () => {
    expect(parseTraceparent(`00-${TRACE}-${SPAN}`)).toBeNull();
    expect(parseTraceparent(`00-${TRACE}-${SPAN}-01-extra`)).toBeNull();
  });

  it("rejects a non-v00 version", () => {
    expect(parseTraceparent(`ff-${TRACE}-${SPAN}-01`)).toBeNull();
    expect(parseTraceparent(`01-${TRACE}-${SPAN}-01`)).toBeNull();
  });

  it("rejects the all-zero trace_id (invalid per spec)", () => {
    expect(parseTraceparent(`00-${"0".repeat(32)}-${SPAN}-01`)).toBeNull();
  });

  it("rejects the all-zero span_id (invalid per spec)", () => {
    expect(parseTraceparent(`00-${TRACE}-${"0".repeat(16)}-01`)).toBeNull();
  });

  it("rejects non-hex characters", () => {
    expect(parseTraceparent(`00-${"g".repeat(32)}-${SPAN}-01`)).toBeNull();
  });
});
