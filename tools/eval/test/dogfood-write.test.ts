import { describe, expect, it } from "bun:test";
import { type InsertResult, NlqdbApiError } from "@nlqdb/sdk";

import {
  BLOCKED_TABLE,
  blockedWrites,
  classifyWrite,
  DELTA_TABLE,
  deltaWrites,
  errorCode,
  parseLastChange,
  parseRows,
  runWrite,
  TABLE,
} from "../src/dogfood-write.ts";

const landed = (widen?: InsertResult["widen"], rowCount = 1) => ({
  ok: true as const,
  res: {
    status: "ok",
    rows: [],
    rowCount,
    table: TABLE,
    ...(widen ? { widen } : {}),
  } as InsertResult,
});

describe("parseLastChange", () => {
  it("reads the single-entry record the daily run writes", () => {
    const md = `# Scorecard\n\n## Last change\n\n**2026-09-26 (run 224)** — **Live KPI 1 re-measured: 7/10 → 10/10.** \`Deploy API\` was\ngreen.\n\n_(Single-entry by design)_\n`;
    expect(parseLastChange(md)).toEqual({
      date: "2026-09-26",
      run: "224",
      headline: "Live KPI 1 re-measured: 7/10 → 10/10.",
      details: "`Deploy API` was green.",
    });
  });

  it("accepts a colon separator (run 248's entry, which wrote nothing)", () => {
    const md = "## Last change\n\n**2026-10-15 (run 248)**: **Roles counted.** Reaper.\n";
    expect(parseLastChange(md)).toMatchObject({ run: "248", headline: "Roles counted." });
  });

  it("null when the section is missing or malformed", () => {
    expect(parseLastChange("# Scorecard\n")).toBeNull();
    expect(parseLastChange("## Last change\n\nfree text\n")).toBeNull();
  });
});

describe("runWrite", () => {
  it("lands the whole record as one row, run as a number, no length cap", () => {
    const details = "x".repeat(5000);
    expect(runWrite({ date: "2026-09-27", run: "225", headline: "h", details })).toEqual({
      table: TABLE,
      row: { run: 225, date: "2026-09-27", headline: "h", details },
    });
  });
});

describe("deltaWrites", () => {
  const card = (e1: string, gate: string) =>
    `| # | Metric | Value | Target |\n|---|---|---|---|\n| | **Engine** | | |\n| E1 | KPI 1 | ${e1} | ≥ 95 % |\n| 16 | Gate | ${gate} | note \\| pipe |\n`;
  it("parses numbered rows, skips section headers, keeps escaped pipes", () => {
    const rows = parseRows(card("a", "b"));
    expect([...rows.keys()]).toEqual(["E1", "16"]);
    expect(rows.get("16")).toEqual({ metric: "Gate", value: "b" });
  });
  it("one write per row whose value changed, none for unchanged or new rows", () => {
    expect(deltaWrites("230", card("1/2", "RED"), card("2/3", "RED"))).toEqual([
      {
        table: DELTA_TABLE,
        row: { run: 230, row: "E1", metric: "KPI 1", before: "1/2", after: "2/3" },
      },
    ]);
    expect(deltaWrites("230", card("a", "b"), card("a", "b"))).toEqual([]);
    expect(deltaWrites("230", "", card("a", "b"))).toEqual([]);
  });
  it("keeps long values whole", () => {
    const [w] = deltaWrites("230", card("x".repeat(3000), "b"), card("y".repeat(3000), "b"));
    expect(w?.row["after"]).toBe("y".repeat(3000));
  });
});

describe("blockedWrites", () => {
  const q = (...titles: string[]) =>
    titles
      .map((t) => `## ${t}\n\n~5 min · blocked since 2026-09-18. Why.\n\n1. Step.\n`)
      .join("\n");
  it("one write per bullet the run added, none for kept ones", () => {
    expect(blockedWrites("227", q("Old"), q("Old", "New"))).toEqual([
      {
        table: BLOCKED_TABLE,
        row: { run: 227, title: "New", estimate: "~5 min", blockedSince: "2026-09-18" },
      },
    ]);
    expect(blockedWrites("227", q("Old"), q("Old"))).toEqual([]);
  });
});

describe("classifyWrite", () => {
  const widen = { tables: [TABLE], ddl: ["ALTER TABLE"], schema_rewritten: true };
  it("HIT — the insert widened and landed", () => {
    expect(classifyWrite(landed(widen))).toEqual({
      inSample: true,
      hit: true,
      reason: "landed_widened",
    });
  });

  it("not in sample — every field already seen", () => {
    expect(classifyWrite(landed())).toEqual({ inSample: false, hit: false, reason: "seen_fields" });
  });

  it("errors and an empty landing count as misses, never drop out", () => {
    expect(classifyWrite({ ok: false, code: "write_constraint:not_null@estimate" })).toEqual({
      inSample: true,
      hit: false,
      reason: "insert_error:write_constraint:not_null@estimate",
    });
    expect(classifyWrite(landed(widen, 0)).reason).toBe("not_landed");
  });
});

describe("errorCode", () => {
  const apiErr = (code: string, params?: Record<string, unknown>) =>
    new NlqdbApiError("x", 502, code as never, "/v1/insert", { code: code as never, params });

  it("names the declared cause and provider, so a miss says why (run 237)", () => {
    const err = apiErr("llm_failed", { reason: "circuit_open", provider: "groq", lane: "free" });
    expect(errorCode(err)).toBe("llm_failed:circuit_open@groq");
  });

  it("names a constraint's kind and column (run 251's two scorecard_deltas misses)", () => {
    const err = apiErr("write_constraint", { kind: "not_null", column: "estimate" });
    expect(errorCode(err)).toBe("write_constraint:not_null@estimate");
  });

  it("bare code when the envelope declares no cause; network errors keep their message", () => {
    expect(errorCode(apiErr("rate_limited"))).toBe("rate_limited");
    expect(errorCode(apiErr("llm_failed", { provider: "groq" }))).toBe("llm_failed");
    expect(errorCode(new Error("ECONNRESET"))).toBe("network:ECONNRESET");
  });
});
