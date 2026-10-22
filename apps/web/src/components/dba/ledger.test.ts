import type { DatabaseSummary } from "@nlqdb/sdk";
import { describe, expect, it } from "vitest";
import { describeChange, pickDb } from "./ledger";

const db = (id: string, lastQueriedAt: number | null): DatabaseSummary => ({
  id,
  slug: id.replace("db_", ""),
  displayName: id,
  engine: "postgres",
  pkLive: null,
  lastQueriedAt,
  createdAt: 1,
});

describe("pickDb", () => {
  const dbs = [db("db_a", 5), db("db_b", 9), db("db_c", null)];

  it("honours ?db= by id or slug", () => {
    expect(pickDb(dbs, "db_c")?.id).toBe("db_c");
    expect(pickDb(dbs, "a")?.id).toBe("db_a");
  });

  it("falls back to the most recently queried DB", () => {
    expect(pickDb(dbs, null)?.id).toBe("db_b");
    expect(pickDb(dbs, "db_gone")?.id).toBe("db_b");
    expect(pickDb([], null)).toBeNull();
  });
});

describe("describeChange", () => {
  it("names the change and the write path that made it", () => {
    expect(describeChange({ kind: "add_column", table: "votes", origin: "insert" })).toBe(
      "Added a column to votes — from insert()",
    );
    expect(describeChange({ kind: "create_index", table: "servers", origin: "ask" })).toBe(
      "Indexed a key on servers — from a chat write",
    );
  });
});
