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
  8: ["group-count-top-n"], // landed by the `group-count-top-n` pool row (top-N groups WITH their count); was a ratio-cast miss at 21/23
  9: ["date-range"],
  10: ["filtered-group-by-count", "group-by-count", "join-aggregate"], // landed by the `filtered-group-by-count` pool row (named-entity grouped count through a JOIN); was the `having` demo at 20/23

  11: ["having"],
  12: ["anti-join"],
  13: ["group-order-limit", "join-aggregate"],
  14: ["having"],
  15: ["date-range"],
  16: ["anti-join"],
  17: ["date-range"],
  18: ["group-count-top-n", "join-aggregate", "group-order-limit", "group-by-count"], // now lands `group-count-top-n` (grouped COUNT ordered desc) — was `join-aggregate` (a SUM, the wrong aggregate)
  19: ["having"],
  // Batch 3 (SK-QUAL-018) — authored from each gold's structure.
  20: ["scalar-subquery"], // landed by the "Which … ? List the …" exemplar framing (no longer a miss)
  21: ["count-distinct"], // COUNT(DISTINCT referrer_id) — landed by the "different cities" exemplar phrasing (no longer a miss)
  22: ["join-aggregate-filter"], // landed by the `join-aggregate-filter` pool row (a scalar COUNT over a JOIN with a name + NULL filter); was a `date-range` miss at 22/23
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

  it("retrieves a structurally-appropriate demo for 23/23 ICP queries", () => {
    const m = measure();
    // Surface the numbers in the run log for the verification record.
    console.info("[persona-retrieval] measure:", JSON.stringify(m));
    // 23/23: the null-filter row lands q3 ("who never logged in") on IS-NULL, the
    // order-by-limit row lands q0 ("the 10 most recent signups") on the plain
    // ORDER BY … LIMIT demo, the count-distinct row's "how many different"
    // phrasing lands q21 ("how many different referral sources") instead of
    // `group-by-count`, the scalar-subquery row's "Which … ? List the …" framing
    // lands q20 ("which plans cost more than the average plan price") instead of
    // `having`, the `filtered-group-by-count` row (a named-entity grouped count
    // through a JOIN) lands q10 ("which predicates does the agent named
    // 'support-bot' use, and how often") instead of `having`, the
    // `group-count-top-n` row (top-N groups WITH their count) lands q8 ("the 5
    // most-recalled facts … and how many times") off `ratio-cast` AND improves
    // q18 ("for each agent, how many times … most recalled first") from
    // `join-aggregate` (a SUM, the wrong aggregate) to the grouped-COUNT demo,
    // and the new `join-aggregate-filter` row (a scalar COUNT over a JOIN with a
    // name + NULL filter) lands q22 ("how many of 'support-bot' facts have no
    // expiry date") off `date-range`. All were structural pool gaps closed by
    // pool curation (adding/rephrasing a row), not selector tweaks
    // (run-52-falsified — that verdict is scoped to selector-code tweaks, NOT
    // pool curation; see the q22 note below).
    expect(m.hits).toBeGreaterThanOrEqual(23);
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

  // q22 was the last miss; it is now landed by the `join-aggregate-filter` pool
  // row (run 105) — see the dedicated test below. It was NOT selector-unfixable:
  // the earlier "out of scope for a pool-row add / needs query-skeleton
  // similarity" read mistook a missing structural bucket for a selector limit.
  // q22's gold is a *scalar* COUNT(*) over a JOIN with a name + NULL filter, and
  // the pool's only scalar-COUNT demo was `date-range` (single-table), so q22
  // masked to it — the same missing-bucket class as q10/q8, closed the same
  // pool-curation way.
  //
  // NOTE: q21 (run 68), q20 (run 76), q10 (run 99) and q8 (run 100) were all NOT
  // selector-unfixable — q21/q20 were exemplar-phrasing leaks (the count-distinct
  // row echoed the SQL keyword "distinct" while users say "how many different";
  // the scalar-subquery row read as a bare "List the names of products priced
  // above…" while users ask "Which … cost … the average …? List the … names"),
  // and q10/q8 were missing structural buckets (q10: a named-entity grouped count
  // through a JOIN, which neither `group-by-count` nor `join-aggregate`
  // demonstrated — closed by `filtered-group-by-count`; q8: top-N groups WITH
  // their count, which neither `group-order-limit` (top key only, no count) nor
  // `group-by-count` (no ranking) demonstrated — closed by `group-count-top-n`).
  // Each was fixed by pool curation — rephrasing or adding a row to match how
  // users phrase the shape — holding the held-out probe at full precision@1 each
  // time. So the run-52 "lexical avenue is dead" verdict is scoped to
  // SELECTOR-code tweaks (stopwords / phrase normalisation in few-shot-select.ts),
  // NOT to pool-exemplar curation.
  //
  // The cheaper LEXICAL-selector avenue is measured-and-rejected (2026-06-22,
  // run 52 — quality-score-verification-log.md): a stopword filter regresses ICP
  // precision@1 and phrase normalisation leaves it flat, both keeping held-out
  // 14/14. Root cause: q22's top-1 `date-range` wins on generic filler plus a
  // coincidental masked literal slot (`val` — both questions happen to contain a
  // literal), which flat masked-token Jaccard cannot separate from a real
  // structural token. Do NOT re-attempt a lexical SELECTOR-code tweak here — but
  // that verdict never blocked adding the missing scalar-filtered-count bucket,
  // which is what landed q22 (run 105) and is pool curation, not a selector tweak.
  //
  // q8 ("the 5 most-recalled facts … and how many times") is a top-N-groups-with-
  // count (GROUP BY object, COUNT(*), ORDER BY COUNT(*) DESC, LIMIT 5). The
  // `group-count-top-n` pool row (run 100) now lands it top-1 — was a `ratio-cast`
  // miss at 21/23 (the generic "what are the … " skeleton mis-ranked it). Pinned
  // so a regression is visible as a delta. The same row also moves q18 ("for each
  // agent, how many times … most recalled first") off `join-aggregate` (a SUM,
  // the wrong aggregate) onto the grouped-COUNT demo.
  it("the group-count-top-n row lands q8 ('5 most-recalled … and how many times') off `ratio-cast`", () => {
    const q8 = PERSONA_BENCH_QUESTIONS.find((q) => q.question_id === 8);
    const [top] = retrievePlanExemplars(q8?.question ?? "", ddlFor(q8?.db_id ?? "agent_memory"), 1);
    expect(top?.bucket).toBe("group-count-top-n");
    // …while the unfiltered grouped count (q7, "how many facts does each agent
    // have? show the agent name and the count") must NOT be pulled to the ranked
    // top-N — it stays `group-by-count` (no ORDER BY/LIMIT in the goal).
    const q7 = PERSONA_BENCH_QUESTIONS.find((q) => q.question_id === 7);
    const [g] = retrievePlanExemplars(q7?.question ?? "", ddlFor(q7?.db_id ?? "agent_memory"), 1);
    expect(g?.bucket).toBe("group-by-count");
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

  // q22 ("how many of 'support-bot' facts have no expiry date") is a scalar
  // COUNT(*) over a filtered JOIN (JOIN to resolve the name + WHERE name = <val>
  // + WHERE expires_at IS NULL, NO GROUP BY). The `join-aggregate-filter` pool
  // row (run 105) now lands it top-1 — was a `date-range` miss at 22/23 (the
  // "how many … date" tokens pulled it to the single-table range scan, teaching
  // no join and no NULL filter). Pinned so a regression is visible as a delta.
  it("the join-aggregate-filter row lands q22 ('… have no expiry date') off `date-range`", () => {
    const q22 = PERSONA_BENCH_QUESTIONS.find((q) => q.question_id === 22);
    const [top] = retrievePlanExemplars(
      q22?.question ?? "",
      ddlFor(q22?.db_id ?? "agent_memory"),
      1,
    );
    expect(top?.bucket).toBe("join-aggregate-filter");
    // …while the unfiltered grouped count (q7, "how many facts does each agent
    // have? show the agent name and the count") must NOT be pulled to the scalar
    // filtered count — it stays `group-by-count` (a per-key breakdown, not one
    // number, and no NULL filter).
    const q7 = PERSONA_BENCH_QUESTIONS.find((q) => q.question_id === 7);
    const [g] = retrievePlanExemplars(q7?.question ?? "", ddlFor(q7?.db_id ?? "agent_memory"), 1);
    expect(g?.bucket).toBe("group-by-count");
  });
});
