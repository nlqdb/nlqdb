import { describe, expect, test } from "bun:test";
import {
  digest,
  extractBlockedQueue,
  extractCorpus,
  extractOpenQuestions,
  featureSlug,
  idsIn,
  mergeExtractions,
} from "./extract.ts";

/** Index into an array under `noUncheckedIndexedAccess`, failing loudly if empty. */
function at<T>(arr: T[], i: number): T {
  const v = arr[i];
  if (v === undefined) throw new Error(`no element at index ${i} (length ${arr.length})`);
  return v;
}

describe("digest", () => {
  test("is deterministic and value-sensitive", () => {
    expect(digest("SK-AUTH-004 status: implemented")).toBe(
      digest("SK-AUTH-004 status: implemented"),
    );
    expect(digest("a")).not.toBe(digest("b"));
    expect(digest("")).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("idsIn", () => {
  test("finds GLOBAL and SK ids, de-duplicated", () => {
    expect(idsIn("touches GLOBAL-013 and SK-ELEM-007 and GLOBAL-013 again")).toEqual([
      "GLOBAL-013",
      "SK-ELEM-007",
    ]);
    expect(idsIn("no ids here")).toEqual([]);
  });
});

describe("featureSlug", () => {
  test("derives the slug from a FEATURE.md path", () => {
    expect(featureSlug("docs/features/elements/FEATURE.md")).toBe("elements");
    expect(featureSlug("/abs/docs/features/agent-memory-pivot/FEATURE.md")).toBe(
      "agent-memory-pivot",
    );
  });
});

const FEATURE_MD = `# Feature X

## Open questions / known unknowns

- **pk_live issuance is a Slice 11 deliverable.** Cross-origin embeds 401 today (SK-APIKEYS-003).
- **Write-token shape** decides TTL and rotation — tracked in api-keys.
- **SSE auto-upgrade — Parked until an embed asks for sub-second freshness.**
- **Theming approach** — Resolved per GLOBAL-033: stay strict on plain CSS.
  continuation line that must NOT become its own question.

## Something else

- this bullet is in another section and must be ignored.
`;

describe("extractOpenQuestions", () => {
  const { entities, facts } = extractOpenQuestions("docs/features/x/FEATURE.md", FEATURE_MD);

  test("keeps only the genuinely-open bullets under the section", () => {
    // pk_live + write-token are open; SSE (Parked) and Theming (Resolved) are not;
    // the continuation line and the other section are ignored.
    expect(facts.map((f) => f.kind)).toEqual(["open_question", "open_question"]);
    expect(at(facts, 0).content).toContain("open question in x:");
    expect(at(facts, 0).content).toContain("pk_live issuance");
  });

  test("emits exactly one feature entity when it has open questions", () => {
    expect(entities).toEqual([{ kind: "feature", canonical_name: "x" }]);
  });

  test("tags carry the feature slug and any ids in the bullet", () => {
    expect(at(facts, 0).tags).toContain("x");
    expect(at(facts, 0).tags).toContain("SK-APIKEYS-003");
  });

  test("no feature entity when a feature has no open questions", () => {
    const only = extractOpenQuestions(
      "docs/features/y/FEATURE.md",
      "## Open questions\n\n- Resolved: nothing open here.\n",
    );
    expect(only).toEqual({ entities: [], facts: [] });
  });
});

const BLOCKED_MD = `# Blocked by Human

## At a glance

| # | ⏱ | Do this | Blocked since |
|---|---|---|---|
| 1 | ~30 min | Fire the Show HN launch sequence | 2026-06-13 |
| 2 | ~2 min | Set the NLQDB_API_KEY GitHub repo secret | 2026-08-01 |

Only #1 can move real strangers.
`;

describe("extractBlockedQueue", () => {
  const { entities, facts } = extractBlockedQueue("docs/blocked-by-human.md", BLOCKED_MD);

  test("skips the header/separator and reads only numbered rows", () => {
    expect(entities).toEqual([
      { kind: "queue_item", canonical_name: "queue-1" },
      { kind: "queue_item", canonical_name: "queue-2" },
    ]);
    expect(facts).toHaveLength(2);
  });

  test("a blocked fact carries the task and the since-date", () => {
    expect(at(facts, 0).content).toBe(
      "blocked (queue #1, since 2026-06-13): Fire the Show HN launch sequence",
    );
    expect(at(facts, 0).source.key).toBe("docs/blocked-by-human.md#queue:1");
  });
});

describe("convergence keys and digests", () => {
  test("re-extracting an unchanged corpus yields identical keys and digests (idempotent)", () => {
    const first = extractCorpus([{ path: "docs/blocked-by-human.md", content: BLOCKED_MD }]);
    const second = extractCorpus([{ path: "docs/blocked-by-human.md", content: BLOCKED_MD }]);
    expect(second).toEqual(first);
  });

  test("editing a row's value changes only that row's digest, not its key", () => {
    const before = extractBlockedQueue("docs/blocked-by-human.md", BLOCKED_MD);
    const after = extractBlockedQueue(
      "docs/blocked-by-human.md",
      BLOCKED_MD.replace("2026-06-13", "2026-06-20"),
    );
    expect(at(after.facts, 0).source.key).toBe(at(before.facts, 0).source.key);
    expect(at(after.facts, 0).source.digest).not.toBe(at(before.facts, 0).source.digest);
    // an untouched row is byte-identical, so a converging sync writes nothing for it
    expect(at(after.facts, 1)).toEqual(at(before.facts, 1));
  });
});

describe("mergeExtractions", () => {
  test("de-duplicates entities on kind+name and keeps all facts", () => {
    const merged = mergeExtractions([
      { entities: [{ kind: "feature", canonical_name: "a" }], facts: [] },
      {
        entities: [{ kind: "feature", canonical_name: "a" }],
        facts: [
          {
            content: "x",
            kind: "open_question",
            tags: [],
            source: { path: "p", key: "k", digest: "d" },
          },
        ],
      },
    ]);
    expect(merged.entities).toHaveLength(1);
    expect(merged.facts).toHaveLength(1);
  });
});
