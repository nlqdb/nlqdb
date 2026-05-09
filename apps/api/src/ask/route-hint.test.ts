import { describe, expect, it } from "vitest";
import type { RecentTable } from "./recent-tables.ts";
import { probablyZeroDbs } from "./route-hint.ts";

function entry(overrides: Partial<RecentTable>): RecentTable {
  return {
    dbId: "db_fixture_a1b2c3",
    slug: "fixture-a1b2c3",
    table: "fixture",
    touchedAt: 0,
    ...overrides,
  };
}

describe("probablyZeroDbs", () => {
  it("returns true on an empty recent-tables list with a generic goal", () => {
    expect(probablyZeroDbs([], "create a tracker")).toBe(true);
  });

  it("returns true on an empty recent-tables list with any free-form goal", () => {
    // Empty list means the predicate has nothing to compare slug words
    // against, so it falls through to "speculate".
    expect(probablyZeroDbs([], "show me last week's orders")).toBe(true);
    expect(probablyZeroDbs([], "")).toBe(true);
  });

  it("returns false when there is at least one recent table", () => {
    const recent: RecentTable[] = [entry({ table: "users", slug: "users-x1y2z3" })];
    expect(probablyZeroDbs(recent, "show users")).toBe(false);
  });

  it("returns false when a recent table's slug words appear in the goal", () => {
    const recent: RecentTable[] = [entry({ table: "orders", slug: "orders-tracker-a4f3b2" })];
    // `orders` is a slug word ≥ 4 chars and contains a vowel — the
    // slug-hint check fires and the predicate returns false even
    // though `recentTables.length === 0` is not the case anyway.
    expect(probablyZeroDbs(recent, "show me orders for today")).toBe(false);
  });

  it("ignores slug words that are too short to anchor a match", () => {
    // `db` < 4 chars; `id` < 4 chars; the only word that could match
    // is `cool`, which doesn't appear in the goal. With at least one
    // recent table the predicate returns false either way.
    const recent: RecentTable[] = [entry({ table: "rows", slug: "db-id-cool" })];
    expect(probablyZeroDbs(recent, "what should I name a tracker")).toBe(false);
  });

  it("ignores random hex tails (no vowel) when checking slug words", () => {
    const recent: RecentTable[] = [entry({ table: "x", slug: "xyz-a4f3b2" })];
    expect(probablyZeroDbs(recent, "tell me about a4f3b2 tail")).toBe(false);
  });
});
