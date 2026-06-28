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
  0: ["order-by-limit"], // plain top-N; the `order-by-limit` pool row now demonstrates the exact `ORDER BY … LIMIT` skeleton (the GROUP-BY stand-in is no longer accepted)
  1: ["group-by-count", "join-aggregate"],
  2: ["date-range", "group-by-count", "join-aggregate"],
  3: ["null-filter"], // "never logged in" ⇒ IS NULL, NOT the anti-join NOT-IN demo
  4: ["ratio-cast", "join-aggregate"],
  5: ["having"],
  6: ["join-aggregate", "ratio-cast"],
  7: ["group-by-count", "join-aggregate"],
  8: ["group-order-limit", "group-max"], // known miss: masks to ratio-cast (see below)
  9: ["date-range"],
  10: ["filtered-group-by-count", "group-by-count", "join-aggregate"], // landed by the `filtered-group-by-count` pool row (named-entity grouped count through a JOIN); was the `having` demo at 20/23

  11: ["having"],
  12: ["anti-join"],
  13: ["group-order-limit", "join-aggregate"],
  14: ["having"],
  15: ["date-range"],
  16: ["anti-join"],
  17: ["date-range"],
  18: ["join-aggregate", "group-order-limit", "group-by-count"],
  19: ["having"],
  // Batch 3 (SK-QUAL-018) — authored from each gold's structure.
  20: ["scalar-subquery"], // landed by the "Which … ? List the …" exemplar framing (no longer a miss)
  21: ["count-distinct"], // COUNT(DISTINCT referrer_id) — landed by the "different cities" exemplar phrasing (no longer a miss)
  22: ["join-aggregate", "group-by-count"], // known miss: top-1 is `date-range` (see below)
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

  it("retrieves a structurally-appropriate demo for ≥ 21/23 ICP queries", () => {
    const m = measure();
    // Surface the numbers in the run log for the verification record.
    console.info("[persona-retrieval] measure:", JSON.stringify(m));
    // 21/23: the null-filter row lands q3 ("who never logged in") on IS-NULL, the
    // order-by-limit row lands q0 ("the 10 most recent signups") on the plain
    // ORDER BY … LIMIT demo, the count-distinct row's "how many different"
    // phrasing lands q21 ("how many different referral sources") instead of
    // `group-by-count`, the scalar-subquery row's "Which … ? List the …" framing
    // lands q20 ("which plans cost more than the average plan price") instead of
    // `having`, and the new `filtered-group-by-count` row (a named-entity grouped
    // count through a JOIN) lands q10 ("which predicates does the agent named
    // 'support-bot' use, and how often") instead of `having` (was a miss at 20/23
    // — the `having` demo would teach a HAVING COUNT filter the gold doesn't have).
    // All four were structural pool gaps closed by pool curation (adding/rephrasing
    // a row), not selector tweaks (run-52-falsified). The two remaining pinned,
    // documented misses are q8, q22 (see below) — both selector-side (the right
    // buckets exist in the pool; the masked skeleton mis-ranks them).
    expect(m.hits).toBeGreaterThanOrEqual(21);
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

  it("the order-by-limit row lands q0 ('the 10 most recent signups') on the plain ORDER BY … LIMIT demo", () => {
    const q0 = PERSONA_BENCH_QUESTIONS.find((q) => q.question_id === 0);
    expect(q0).toBeDefined();
    const [top] = retrievePlanExemplars(q0?.question ?? "", ddlFor(q0?.db_id ?? "saas_app"), 1);
    expect(top?.bucket).toBe("order-by-limit");
    // …while the grouped top-N queries (q8/q13/q18, "X with the most Y") must NOT
    // be pulled to the plain order-by-limit demo — the aggregate discriminates.
    for (const id of [13, 18]) {
      const q = PERSONA_BENCH_QUESTIONS.find((x) => x.question_id === id);
      const [g] = retrievePlanExemplars(q?.question ?? "", ddlFor(q?.db_id ?? "saas_app"), 1);
      expect(g?.bucket).not.toBe("order-by-limit");
    }
  });

  // The two remaining misses (q8, q22) are documented, not silently accepted.
  // Both are selector-side (the right buckets exist in the pool), so the
  // fix is query-skeleton similarity (DAIL §4.1's second variant) — out of scope
  // for a pool-row add. These tests pin the known state so a future selector
  // change that fixes either of them is visible as a delta.
  //
  // NOTE: q21 (run 68), q20 (run 76) and q10 (run 99) were all NOT
  // selector-unfixable — q21/q20 were exemplar-phrasing leaks (the count-distinct
  // row echoed the SQL keyword "distinct" while users say "how many different";
  // the scalar-subquery row read as a bare "List the names of products priced
  // above…" while users ask "Which … cost … the average …? List the … names"),
  // and q10 was a missing structural bucket (a named-entity grouped count through
  // a JOIN, which neither `group-by-count` nor `join-aggregate` demonstrated; the
  // new `filtered-group-by-count` row closed it). Each was fixed by pool curation
  // — rephrasing or adding a row to match how users phrase the shape — holding the
  // held-out probe at full precision@1 each time. So the run-52 "lexical avenue is
  // dead" verdict is scoped to SELECTOR-code tweaks (stopwords / phrase
  // normalisation in few-shot-select.ts), NOT to pool-exemplar curation.
  //
  // The cheaper LEXICAL-selector avenue is measured-and-rejected (2026-06-22,
  // run 52 — quality-score-verification-log.md): a stopword filter regresses ICP
  // precision@1 and phrase normalisation leaves it flat, both keeping held-out
  // 14/14. Root cause: q22's top-1 `date-range` wins on generic filler plus a
  // coincidental masked literal slot (`val` — both questions happen to contain a
  // literal), which flat masked-token Jaccard cannot separate from a real
  // structural token. Do NOT re-attempt a lexical selector tweak here; the only
  // remaining offline gain needs query-skeleton (predicted-SQL) similarity.
  //
  // q8 ("the 5 most-recalled facts … how many times") masks to a generic
  // skeleton whose top-1 is `ratio-cast` rather than `group-order-limit`/`group-max`.
  it("documents the q8 known miss (masking artifact, not a pool gap)", () => {
    const q8 = PERSONA_BENCH_QUESTIONS.find((q) => q.question_id === 8);
    const [top] = retrievePlanExemplars(q8?.question ?? "", ddlFor(q8?.db_id ?? "agent_memory"), 1);
    expect(EXPECTED[8]).not.toContain(top?.bucket);
  });

  // q10 ("which predicates does the agent named 'support-bot' use, and how
  // often") is a filtered GROUP-BY-COUNT (JOIN to resolve the name + WHERE +
  // GROUP BY + COUNT, NO HAVING). The `filtered-group-by-count` pool row (run 99)
  // now lands it top-1 — was the `having` demo at 20/23, a structurally-wrong
  // skeleton that would teach a `HAVING COUNT(*)` filter the gold doesn't have.
  // Pinned so a regression is visible as a delta.
  it("the filtered-group-by-count row lands q10 ('named agent … and how often') off the `having` demo", () => {
    const q10 = PERSONA_BENCH_QUESTIONS.find((q) => q.question_id === 10);
    const [top] = retrievePlanExemplars(
      q10?.question ?? "",
      ddlFor(q10?.db_id ?? "agent_memory"),
      1,
    );
    expect(top?.bucket).toBe("filtered-group-by-count");
    // …while the genuine HAVING queries (q5/q11, "more than N") must NOT be pulled
    // to the filtered grouped count — the COUNT threshold, not the GROUP BY, is
    // the discriminator.
    for (const id of [5, 11]) {
      const q = PERSONA_BENCH_QUESTIONS.find((x) => x.question_id === id);
      const [h] = retrievePlanExemplars(q?.question ?? "", ddlFor(q?.db_id ?? "agent_memory"), 1);
      expect(h?.bucket).toBe("having");
    }
  });

  // q20 ("which plans cost more than the average plan price") now retrieves the
  // scalar-subquery demo top-1 — landed by reframing the exemplar from the bare
  // "List the names of products priced above…" to "Which products are priced
  // above the average price? List the product names" (run 76, the same
  // pool-curation lever as q21). Pinned so a regression is visible as a delta.
  it("the scalar-subquery row lands q20 ('cost more than the average') on the > AVG() demo", () => {
    const q20 = PERSONA_BENCH_QUESTIONS.find((q) => q.question_id === 20);
    const [top] = retrievePlanExemplars(q20?.question ?? "", ddlFor(q20?.db_id ?? "saas_app"), 1);
    expect(top?.bucket).toBe("scalar-subquery");
    // …while the genuine HAVING queries (q5/q11, "placed more than N") must NOT
    // be pulled to scalar-subquery — "above"/"average", not "more than", keeps
    // the two skeletons distinguishable on flat masked Jaccard.
    for (const id of [5, 11]) {
      const q = PERSONA_BENCH_QUESTIONS.find((x) => x.question_id === id);
      const [h] = retrievePlanExemplars(q?.question ?? "", ddlFor(q?.db_id ?? "saas_app"), 1);
      expect(h?.bucket).toBe("having");
    }
  });

  // q22 ("how many of 'support-bot' facts have no expiry date") is a COUNT(*) over
  // a filtered JOIN, but "how many … no expiry date" masks toward the `date-range`
  // demo (the "how many … date" tokens dominate the JOIN/aggregate signal).
  // Selector-side; the right buckets (join-aggregate / group-by-count) exist.
  it("documents the q22 known miss (top-1 `date-range` for a filtered join-aggregate)", () => {
    const q22 = PERSONA_BENCH_QUESTIONS.find((q) => q.question_id === 22);
    const [top] = retrievePlanExemplars(
      q22?.question ?? "",
      ddlFor(q22?.db_id ?? "agent_memory"),
      1,
    );
    expect(EXPECTED[22]).not.toContain(top?.bucket);
  });
});
