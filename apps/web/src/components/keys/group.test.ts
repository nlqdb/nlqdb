import { describe, expect, test } from "bun:test";
import type { KeyRecord } from "@nlqdb/sdk";
import { formatRelative, groupKeys, summarizeKey } from "./group";

function makeKey(overrides: Partial<KeyRecord> = {}): KeyRecord {
  return {
    id: "k_1",
    keyType: "sk_live",
    last4: "abcd",
    name: null,
    dbId: null,
    mcpHost: null,
    deviceId: null,
    lastUsedAt: null,
    createdAt: 1_700_000_000,
    revokedAt: null,
    ...overrides,
  };
}

describe("groupKeys", () => {
  test("splits active and revoked while preserving server order", () => {
    const keys: KeyRecord[] = [
      makeKey({ id: "k_a", createdAt: 3 }),
      makeKey({ id: "k_b", createdAt: 2 }),
      makeKey({ id: "k_c", createdAt: 1, revokedAt: 1_000_000 }),
    ];
    const { active, revoked } = groupKeys(keys);
    expect(active.map((k) => k.id)).toEqual(["k_a", "k_b"]);
    expect(revoked.map((k) => k.id)).toEqual(["k_c"]);
  });

  test("handles empty inputs", () => {
    const { active, revoked } = groupKeys([]);
    expect(active).toEqual([]);
    expect(revoked).toEqual([]);
  });
});

describe("summarizeKey", () => {
  // `now` is in ms; the SDK / server payload `createdAt` is in seconds.
  const NOW_MS = 1_700_000_000_000 + 5 * 60 * 1000;

  test("uses the human name when present", () => {
    const out = summarizeKey(makeKey({ name: "CI deploy" }), NOW_MS);
    expect(out.label).toBe("CI deploy");
    expect(out.typeLabel).toBe("sk_live");
  });

  test("falls back to host + device for sk_mcp without a name", () => {
    const out = summarizeKey(
      makeKey({ keyType: "sk_mcp", mcpHost: "cursor", deviceId: "macbook" }),
      NOW_MS,
    );
    expect(out.label).toBe("cursor · macbook");
  });

  test("falls back to dbId for pk_live without a name", () => {
    const out = summarizeKey(makeKey({ keyType: "pk_live", dbId: "db_xyz" }), NOW_MS);
    expect(out.label).toBe("db_xyz");
    expect(out.typeLabel).toBe("pk_live");
  });

  test("renders 'never' for last_used when null", () => {
    const out = summarizeKey(makeKey({ lastUsedAt: null }), NOW_MS);
    expect(out.lastUsedAtLabel).toBe("never");
  });

  test("renders relative created/last-used labels", () => {
    const out = summarizeKey(
      makeKey({ createdAt: 1_700_000_000, lastUsedAt: 1_700_000_000 }),
      NOW_MS,
    );
    expect(out.createdAtLabel).toBe("5m ago");
    expect(out.lastUsedAtLabel).toBe("5m ago");
  });

  test("blank name string still falls back", () => {
    const out = summarizeKey(makeKey({ name: "   " }), NOW_MS);
    expect(out.label).toBe("Untitled");
  });

  test("revokedAtLabel is null for active rows", () => {
    const out = summarizeKey(makeKey({ revokedAt: null }), NOW_MS);
    expect(out.revokedAtLabel).toBe(null);
  });

  test("revokedAtLabel renders relative time for revoked rows", () => {
    const out = summarizeKey(
      makeKey({ revokedAt: 1_700_000_000, lastUsedAt: 1_699_999_700 }),
      NOW_MS,
    );
    expect(out.revokedAtLabel).toBe("5m ago");
  });
});

describe("formatRelative", () => {
  const NOW = 1_700_000_000_000;
  test("just now under 60s", () => {
    expect(formatRelative(1_700_000_000 - 30, NOW)).toBe("just now");
  });
  test("minutes window", () => {
    expect(formatRelative(1_700_000_000 - 600, NOW)).toBe("10m ago");
  });
  test("hours window", () => {
    expect(formatRelative(1_700_000_000 - 3 * 3600, NOW)).toBe("3h ago");
  });
  test("days window", () => {
    expect(formatRelative(1_700_000_000 - 2 * 86400, NOW)).toBe("2d ago");
  });
  test("months window", () => {
    expect(formatRelative(1_700_000_000 - 60 * 86400, NOW)).toBe("2mo ago");
  });
  test("1y+ falls back for older", () => {
    expect(formatRelative(1_700_000_000 - 400 * 86400, NOW)).toBe("1y+ ago");
  });
  test("clamps negative delta to just now (clock skew)", () => {
    expect(formatRelative(1_700_000_000 + 5, NOW)).toBe("just now");
  });
});
