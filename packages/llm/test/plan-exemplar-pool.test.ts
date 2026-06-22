import { describe, expect, it } from "vitest";

import {
  maskWithSchema,
  questionSimilarity,
  selectExemplarsForSchema,
} from "../src/few-shot-select.ts";
import {
  buildPlanSystem,
  PLAN_EXEMPLAR_POOL,
  type PlanBucket,
  type PlanExemplar,
  retrievePlanExemplars,
} from "../src/plan-exemplar-pool.ts";
import { PLAN_DIRECTIVES, PLAN_FEW_SHOT_HEADER, PLAN_SYSTEM } from "../src/prompts.ts";

// Held-out probes: each is a paraphrase of one pool bucket over a **different**
// schema/domain, so a top-1 retrieval that lands the intended bucket is proof
// the masking generalises across domains (DAIL §4.1), not lexical luck.
type Probe = { bucket: PlanBucket; goal: string; schema: string };

const PROBES: readonly Probe[] = [
  {
    bucket: "group-by-count",
    goal: "How many students are in each grade?",
    schema: "CREATE TABLE students (id INTEGER, name TEXT, grade TEXT)",
  },
  {
    bucket: "having",
    goal: "Which products have received more than 3 reviews? Return the product id.",
    schema: "CREATE TABLE reviews (id INTEGER, product_id INTEGER, stars INTEGER)",
  },
  {
    bucket: "count-distinct",
    goal: "How many distinct countries do users come from?",
    schema: "CREATE TABLE users (id INTEGER, name TEXT, country TEXT)",
  },
  {
    bucket: "scalar-subquery",
    goal: "List the titles of books priced above the average price.",
    schema: "CREATE TABLE books (id INTEGER, title TEXT, price REAL)",
  },
  {
    bucket: "in-subquery",
    goal: "Which authors have written a book? Return their name.",
    schema:
      "CREATE TABLE authors (id INTEGER, name TEXT);\nCREATE TABLE books (id INTEGER, author_id INTEGER)",
  },
  {
    // The negated near-twin of the in-subquery probe — differs only by "never".
    // It must retrieve anti-join, not the positive in-subquery row (and the
    // in-subquery probe above must still retrieve in-subquery, not anti-join):
    // the bidirectional masking test that the skeletons stay distinguishable.
    bucket: "anti-join",
    goal: "Which authors have never written a book? Return their name.",
    schema:
      "CREATE TABLE authors (id INTEGER, name TEXT);\nCREATE TABLE books (id INTEGER, author_id INTEGER)",
  },
  {
    bucket: "join-aggregate",
    goal: "What is the total payment for each member? Return the member name and total.",
    schema:
      "CREATE TABLE members (id INTEGER, name TEXT);\nCREATE TABLE payments (id INTEGER, member_id INTEGER, amount REAL)",
  },
  {
    bucket: "group-max",
    goal: "What is the highest score in each class?",
    schema: "CREATE TABLE students (id INTEGER, name TEXT, class TEXT, score REAL)",
  },
  {
    bucket: "group-order-limit",
    goal: "Which class has the most students? Return the class.",
    schema: "CREATE TABLE students (id INTEGER, name TEXT, class TEXT)",
  },
  {
    bucket: "null-safe-min",
    goal: "Which product has the lowest price? Return its name.",
    schema: "CREATE TABLE products (id INTEGER, name TEXT, price REAL)",
  },
  {
    // "Never <attribute>" → a plain IS-NULL filter, over a different schema +
    // phrasing than the pool row ("logged into the portal" vs "logged in",
    // members vs users) — proves cross-schema reuse, not a copy of the row.
    bucket: "null-filter",
    goal: "Which members have never logged into the portal? Return their email.",
    schema: "CREATE TABLE members (id INTEGER, email TEXT, last_login TEXT)",
  },
  {
    bucket: "ratio-cast",
    goal: "What is the revenue per employee in office 5?\nEvidence: revenue per employee = revenue / employees",
    schema: "CREATE TABLE offices (id INTEGER, revenue INTEGER, employees INTEGER)",
  },
  {
    bucket: "date-range",
    goal: "How many payments were made in 2022?",
    schema: "CREATE TABLE payments (id INTEGER, pay_date TEXT, amount REAL)",
  },
];

// Masked-skeleton similarity of a probe to a pool row, each masked against its
// own schema — the exact quantity `selectExemplarsForSchema` ranks on.
const sim = (probe: Probe, rowQ: string, rowSchema: string): number =>
  questionSimilarity(maskWithSchema(probe.goal, probe.schema), maskWithSchema(rowQ, rowSchema));

// The offline retrieval measurement, recorded in the verification log:
//  - precisionAt1: fraction of probes whose top-1 retrieval is the intended bucket.
//  - meanSimRetrieved: mean masked similarity of each probe to its top-1 row.
//  - meanSimPool: mean masked similarity of each probe averaged over the *whole*
//    pool — what an uninformed fixed prefix averages.
//  - lift: meanSimRetrieved − meanSimPool, the structural-closeness gain
//    retrieval buys over a one-size-fits-all prefix (DAIL's measured win).
function measure() {
  let hits = 0;
  let sumRetrieved = 0;
  let sumPool = 0;
  for (const p of PROBES) {
    const [top] = retrievePlanExemplars(p.goal, p.schema, 1);
    if (top?.bucket === p.bucket) hits++;
    sumRetrieved += top ? sim(p, top.question, top.schema) : 0;
    const poolMean =
      PLAN_EXEMPLAR_POOL.reduce((acc, r) => acc + sim(p, r.question, r.schema), 0) /
      PLAN_EXEMPLAR_POOL.length;
    sumPool += poolMean;
  }
  const n = PROBES.length;
  return {
    precisionAt1: hits / n,
    meanSimRetrieved: sumRetrieved / n,
    meanSimPool: sumPool / n,
    lift: sumRetrieved / n - sumPool / n,
  };
}

describe("plan-exemplar-pool", () => {
  it("covers one row per structural bucket, all distinct", () => {
    const buckets = PLAN_EXEMPLAR_POOL.map((r) => r.bucket);
    expect(new Set(buckets).size).toBe(buckets.length);
    expect(PLAN_EXEMPLAR_POOL.length).toBe(13);
  });

  it("renders each payload in the static-prefix Question→JSON shape", () => {
    for (const r of PLAN_EXEMPLAR_POOL) {
      expect(r.payload).toContain(`Goal: ${r.question.split("\n")[0]}`);
      expect(r.payload).toContain('{"sql":');
    }
  });

  it("retrieves the intended structural bucket top-1 across domains (precision@1 = 1)", () => {
    const m = measure();
    // Surface the numbers in the run log for the verification record.
    console.info("[plan-exemplar-pool] retrieval measure:", JSON.stringify(m));
    expect(m.precisionAt1).toBe(1);
  });

  it("retrieval beats an uninformed fixed pick (lift > 0)", () => {
    const m = measure();
    expect(m.lift).toBeGreaterThan(0);
    // The retrieved exemplar is structurally much closer than the pool average.
    expect(m.meanSimRetrieved).toBeGreaterThan(2 * m.meanSimPool);
  });

  it("masks the goal to a cross-domain skeleton: a twin over an unrelated schema ranks top", () => {
    // The group-by-count probe (students/grade) must out-rank every other
    // bucket even though it shares no domain nouns with the employees/department
    // pool row — masking collapses both to "How many col are in each col".
    const probe = PROBES.find((p) => p.bucket === "group-by-count");
    expect(probe).toBeDefined();
    const [top] = retrievePlanExemplars(probe?.goal ?? "", probe?.schema ?? "", 1);
    expect(top?.bucket).toBe("group-by-count");
  });

  // The measured coverage delta for adding the anti-join row: the same probe,
  // before (pool without anti-join) vs after (full pool). Before, a "never …"
  // goal's nearest demonstration is the *positive* in-subquery row — the
  // un-negated shape, which would teach the model to drop the negation; after,
  // it retrieves the NOT IN exemplar. This is the SK-LLM-036/037 same-probe
  // before/after pattern, the unit that earns the pool row a dispatch.
  it("anti-join row flips a 'never' goal from the positive in-subquery demo to the negation demo", () => {
    const probe = PROBES.find((p) => p.bucket === "anti-join");
    expect(probe).toBeDefined();
    const goal = probe?.goal ?? "";
    const schema = probe?.schema ?? "";

    // Before: rank against the pool as it was before *either* "never"-bearing
    // row existed (anti-join + the later null-filter, which also carries
    // "never") — the historical state this delta documents.
    const before = selectExemplarsForSchema(
      goal,
      schema,
      PLAN_EXEMPLAR_POOL.filter((r) => r.bucket !== "anti-join" && r.bucket !== "null-filter"),
      1,
    ) as PlanExemplar[];
    expect(before[0]?.bucket).toBe("in-subquery");

    // After: the full pool retrieves the negation demonstration top-1.
    const [after] = retrievePlanExemplars(goal, schema, 1);
    expect(after?.bucket).toBe("anti-join");
    expect(after?.payload).toContain("NOT IN");

    // And the bidirectional guard: the positive in-subquery probe must NOT be
    // pulled to anti-join now that the near-twin exists in the pool.
    const inSub = PROBES.find((p) => p.bucket === "in-subquery");
    const [posTop] = retrievePlanExemplars(inSub?.goal ?? "", inSub?.schema ?? "", 1);
    expect(posTop?.bucket).toBe("in-subquery");
  });

  // The null-filter row's measured coverage delta: "never <attribute>" (a NULL
  // column on the row itself) must retrieve the IS-NULL demo, not the anti-join
  // NOT-IN demo — while "never <relation>" (absence in a related table) stays
  // anti-join. Same SK-LLM-036/037 same-probe before/after pattern. This is the
  // shape persona-bench q3 ("who never logged in") needs (ICP retrieval
  // precision@1 18/20 → 19/20, the `tools/eval` persona-retrieval probe).
  it("null-filter row flips a 'never logged in' goal from the anti-join demo to the IS NULL demo", () => {
    const probe = PROBES.find((p) => p.bucket === "null-filter");
    expect(probe).toBeDefined();
    const goal = probe?.goal ?? "";
    const schema = probe?.schema ?? "";

    // Before: rank against the pool with the null-filter row removed — the
    // "never" token pulls the anti-join NOT-IN demonstration (the wrong shape).
    const before = selectExemplarsForSchema(
      goal,
      schema,
      PLAN_EXEMPLAR_POOL.filter((r) => r.bucket !== "null-filter"),
      1,
    ) as PlanExemplar[];
    expect(before[0]?.bucket).toBe("anti-join");

    // After: the full pool retrieves the IS NULL demonstration top-1.
    const [after] = retrievePlanExemplars(goal, schema, 1);
    expect(after?.bucket).toBe("null-filter");
    expect(after?.payload).toContain("IS NULL");

    // The guard: a "never <relation>" goal (absence in a related table) must
    // still go to anti-join — the verb, not just "never", is the discriminator.
    const antiJoin = PROBES.find((p) => p.bucket === "anti-join");
    const [ajTop] = retrievePlanExemplars(antiJoin?.goal ?? "", antiJoin?.schema ?? "", 1);
    expect(ajTop?.bucket).toBe("anti-join");
  });
});

describe("buildPlanSystem — SK-LLM-041 half (b), the per-lever T9 ablation", () => {
  const probe = PROBES.find((p) => p.bucket === "group-by-count");
  if (!probe) throw new Error("missing group-by-count probe");

  it("default off (k <= 0 / NaN) returns the static PLAN_SYSTEM byte-for-byte (SK-LLM-024)", () => {
    // Every production call leaves retrieveExemplars unset ⇒ k = 0. The off
    // path must be the static prefix *exactly*, or the greedy baseline shifts.
    for (const k of [0, -1, Number.NaN]) {
      expect(buildPlanSystem(probe.goal, probe.schema, k)).toBe(PLAN_SYSTEM);
    }
  });

  it("k > 0 swaps the static SK-LLM-026 prefix for retrieved exemplars, keeping the directives", () => {
    const prompt = buildPlanSystem(probe.goal, probe.schema, 3);
    // Directives untouched; few-shot header preserved (byte-identical shape).
    expect(prompt.startsWith(`${PLAN_DIRECTIVES}\n\n${PLAN_FEW_SHOT_HEADER}`)).toBe(true);
    // The static prefix's exemplars are gone — this is an *ablation* of T9, not
    // an addition on top of it (the 'Queen' album demo is unique to the static
    // prefix; no pool row mentions it).
    expect(prompt).not.toContain("'Queen'");
    // The retrieved demonstrations are present: the top-1 row's SQL appears.
    const [top] = retrievePlanExemplars(probe.goal, probe.schema, 3);
    expect(top).toBeDefined();
    expect(prompt).toContain(top?.payload ?? "<none>");
  });

  it("a goal that retrieves nothing falls back to the static prefix (never an empty block)", () => {
    // No structural/lexical overlap with any bucket ⇒ zero-similarity ⇒ no
    // retrieval; buildPlanSystem must not emit a header with no examples.
    const prompt = buildPlanSystem("xyzzy plugh", "CREATE TABLE qux (zzz INTEGER)", 3);
    expect(prompt).toBe(PLAN_SYSTEM);
  });

  it("token budget: the retrieved k=3 prefix stays within ~1.3× the static prefix", () => {
    // The cost number a reviewer wants before spending dispatch quota: the
    // retrieved few-shot prefix is bounded, not unboundedly larger than T9.
    const staticLen = PLAN_SYSTEM.length;
    const retrievedLen = buildPlanSystem(probe.goal, probe.schema, 3).length;
    console.info(
      "[buildPlanSystem] prefix chars — static:",
      staticLen,
      "retrieved(k=3):",
      retrievedLen,
      "ratio:",
      (retrievedLen / staticLen).toFixed(3),
    );
    expect(retrievedLen).toBeGreaterThan(PLAN_DIRECTIVES.length);
    expect(retrievedLen).toBeLessThan(staticLen * 1.3);
  });
});
