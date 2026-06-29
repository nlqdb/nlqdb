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
    // Grouped count scoped to one named entity through a JOIN, over a different
    // schema + word order than the pool row ("How often does each tag appear for
    // the project named …" vs "Which roles appear for the department named …") —
    // proves the filtered-grouped-count skeleton retrieves across domains and is
    // not pulled to the unfiltered `group-by-count` / `join-aggregate` near-twins.
    bucket: "filtered-group-by-count",
    goal: "How often does each tag appear for the project named 'Apollo'?",
    schema:
      "CREATE TABLE projects (id INTEGER, name TEXT);\nCREATE TABLE issues (id INTEGER, project_id INTEGER, tag TEXT)",
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
    // Top-N groups WITH their count, over a different schema + phrasing than the
    // pool row ("most-cited papers" vs "most-borrowed books") — proves the
    // GROUP-BY-COUNT-ORDER-BY-COUNT-DESC-LIMIT skeleton retrieves across domains
    // and is not pulled to the count-less `group-order-limit` or the unranked
    // `group-by-count` near-twins.
    bucket: "group-count-top-n",
    goal: "What are the 3 most-cited papers? Show the paper and how many times each was cited.",
    schema: "CREATE TABLE citations (id INTEGER, paper TEXT)",
  },
  {
    // Plain top-N over a different schema + phrasing than the pool row
    // ("transactions" vs "orders") — proves the plain `ORDER BY … LIMIT`
    // skeleton retrieves across domains and is not pulled to the grouped
    // `group-order-limit` near-twin.
    bucket: "order-by-limit",
    goal: "List the 3 most recent transactions. Return the amount.",
    schema: "CREATE TABLE payments (id INTEGER, txn_date TEXT, amount REAL)",
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
  {
    // Scalar COUNT(*) over a JOIN with a named-entity filter AND a NULL
    // predicate, over a different schema + phrasing than the pool row
    // ("invoices for the vendor 'Globex' … no paid date" vs "orders for customer
    // 'Acme' … no delivery date") — proves the scalar-filtered-count skeleton
    // retrieves across domains and is not pulled to the single-table
    // `date-range` or the grouped `filtered-group-by-count` near-twins.
    bucket: "join-aggregate-filter",
    goal: "How many invoices for the vendor 'Globex' have no paid date?",
    schema:
      "CREATE TABLE vendors (id INTEGER, name TEXT);\nCREATE TABLE invoices (id INTEGER, vendor_id INTEGER, paid_at TEXT)",
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
    expect(PLAN_EXEMPLAR_POOL.length).toBe(17);
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
  // precision@1 17/20 → 18/20, the `tools/eval` persona-retrieval probe).
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

  // The order-by-limit row's measured coverage delta: a plain top-N goal ("the N
  // most recent X" — `ORDER BY <col> DESC LIMIT n`, no aggregation) must retrieve
  // the plain ORDER BY … LIMIT demo, not the `group-order-limit` demo (GROUP BY →
  // ORDER BY agg → LIMIT), which would teach a spurious aggregation. Meanwhile a
  // genuinely *grouped* top-N ("which X has the most Y") stays group-order-limit.
  // Same SK-LLM-036/037 before/after pattern; this is the shape persona-bench q0
  // ("the 10 most recent signups") needs (ICP retrieval probe in `tools/eval`).
  it("order-by-limit row flips a plain top-N goal off the grouped group-order-limit demo", () => {
    const probe = PROBES.find((p) => p.bucket === "order-by-limit");
    expect(probe).toBeDefined();
    const goal = probe?.goal ?? "";
    const schema = probe?.schema ?? "";

    // Before: rank against the pool with the order-by-limit row removed — the
    // nearest demo is `group-order-limit`, the grouped top-N (wrong skeleton).
    const before = selectExemplarsForSchema(
      goal,
      schema,
      PLAN_EXEMPLAR_POOL.filter((r) => r.bucket !== "order-by-limit"),
      1,
    ) as PlanExemplar[];
    expect(before[0]?.bucket).toBe("group-order-limit");

    // After: the full pool retrieves the plain ORDER BY … LIMIT demonstration.
    const [after] = retrievePlanExemplars(goal, schema, 1);
    expect(after?.bucket).toBe("order-by-limit");
    expect(after?.payload).toContain("LIMIT");
    expect(after?.payload).not.toContain("GROUP BY");

    // The guard: a grouped top-N ("which X has the most Y") must still retrieve
    // group-order-limit — the aggregate, not just "most", is the discriminator.
    const grouped = PROBES.find((p) => p.bucket === "group-order-limit");
    const [gTop] = retrievePlanExemplars(grouped?.goal ?? "", grouped?.schema ?? "", 1);
    expect(gTop?.bucket).toBe("group-order-limit");
  });

  // The filtered-group-by-count row's measured coverage delta: a grouped count
  // scoped to one named entity through a JOIN ("which X does the Y named '<val>'
  // use, and how often") must retrieve the filtered demo. Without the row the
  // nearest demo is `join-aggregate` (a SUM over a join, no GROUP-BY-COUNT and no
  // named-entity filter) — the wrong skeleton. Meanwhile an *unfiltered* grouped
  // count ("how many X in each Y") stays group-by-count. Same SK-LLM-036/037
  // before/after pattern; this is the shape persona-bench q10 ("which predicates
  // does the agent named 'support-bot' use, and how often") needs (ICP retrieval
  // probe in `tools/eval`); on q10 itself the displaced demo is `having`.
  it("filtered-group-by-count row flips a named-entity grouped count off the nearest unfiltered demo", () => {
    const probe = PROBES.find((p) => p.bucket === "filtered-group-by-count");
    expect(probe).toBeDefined();
    const goal = probe?.goal ?? "";
    const schema = probe?.schema ?? "";

    // Before: rank against the pool with the filtered row removed — the nearest
    // demo is `join-aggregate`, an unfiltered SUM-over-join (wrong skeleton).
    const before = selectExemplarsForSchema(
      goal,
      schema,
      PLAN_EXEMPLAR_POOL.filter((r) => r.bucket !== "filtered-group-by-count"),
      1,
    ) as PlanExemplar[];
    expect(before[0]?.bucket).toBe("join-aggregate");

    // After: the full pool retrieves the filtered demonstration top-1.
    const [after] = retrievePlanExemplars(goal, schema, 1);
    expect(after?.bucket).toBe("filtered-group-by-count");
    expect(after?.payload).toContain("WHERE");
    expect(after?.payload).toContain("GROUP BY");
    expect(after?.payload).not.toContain("HAVING");

    // The guard: an *unfiltered* grouped count ("how many X in each Y") must still
    // retrieve group-by-count — the named-entity WHERE filter, not just GROUP BY,
    // is the discriminator.
    const plain = PROBES.find((p) => p.bucket === "group-by-count");
    const [pTop] = retrievePlanExemplars(plain?.goal ?? "", plain?.schema ?? "", 1);
    expect(pTop?.bucket).toBe("group-by-count");
  });

  // The group-count-top-n row's measured coverage delta: a "top-N groups with
  // their count" goal ("what are the N most-<verb> X? show the X and how many
  // times each was <verb>") must retrieve the GROUP-BY-COUNT-ORDER-BY-COUNT-DESC
  // demo. Without the row the nearest demo is `group-by-count` — a grouped count
  // with no ranking, which teaches no ORDER BY/LIMIT. Meanwhile a genuinely
  // *grouped* top-N that returns only the top key ("which X has the most Y")
  // stays group-order-limit. Same SK-LLM-036/037 before/after pattern; this is
  // the shape persona-bench q8 ("5 most-recalled facts … and how many times")
  // needs (ICP retrieval probe in `tools/eval`); on q8 itself the displaced demo
  // is `ratio-cast`.
  it("group-count-top-n row flips a top-N-with-count goal off the unranked group-by-count demo", () => {
    const probe = PROBES.find((p) => p.bucket === "group-count-top-n");
    expect(probe).toBeDefined();
    const goal = probe?.goal ?? "";
    const schema = probe?.schema ?? "";

    // Before: rank against the pool with the group-count-top-n row removed — the
    // nearest demo is `group-by-count`, a grouped count with no ranking.
    const before = selectExemplarsForSchema(
      goal,
      schema,
      PLAN_EXEMPLAR_POOL.filter((r) => r.bucket !== "group-count-top-n"),
      1,
    ) as PlanExemplar[];
    expect(before[0]?.bucket).toBe("group-by-count");

    // After: the full pool retrieves the ranked grouped-count demonstration.
    const [after] = retrievePlanExemplars(goal, schema, 1);
    expect(after?.bucket).toBe("group-count-top-n");
    expect(after?.payload).toContain("GROUP BY");
    expect(after?.payload).toContain("ORDER BY COUNT(*) DESC");
    expect(after?.payload).toContain("LIMIT");

    // The guard: a grouped top-N that returns only the top key ("which X has the
    // most Y") must still retrieve group-order-limit — returning the count, not
    // just the ranking, is the discriminator.
    const keyOnly = PROBES.find((p) => p.bucket === "group-order-limit");
    const [kTop] = retrievePlanExemplars(keyOnly?.goal ?? "", keyOnly?.schema ?? "", 1);
    expect(kTop?.bucket).toBe("group-order-limit");
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
