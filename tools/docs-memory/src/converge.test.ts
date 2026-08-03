import { describe, expect, test } from "bun:test";
import { existingFromRows, FACTS_READ_SQL, planWrites } from "./converge.ts";
import type { Extraction, MemoryFact } from "./extract.ts";

function fact(key: string, digest: string, content = key): MemoryFact {
  return {
    content,
    kind: "open_question",
    tags: [key],
    source: { path: "docs/x.md", key, digest },
  };
}

/** Index into an array under `noUncheckedIndexedAccess`, failing loudly if empty. */
function at<T>(arr: T[], i: number): T {
  const v = arr[i];
  if (v === undefined) throw new Error(`no element at index ${i} (length ${arr.length})`);
  return v;
}

const EX: Extraction = {
  entities: [{ kind: "feature", canonical_name: "auth" }],
  facts: [
    fact("auth-oq-1", "aaaa1111"),
    fact("auth-oq-2", "bbbb2222"),
    fact("cli-oq-1", "cccc3333"),
  ],
};

/** The index as `/v1/run` would report it after a set of facts was written. */
function indexAfter(...facts: MemoryFact[]) {
  return existingFromRows(facts.map((f) => ({ source: f.source })));
}

describe("existingFromRows", () => {
  test("maps key → digest from object-valued source columns", () => {
    const m = existingFromRows([{ source: { path: "p", key: "k1", digest: "d1" } }]);
    expect(m.get("k1")).toBe("d1");
  });

  test("tolerates a stringified JSONB column", () => {
    const m = existingFromRows([{ source: JSON.stringify({ key: "k2", digest: "d2" }) }]);
    expect(m.get("k2")).toBe("d2");
  });

  test("skips rows with no/partial/unparseable source", () => {
    const m = existingFromRows([
      { source: null },
      { source: "{not json" },
      { source: { key: "only-key" } },
      { source: { digest: "only-digest" } },
    ]);
    expect(m.size).toBe(0);
  });
});

describe("planWrites", () => {
  test("writes every fact against an empty index (first sync)", () => {
    const plan = planWrites(new Map(), EX);
    expect(plan.factsToWrite).toHaveLength(3);
    expect(plan.factsUnchanged).toHaveLength(0);
    expect(plan.entities).toHaveLength(1);
  });

  test("is idempotent: a second sync over an unchanged corpus writes 0 facts", () => {
    // Run 1 wrote everything; the index now reflects those exact rows.
    const index = indexAfter(...EX.facts);
    const plan = planWrites(index, EX);
    expect(plan.factsToWrite).toHaveLength(0);
    expect(plan.factsUnchanged).toHaveLength(3);
  });

  test("writes only the changed fact when one value moves", () => {
    // The index holds the old digest for cli-oq-1; the extraction now differs.
    const index = indexAfter(at(EX.facts, 0), at(EX.facts, 1), fact("cli-oq-1", "OLDdigest"));
    const plan = planWrites(index, EX);
    expect(plan.factsToWrite.map((f) => f.source.key)).toEqual(["cli-oq-1"]);
    expect(plan.factsUnchanged).toHaveLength(2);
  });

  test("writes a newly-appeared fact key", () => {
    const index = indexAfter(at(EX.facts, 0), at(EX.facts, 1)); // cli-oq-1 not yet stored
    const plan = planWrites(index, EX);
    expect(plan.factsToWrite.map((f) => f.source.key)).toEqual(["cli-oq-1"]);
  });
});

describe("FACTS_READ_SQL", () => {
  test("is a read-only SELECT over facts (the /v1/run convergence read)", () => {
    expect(FACTS_READ_SQL).toMatch(/^SELECT/);
    expect(FACTS_READ_SQL).toContain('"facts"');
    expect(FACTS_READ_SQL).not.toMatch(/INSERT|UPDATE|DELETE/i);
  });
});
