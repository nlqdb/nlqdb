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
    const applied = { status: "applied", reason: null } as const;
    expect(
      describeChange({ kind: "add_column", table: "votes", origin: "insert", ...applied }),
    ).toBe("Added a column to votes — from insert()");
    expect(
      describeChange({ kind: "create_index", table: "servers", origin: "ask", ...applied }),
    ).toBe("Indexed a key on servers — from a chat write");
  });

  it("never reads an attach proposal as a committed change", () => {
    expect(
      describeChange({
        kind: "create_index",
        table: "posts",
        origin: "attach",
        status: "proposed",
        reason: "Foreign key posts(author_id) → users has no index.",
      }),
    ).toBe("Proposed, not applied — Foreign key posts(author_id) → users has no index.");
  });

  it("never reads a rejected proposal as a committed change", () => {
    expect(
      describeChange({
        kind: "create_index",
        table: "posts",
        origin: "attach",
        status: "rejected",
        reason: "Foreign key posts(author_id) → users has no index.",
      }),
    ).toBe("Rejected, not applied — Foreign key posts(author_id) → users has no index.");
  });

  it("shows verify's before / after p95 on a kept or reverted proposal", () => {
    const base = {
      kind: "create_index" as const,
      table: "posts",
      origin: "attach" as const,
      reason: "posts(title) is seq-scanned.",
    };
    const measured = { fingerprint: "1", beforeP95Ms: 1.83, afterP95Ms: 0.04 };
    expect(
      describeChange({
        ...base,
        status: "applied",
        verification: { verdict: "keep", ...measured },
      }),
    ).toBe("Applied and verified: p95 est. 1.83 ms → 0.04 ms — posts(title) is seq-scanned.");
    expect(
      describeChange({
        ...base,
        status: "reverted",
        verification: { verdict: "revert", fingerprint: "1", beforeP95Ms: 1.35, afterP95Ms: 26.6 },
      }),
    ).toBe(
      "Reverted: its query ran slower (p95 est. 1.35 ms → 27 ms) — posts(title) is seq-scanned.",
    );
  });
});
