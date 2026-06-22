import { describe, expect, it } from "bun:test";

import { retrievePlanExemplars } from "@nlqdb/llm";

import { PERSONA_BENCH_QUESTIONS, schemaFor } from "../src/datasets/persona-bench.ts";

// persona-bench retrieval precision (SK-LLM-041 × SK-QUAL-018) — the offline,
// key-free measurement that bridges the two engine levers: does the DAIL-SQL
// plan-exemplar pool (curated from BIRD `SK-QUAL-014` evidence) retrieve a
// structurally-appropriate demonstration for nlqdb's OWN ICP queries, not just
// the synthetic held-out probes in `packages/llm`? Each persona-bench question
// is masked + ranked against the pool exactly as the eval's `--retrieve-exemplars`
// dispatch would; we score precision@1 against the structurally-non-misleading
// bucket(s) for each question. Read-only, no LLM, no quota — the same
// instrument shape as SK-QUAL-014/015 and the pool's own precision@1 probe.
//
// The pool ships in `@nlqdb/llm`; persona-bench data ships here; `@nlqdb/eval`
// already depends on `@nlqdb/llm` (the runner's system under test), so the probe
// lives on this side of the dependency edge.

// The DDL the live `/v1/ask` schema-introspection would hand the retriever: the
// CREATE statements of the persona's schema (identifiers are all retrieval
// needs — the seed INSERTs are irrelevant to masked-token similarity).
function ddlFor(db_id: string): string {
  const schema = schemaFor(db_id);
  if (!schema) throw new Error(`no persona schema for ${db_id}`);
  return schema.setup.filter((s) => s.trimStart().startsWith("CREATE")).join(";\n");
}

// For each ICP question, the pool bucket(s) whose demonstration teaches a
// structurally-correct shape (a question may legitimately accept more than one,
// e.g. a JOIN'd GROUP BY COUNT is served by either `group-by-count` or
// `join-aggregate`). A retrieval outside this set is a miss — it would show the
// model the wrong skeleton. Authored from each gold's structure, not its
// retrieval, so the map is the contract and the pool is measured against it.
const EXPECTED: Record<number, readonly string[]> = {
  0: ["order-by-limit", "group-order-limit"], // plain top-N; ORDER..DESC LIMIT is the mechanic
  1: ["group-by-count", "join-aggregate"],
  2: ["date-range", "group-by-count", "join-aggregate"],
  3: ["null-filter"], // "never logged in" ⇒ IS NULL, NOT the anti-join NOT-IN demo
  4: ["ratio-cast", "join-aggregate"],
  5: ["having"],
  6: ["join-aggregate", "ratio-cast"],
  7: ["group-by-count", "join-aggregate"],
  8: ["group-order-limit", "group-max"], // known miss: masks to ratio-cast (see below)
  9: ["date-range"],
  10: ["group-by-count", "having", "join-aggregate"],
  11: ["having"],
  12: ["anti-join"],
  13: ["group-order-limit", "join-aggregate"],
  14: ["having"],
  15: ["date-range"],
  16: ["anti-join"],
  17: ["date-range"],
  18: ["join-aggregate", "group-order-limit", "group-by-count"],
  19: ["having"],
};

function measure() {
  let hits = 0;
  const misses: string[] = [];
  for (const q of PERSONA_BENCH_QUESTIONS) {
    const [top] = retrievePlanExemplars(q.question, ddlFor(q.db_id), 1);
    const bucket = top?.bucket ?? "(none)";
    if (EXPECTED[q.question_id]?.includes(bucket)) hits++;
    else misses.push(`q${q.question_id}(${q.bucket}->${bucket})`);
  }
  return {
    hits,
    total: PERSONA_BENCH_QUESTIONS.length,
    precisionAt1: hits / PERSONA_BENCH_QUESTIONS.length,
    misses,
  };
}

describe("persona-bench retrieval precision (SK-LLM-041 × SK-QUAL-018)", () => {
  it("every question has an expected-bucket entry", () => {
    for (const q of PERSONA_BENCH_QUESTIONS) {
      expect(EXPECTED[q.question_id]).toBeDefined();
    }
  });

  it("retrieves a structurally-appropriate demo for ≥ 19/20 ICP queries", () => {
    const m = measure();
    // Surface the numbers in the run log for the verification record.
    console.info("[persona-retrieval] measure:", JSON.stringify(m));
    // 19/20 after the null-filter row (was 18/20): q3 "who never logged in"
    // flipped from the anti-join NOT-IN demo to the null-filter IS-NULL demo.
    expect(m.hits).toBeGreaterThanOrEqual(19);
  });

  it("the null-filter row lands q3 ('never logged in') on the IS-NULL demo, not anti-join", () => {
    const q3 = PERSONA_BENCH_QUESTIONS.find((q) => q.question_id === 3);
    expect(q3).toBeDefined();
    const [top] = retrievePlanExemplars(q3?.question ?? "", ddlFor(q3?.db_id ?? "saas_app"), 1);
    expect(top?.bucket).toBe("null-filter");
    // …while the relation-absence anti-join queries (q12/q16, "never placed an
    // order" / "never recalled") still retrieve anti-join.
    for (const id of [12, 16]) {
      const q = PERSONA_BENCH_QUESTIONS.find((x) => x.question_id === id);
      const [aj] = retrievePlanExemplars(q?.question ?? "", ddlFor(q?.db_id ?? "saas_app"), 1);
      expect(aj?.bucket).toBe("anti-join");
    }
  });

  // The one remaining miss is documented, not silently accepted: q8 ("the 5
  // most-recalled facts … how many times") masks to a generic skeleton whose
  // top-1 is `ratio-cast` rather than `group-order-limit`/`group-max`. That is a
  // masking artifact (the right buckets exist in the pool), not a missing bucket,
  // so the fix is on the selector side (query-skeleton similarity, DAIL §4.1's
  // second variant) — out of scope for a pool-row add. This test pins the known
  // state so a future selector change that fixes it is visible as a delta.
  it("documents the q8 known miss (masking artifact, not a pool gap)", () => {
    const q8 = PERSONA_BENCH_QUESTIONS.find((q) => q.question_id === 8);
    const [top] = retrievePlanExemplars(q8?.question ?? "", ddlFor(q8?.db_id ?? "agent_memory"), 1);
    expect(EXPECTED[8]).not.toContain(top?.bucket);
  });
});
