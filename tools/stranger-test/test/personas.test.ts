import { describe, expect, test } from "bun:test";
import { percentile, redactInviteFromUrl, withInviteParam } from "../src/browser.ts";
import { FLOW_PERSONA, PERSONA_PROMPTS } from "../src/personas.ts";

// The seeded prompts double as the §1.1 "what shape of stranger
// lands" surface; drift here changes what we're measuring, not just
// how. Counts pinned to the plan's §1.1 paragraph.
describe("personas", () => {
  test("each persona has the planned prompt count", () => {
    expect(PERSONA_PROMPTS.P1.length).toBeGreaterThanOrEqual(10);
    expect(PERSONA_PROMPTS.P2.length).toBeGreaterThanOrEqual(8);
    expect(PERSONA_PROMPTS.P3.length).toBeGreaterThanOrEqual(4);
    expect(PERSONA_PROMPTS.P6.length).toBeGreaterThanOrEqual(3);
  });

  test("every prompt is a non-empty, non-secret-looking string", () => {
    for (const list of Object.values(PERSONA_PROMPTS)) {
      for (const p of list) {
        expect(p.length).toBeGreaterThan(5);
        expect(p).not.toMatch(/sk_|sk-|pk_|api[_-]?key|secret/i);
      }
    }
  });

  test("FLOW_PERSONA maps every shipped flow", () => {
    expect(FLOW_PERSONA["flow-001"]).toBe("P1");
    expect(FLOW_PERSONA["flow-002"]).toBe("P3");
    expect(FLOW_PERSONA["flow-003"]).toBe("P3");
  });
});

describe("percentile", () => {
  test("returns null for an empty input (the no-passing-run case)", () => {
    expect(percentile([], 50)).toBeNull();
  });

  test("p50 of 5 evenly-spaced samples is the middle one", () => {
    expect(percentile([100, 200, 300, 400, 500], 50)).toBe(300);
  });

  test("p95 of 20 samples lies at the top of the distribution", () => {
    const xs = Array.from({ length: 20 }, (_, i) => (i + 1) * 100);
    expect(percentile(xs, 95)).toBe(2000);
  });

  test("does not mutate the caller's array", () => {
    const input = [3, 1, 2];
    percentile(input, 50);
    expect(input).toEqual([3, 1, 2]);
  });
});

describe("withInviteParam (SK-STRG-004)", () => {
  test("returns the path unchanged when invite is null", () => {
    expect(withInviteParam("/", null)).toBe("/");
    expect(withInviteParam("/solve/foo/", null)).toBe("/solve/foo/");
  });

  test("appends ?invite= when path has no query", () => {
    expect(withInviteParam("/", "abcd1234efgh5678")).toBe("/?invite=abcd1234efgh5678");
  });

  test("appends &invite= when path already has a query", () => {
    expect(withInviteParam("/solve/foo/?utm_source=hn", "abcd1234efgh5678")).toBe(
      "/solve/foo/?utm_source=hn&invite=abcd1234efgh5678",
    );
  });

  test("refuses to forward a malformed code (cross-script-injection guard)", () => {
    expect(() => withInviteParam("/", "short")).toThrow(/invite code/i);
    expect(() => withInviteParam("/", "has spaces 123456")).toThrow(/invite code/i);
    expect(() => withInviteParam("/", `${"a".repeat(129)}`)).toThrow(/invite code/i);
  });
});

describe("redactInviteFromUrl (SK-GATE-007 leak guard)", () => {
  test("redacts ?invite= at start of query", () => {
    expect(redactInviteFromUrl("https://nlqdb.com/?invite=abcd1234efgh5678")).toBe(
      "https://nlqdb.com/?invite=<redacted>",
    );
  });

  test("redacts &invite= after another param", () => {
    expect(
      redactInviteFromUrl("https://nlqdb.com/solve/foo/?utm_source=hn&invite=abcd1234efgh5678"),
    ).toBe("https://nlqdb.com/solve/foo/?utm_source=hn&invite=<redacted>");
  });

  test("preserves params that follow invite=", () => {
    expect(redactInviteFromUrl("https://nlqdb.com/?invite=abcd1234efgh5678&ref=x")).toBe(
      "https://nlqdb.com/?invite=<redacted>&ref=x",
    );
  });

  test("preserves fragments and stops redaction at #", () => {
    expect(redactInviteFromUrl("https://nlqdb.com/?invite=abcd1234efgh5678#section")).toBe(
      "https://nlqdb.com/?invite=<redacted>#section",
    );
  });

  test("returns unchanged URL when no invite param is present", () => {
    expect(redactInviteFromUrl("https://nlqdb.com/solve/foo/?utm_source=hn")).toBe(
      "https://nlqdb.com/solve/foo/?utm_source=hn",
    );
  });

  test("is case-insensitive on the param name (defence in depth)", () => {
    expect(redactInviteFromUrl("https://nlqdb.com/?Invite=abcd1234efgh5678")).toBe(
      "https://nlqdb.com/?Invite=<redacted>",
    );
  });
});
