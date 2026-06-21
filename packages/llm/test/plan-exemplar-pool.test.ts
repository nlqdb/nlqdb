import { describe, expect, it } from "vitest";

import { maskWithSchema, questionSimilarity } from "../src/few-shot-select.ts";
import {
  type PlanBucket,
  PLAN_EXEMPLAR_POOL,
  retrievePlanExemplars,
} from "../src/plan-exemplar-pool.ts";

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
    schema: "CREATE TABLE authors (id INTEGER, name TEXT);\nCREATE TABLE books (id INTEGER, author_id INTEGER)",
  },
  {
    bucket: "join-aggregate",
    goal: "What is the total payment for each member? Return the member name and total.",
    schema: "CREATE TABLE members (id INTEGER, name TEXT);\nCREATE TABLE payments (id INTEGER, member_id INTEGER, amount REAL)",
  },
  {
    bucket: "group-max",
    goal: "What is the highest score in each class?",
    schema: "CREATE TABLE students (id INTEGER, name TEXT, class TEXT, score REAL)",
  },
  {
    bucket: "null-safe-min",
    goal: "Which product has the lowest price? Return its name.",
    schema: "CREATE TABLE products (id INTEGER, name TEXT, price REAL)",
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
    expect(PLAN_EXEMPLAR_POOL.length).toBe(10);
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
});
