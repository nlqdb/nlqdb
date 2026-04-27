// Coverage for `redactPii` — the cases I expect to land plus the
// false-positive shapes the over-greedy first cut produced.

import { describe, expect, it } from "vitest";
import { redactPii } from "../src/index.ts";

describe("redactPii — positive cases (should redact)", () => {
  it("redacts email addresses", () => {
    expect(redactPii("hi user@example.com today")).toBe("hi [email] today");
  });

  it("redacts a JWT token", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    expect(redactPii(`Authorization: Bearer ${jwt}`)).toContain("[jwt]");
    expect(redactPii(`Authorization: Bearer ${jwt}`)).not.toContain(jwt);
  });

  it("redacts a Stripe-style API key", () => {
    expect(redactPii("sk_test_AbCdEfGhIjKlMnOpQrStUvWxYz123456")).toBe("[apikey]");
  });

  it("redacts a SHA-256 hex hash", () => {
    const hash = "a".repeat(64);
    expect(redactPii(`hash=${hash}`)).toBe("hash=[token]");
  });

  it("redacts an E.164 phone number", () => {
    expect(redactPii("call +41 78 123 4567 today")).toBe("call [phone] today");
  });

  it("redacts a 4-4-4-4 grouped card number", () => {
    expect(redactPii("paid with 4242 4242 4242 4242")).toBe("paid with [card]");
    expect(redactPii("paid with 4242-4242-4242-4242")).toBe("paid with [card]");
  });
});

describe("redactPii — negative cases (should NOT redact)", () => {
  it("leaves ISO timestamps intact", () => {
    // Tightened phone/card patterns should ignore "2026-04-27 12:34:56"
    expect(redactPii("created_at=2026-04-27 12:34:56")).toBe("created_at=2026-04-27 12:34:56");
  });

  it("leaves short numeric runs intact", () => {
    expect(redactPii("rowid=12345 user=42")).toBe("rowid=12345 user=42");
  });

  it("leaves prose words intact (no spurious [token] matches)", () => {
    const prose = "the quick brown fox jumps over the lazy dog";
    expect(redactPii(prose)).toBe(prose);
  });

  it("leaves UUIDs intact (36 chars < 60 token threshold)", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    expect(redactPii(`id=${uuid}`)).toBe(`id=${uuid}`);
  });

  it("leaves a 13-digit transaction ID without grouping intact", () => {
    // Earlier card pattern matched any 13-19 digit run; tightened to
    // strict 4-4-4-4 grouping only.
    expect(redactPii("txn=1234567890123")).toBe("txn=1234567890123");
  });

  it("leaves SQL row counts intact", () => {
    expect(redactPii("returned 4128 rows in 12.4ms")).toBe("returned 4128 rows in 12.4ms");
  });
});

describe("redactPii — composition", () => {
  it("redacts multiple PII types in one pass", () => {
    const out = redactPii(
      "user user@example.com paid 4242 4242 4242 4242 with token sk_live_AbCdEfGhIjKlMnOp123456",
    );
    expect(out).toContain("[email]");
    expect(out).toContain("[card]");
    expect(out).toContain("[apikey]");
  });
});
