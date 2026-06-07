// parseJsonResponse contract: strict JSON first, ```-fence tolerance,
// and the SK-LLM-025 reasoning-preamble recovery fallback.

import { describe, expect, it } from "vitest";
import { httpError, parseJsonResponse, parseRetryAfter } from "../../src/providers/_shared.ts";

describe("parseJsonResponse", () => {
  it("parses clean JSON", () => {
    expect(parseJsonResponse<{ sql: string }>('{"sql":"SELECT 1"}').sql).toBe("SELECT 1");
  });

  it("strips ```json fences", () => {
    expect(parseJsonResponse<{ sql: string }>('```json\n{"sql":"SELECT 2"}\n```').sql).toBe(
      "SELECT 2",
    );
  });

  describe("SK-LLM-025 — recovers the JSON object from reasoning-model preamble leaks", () => {
    it("strips a leading think-text preamble", () => {
      const raw = 'We need to count rows. The answer is:\n{"sql":"SELECT count(*) FROM t"}';
      expect(parseJsonResponse<{ sql: string }>(raw).sql).toBe("SELECT count(*) FROM t");
    });

    it("strips trailing prose after the object", () => {
      expect(parseJsonResponse<{ sql: string }>('{"sql":"SELECT 3"}\nHope this helps!').sql).toBe(
        "SELECT 3",
      );
    });

    it("keeps braces inside string literals balanced", () => {
      const raw = 'reasoning... {"sql":"SELECT \'{\' AS brace"} done';
      expect(parseJsonResponse<{ sql: string }>(raw).sql).toBe("SELECT '{' AS brace");
    });

    it("still throws a parse error when no JSON object is present", () => {
      expect(() => parseJsonResponse("I cannot answer that.")).toThrow(/not parseable JSON/);
    });

    it("throws (rather than recovering) when the brace never closes", () => {
      expect(() => parseJsonResponse('thinking... {"sql":"SELECT 1"')).toThrow(
        /not parseable JSON/,
      );
    });
  });
});

describe("SK-LLM-030 — parseRetryAfter", () => {
  it("parses the delta-seconds form", () => {
    expect(parseRetryAfter(new Headers({ "retry-after": "30" }))).toBe(30_000);
  });

  it("parses the HTTP-date form into a forward delta", () => {
    const when = new Date(Date.now() + 45_000).toUTCString();
    const ms = parseRetryAfter(new Headers({ "retry-after": when }));
    // Allow a small clock-skew window between the two Date.now() reads.
    expect(ms).toBeGreaterThan(40_000);
    expect(ms).toBeLessThanOrEqual(45_000);
  });

  it("clamps a past HTTP-date to 0 rather than going negative", () => {
    const past = new Date(Date.now() - 10_000).toUTCString();
    expect(parseRetryAfter(new Headers({ "retry-after": past }))).toBe(0);
  });

  it("returns undefined when the header is absent", () => {
    expect(parseRetryAfter(new Headers())).toBeUndefined();
  });

  it("returns undefined on an unparseable value", () => {
    expect(parseRetryAfter(new Headers({ "retry-after": "soon" }))).toBeUndefined();
  });
});

describe("SK-LLM-030 — httpError", () => {
  it("maps 429 to rate_limited and carries the Retry-After window", async () => {
    const res = new Response("slow down", { status: 429, headers: { "retry-after": "30" } });
    const err = await httpError("POST https://x/y", res);
    expect(err.reason).toBe("rate_limited");
    expect(err.status).toBe(429);
    expect(err.retryAfterMs).toBe(30_000);
    expect(err.message).toContain("429");
    expect(err.message).toContain("slow down");
  });

  it("maps a 429 without Retry-After to rate_limited with no window", async () => {
    const err = await httpError("POST https://x/y", new Response("slow", { status: 429 }));
    expect(err.reason).toBe("rate_limited");
    expect(err.retryAfterMs).toBeUndefined();
  });

  it("maps other 4xx to http_4xx with no rate-limit window", async () => {
    const err = await httpError("POST https://x/y", new Response("bad", { status: 400 }));
    expect(err.reason).toBe("http_4xx");
    expect(err.status).toBe(400);
    expect(err.retryAfterMs).toBeUndefined();
  });

  it("maps 5xx to http_5xx", async () => {
    const err = await httpError("POST https://x/y", new Response("boom", { status: 503 }));
    expect(err.reason).toBe("http_5xx");
    expect(err.status).toBe(503);
  });
});
