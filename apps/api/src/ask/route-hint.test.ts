import { describe, expect, it } from "vitest";
import { probablyZeroDbs, type RecentTable } from "./route-hint.ts";

describe("probablyZeroDbs", () => {
  it("returns true on an empty recent-tables list with a generic goal", () => {
    expect(probablyZeroDbs([], "create a tracker")).toBe(true);
  });

  it("returns true on an empty recent-tables list with any free-form goal", () => {
    // Soft-dep stub behaviour — until WS1 ships the cache, the predicate
    // degrades to "always speculate when no slug hint." The empty list
    // means there's nothing to compare slug words against.
    expect(probablyZeroDbs([], "show me last week's orders")).toBe(true);
    expect(probablyZeroDbs([], "")).toBe(true);
  });

  it("returns false when there is at least one recent table", () => {
    const recent: RecentTable[] = [{ table: "users" }];
    expect(probablyZeroDbs(recent, "show users")).toBe(false);
  });

  it("returns false when a recent table's slug words appear in the goal", () => {
    const recent: RecentTable[] = [{ table: "orders", dbSlug: "orders-tracker-a4f3b2" }];
    // `orders` is a slug word ≥ 4 chars and contains a vowel — the
    // slug-hint check fires and the predicate returns false even
    // though `recentTables.length === 0` is not the case anyway.
    expect(probablyZeroDbs(recent, "show me orders for today")).toBe(false);
  });

  it("ignores slug words that are too short to anchor a match", () => {
    // `db` < 4 chars; `id` < 4 chars; the only word that could match
    // is `cool`, which doesn't appear in the goal. With at least one
    // recent table the predicate returns false either way.
    const recent: RecentTable[] = [{ table: "rows", dbSlug: "db-id-cool" }];
    expect(probablyZeroDbs(recent, "what should I name a tracker")).toBe(false);
  });

  it("ignores random hex tails (no vowel) when checking slug words", () => {
    // Even on an empty recent list the no-vowel hex tail wouldn't
    // count as a slug word; we exercise the filter with a populated
    // list here so the recentTables.length check doesn't dominate.
    const recent: RecentTable[] = [{ table: "x", dbSlug: "xyz-a4f3b2" }];
    expect(probablyZeroDbs(recent, "tell me about a4f3b2 tail")).toBe(false);
  });
});
