import { describe, expect, it } from "bun:test";
import type { AskResponse } from "@nlqdb/sdk";

import { buildGoal, classifyWrite, parseLastChange, TABLE } from "../src/dogfood-write.ts";

const ok = (res: Partial<AskResponse>) => ({ ok: true as const, res: res as AskResponse });
const trace = (
  widen?: { tables: string[]; ddl: string[]; schema_rewritten: boolean },
  sql = `INSERT INTO "s"."${TABLE}" (run) VALUES (225)`,
) => ({
  sql,
  plan_id: "p",
  confidence: 1,
  model: "m",
  cache_hit: false,
  ...(widen ? { widen } : {}),
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

  it("null when the section is missing or malformed", () => {
    expect(parseLastChange("# Scorecard\n")).toBeNull();
    expect(parseLastChange("## Last change\n\nfree text\n")).toBeNull();
  });
});

describe("buildGoal", () => {
  it("names the table with a leading insert verb and fits the 2000-char cap", () => {
    const goal = buildGoal({
      date: "2026-09-27",
      run: "225",
      headline: "h",
      details: "x".repeat(5000),
    });
    expect(goal.startsWith(`Log this daily run in the ${TABLE} table: run 225`)).toBe(true);
    expect(goal.length).toBeLessThanOrEqual(2000);
  });
});

describe("classifyWrite", () => {
  const widened = trace({ tables: [TABLE], ddl: [], schema_rewritten: false });
  it("HIT — preview widened, commit landed and rewrote the schema", () => {
    const commit = ok({
      status: "ok",
      rowCount: 1,
      trace: trace({ tables: [TABLE], ddl: ["CREATE TABLE"], schema_rewritten: true }),
    });
    expect(
      classifyWrite(ok({ status: "ok", requires_confirm: true, trace: widened }), commit),
    ).toEqual({
      inSample: true,
      hit: true,
      reason: "landed_widened",
    });
  });

  it("a new column caught only at commit is still in the sample", () => {
    const commit = ok({
      status: "ok",
      rowCount: 1,
      trace: trace({ tables: [TABLE], ddl: ["ALTER TABLE"], schema_rewritten: true }),
    });
    expect(
      classifyWrite(ok({ status: "ok", requires_confirm: true, trace: trace() }), commit).hit,
    ).toBe(true);
  });

  it("not in sample — every field already seen", () => {
    const commit = ok({ status: "ok", rowCount: 1, trace: trace() });
    expect(
      classifyWrite(ok({ status: "ok", requires_confirm: true, trace: trace() }), commit),
    ).toEqual({
      inSample: false,
      hit: false,
      reason: "seen_fields",
    });
  });

  it("a write aimed at another table is a miss, never 'seen'", () => {
    const hijack = trace(undefined, `INSERT INTO "s"."entities" (name) VALUES ('x')`);
    const commit = ok({ status: "ok", rowCount: 1, trace: hijack });
    expect(
      classifyWrite(ok({ status: "ok", requires_confirm: true, trace: hijack }), commit),
    ).toEqual({ inSample: true, hit: false, reason: "wrong_target" });
    const other = trace({ tables: ["runs"], ddl: ["CREATE TABLE"], schema_rewritten: true });
    expect(
      classifyWrite(
        ok({ status: "ok", requires_confirm: true, trace: other }),
        ok({ status: "ok", rowCount: 1, trace: other }),
      ).reason,
    ).toBe("widen_wrong_table:runs");
  });

  it("errors and create-routing count as misses, never drop out", () => {
    expect(classifyWrite({ ok: false, code: "rate_limited" })).toEqual({
      inSample: true,
      hit: false,
      reason: "preview_error:rate_limited",
    });
    expect(classifyWrite(ok({ kind: "create", trace: trace() })).reason).toBe("classified_create");
    const pre = ok({ status: "ok", requires_confirm: true, trace: widened });
    expect(classifyWrite(pre, { ok: false, code: "confirm_expired" }).reason).toBe(
      "commit_error:confirm_expired",
    );
    expect(classifyWrite(pre).reason).toBe("not_committed");
  });
});
