// Deterministic docs→memory extractor — the runnable producer behind the
// dogfood track's `D-02` (re-sync hook) and `D-04` (first corpus sync).
//
// D-01 shipped the *skill* (`agent-artifacts/nlqdb-docs-memory/SKILL.md`) —
// instructions for a coding agent. That is the right shape for an external
// repo, but nlqdb's own CI can't run an agent for free ($0 ladder), and
// criterion 1 ("≥ 100 real /v1/ask calls from the ops workload") needs a
// producer that runs unattended on every docs merge. This module is that
// producer: a pure, deterministic, **no-LLM** extractor of the same structure
// SK-PIVOT-017 defines — structure only, never prose. It has no network and no
// secret, so it runs and is measured entirely offline; the authenticated,
// convergent write path (which fact rows need a read-before-write for, since
// facts are append-only) is `D-02b`.
//
// Extracted v1 structures (the two that power the skill's flagship queries —
// "which features have open questions" and "what is blocked, and since when"):
//   - open questions per feature  → entity(feature) + fact(open_question)
//   - the blocked-by-human queue  → entity(queue_item) + fact(blocked)
//
// Every fact carries `source.{path,key,digest}`: the `key` is stable across
// unrelated edits so re-runs converge on it, and the `digest` is what makes a
// re-run cheap (same key + same digest ⇒ nothing to write). See SK-PIVOT-017's
// "Sync protocol".

/** A row for the `nlqdb_remember` `entity` verb (upserts on kind+name). */
export type MemoryEntity = {
  kind: string;
  canonical_name: string;
  properties?: Record<string, unknown>;
};

/** A row for the `nlqdb_remember` `fact` verb, keyed for convergent re-sync. */
export type MemoryFact = {
  content: string;
  kind: string;
  tags: string[];
  source: { path: string; key: string; digest: string };
};

export type Extraction = { entities: MemoryEntity[]; facts: MemoryFact[] };

/**
 * FNV-1a 32-bit, hex. Deterministic and dependency-free — the point is a
 * stable short fingerprint of an extracted value so re-runs can skip unchanged
 * rows, not cryptographic strength.
 */
export function digest(value: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Every decision id a line mentions — the cheapest cross-reference link. */
export function idsIn(text: string): string[] {
  const ids = text.match(/\b(?:GLOBAL-\d+|SK-[A-Z]+-\d+)\b/g) ?? [];
  return [...new Set(ids)];
}

/** `docs/features/elements/FEATURE.md` → `elements`. */
export function featureSlug(path: string): string {
  return path.replace(/.*\/features\//, "").replace(/\/FEATURE\.md$/, "");
}

function slugify(text: string, max = 60): string {
  return text
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// The pinned open-question method (scorecard row #17): a top-level `- ` bullet
// under `## Open questions`, up to the next `## `, that does NOT read as a
// resolved / parked / deferred decision. A "Parked until <trigger>" line is a
// resolved decision-to-defer (GLOBAL-033), so it is not an open question.
const RESOLVED_MARKERS = /Resolved|Shipped|~~|Parked|Deferred|Decided:|Closed/i;

/**
 * Extract the still-open questions from one `FEATURE.md`. Only the section
 * under a `## Open questions…` heading is considered, and only its top-level
 * `- ` bullets (continuation lines belong to the bullet above them).
 */
export function extractOpenQuestions(path: string, content: string): Extraction {
  const slug = featureSlug(path);
  const lines = content.split("\n");
  const facts: MemoryFact[] = [];
  let inSection = false;

  for (const line of lines) {
    if (/^## /.test(line)) {
      inSection = /^## Open questions/i.test(line);
      continue;
    }
    if (!inSection) continue;
    if (!/^- /.test(line)) continue; // top-level bullets only
    if (RESOLVED_MARKERS.test(line)) continue;

    const text = collapse(line.replace(/^- /, ""));
    if (!text) continue;
    const headline = collapse(text.split(/[—.]/)[0] ?? text).slice(0, 200);
    const tags = [slug, ...idsIn(text)];
    facts.push({
      content: `open question in ${slug}: ${headline}`,
      kind: "open_question",
      tags,
      source: {
        path,
        key: `${path}#oq:${slugify(headline)}`,
        digest: digest(text),
      },
    });
  }

  if (facts.length === 0) return { entities: [], facts: [] };
  return {
    entities: [{ kind: "feature", canonical_name: slug }],
    facts,
  };
}

/**
 * Extract the blocked-by-human queue from its "At a glance" table. Each numbered
 * row becomes a `queue_item` entity and a `blocked` fact carrying the task and
 * the date it has been blocked since — the "what is blocked, and since when"
 * query the skill exists for.
 */
export function extractBlockedQueue(path: string, content: string): Extraction {
  const entities: MemoryEntity[] = [];
  const facts: MemoryFact[] = [];

  for (const line of content.split("\n")) {
    // | 1 | ~30 min | Do this … | 2026-06-13 |
    const m = line.match(/^\|\s*(\d+)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|/);
    if (!m) continue;
    const num = m[1] ?? "";
    const estimate = collapse(m[2] ?? "");
    const task = collapse(m[3] ?? "");
    const since = collapse(m[4] ?? "");
    if (!task) continue;

    entities.push({ kind: "queue_item", canonical_name: `queue-${num}` });
    facts.push({
      content: `blocked (queue #${num}, since ${since || "unknown"}): ${task}`,
      kind: "blocked",
      tags: ["blocked", `queue-${num}`, ...idsIn(task)],
      source: {
        path,
        key: `${path}#queue:${num}`,
        digest: digest(`${task}|${since}|${estimate}`),
      },
    });
  }

  return { entities, facts };
}

/** Merge many extractions into one, de-duplicating entities on kind+name. */
export function mergeExtractions(parts: Extraction[]): Extraction {
  const facts = parts.flatMap((p) => p.facts);
  const seen = new Set<string>();
  const entities: MemoryEntity[] = [];
  for (const e of parts.flatMap((p) => p.entities)) {
    const dedupeKey = `${e.kind}:${e.canonical_name}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    entities.push(e);
  }
  return { entities, facts };
}

/**
 * Extract the whole corpus from a set of `{path, content}` files. `FEATURE.md`
 * files contribute open questions; `blocked-by-human.md` contributes the queue.
 */
export function extractCorpus(files: { path: string; content: string }[]): Extraction {
  const parts: Extraction[] = [];
  for (const { path, content } of files) {
    if (/\/features\/[^/]+\/FEATURE\.md$/.test(path)) {
      parts.push(extractOpenQuestions(path, content));
    } else if (/blocked-by-human\.md$/.test(path)) {
      parts.push(extractBlockedQueue(path, content));
    }
  }
  return mergeExtractions(parts);
}
