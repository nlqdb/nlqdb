// Goal pack #1, **repo-ops**, as instance #1 of the shared pack runner
// (D-08 / `SK-PIVOT-018` / `SK-PIVOT-021`).
//
// Everything here is pack judgment: how to name a GitHub repository, how
// to pin and acquire it, which files carry structure, and which
// `agent_memory_v1` rows each one becomes. The journey — draft, phases,
// counters, auth resume, reconciliation, cleanup — is the runner's and is
// not touched.
//
// The extraction recipe is **not re-implemented here**: the open-question
// and blocked-queue extractors are `@nlqdb/docs-memory` (D-01's skill,
// D-02a's runnable producer), imported so the recipe has exactly one home
// (`P3`) and the offline dry-run and the product import cannot drift. This
// module adds the two categories D-08's strategy table asks for that the
// offline producer did not need — decision records and cross-references.
//
// The row vocabulary is fixed by the `SK-QUAL-023` repo-ops eval corpus
// (`tools/eval/src/datasets/memory-quality.ts`), because D-03's golden
// queries are written against it: entity kinds `feature` / `decision` /
// `queue_item`; fact kinds `open_question` / `decision_status` /
// `reference` / `blocked`; episode role `sync`. Inventing new names here
// would silently un-answer the golden queries that gate the pack.

import {
  digest,
  extractBlockedQueue,
  extractOpenQuestions,
  featureSlug,
  idsIn,
} from "@nlqdb/docs-memory/extract";
import { fetchArchive, parseRepoInput, pinCommit } from "../github-source.ts";
import type {
  AcquireResult,
  ClassifyResult,
  MemoryRecord,
  PackAdapter,
  PackContext,
  SkipReason,
  SourceDescriptor,
  SourceItem,
  SourceParse,
} from "../types.ts";

const DECISION_ID = /\b(?:GLOBAL-\d+|SK-[A-Z]+-\d+)\b/;

/** Paths whose content is generated, vendored or lock-managed. */
const VENDOR_OR_GENERATED =
  /(?:^|\/)(?:node_modules|dist|build|out|vendor|third_party|coverage|\.git|\.next|\.astro)\//;
const LOCKED_OR_MINIFIED = /(?:\.lock|-lock\.json|\.min\.js|\.min\.css|\.map)$/;

/** A decision record: `<ID>-slug.md` inside a `decisions/` directory. */
function isDecisionRecord(path: string): boolean {
  const name = path.split("/").pop() ?? "";
  return /(?:^|\/)decisions\//.test(path) && DECISION_ID.test(name);
}

function isFeatureDoc(path: string): boolean {
  return /\/features\/[^/]+\/FEATURE\.md$/.test(path);
}

function isTracker(path: string): boolean {
  return /blocked-by-human\.md$/.test(path);
}

/** The eligibility rule, and the one honest reason a file was skipped. */
export function skipReasonFor(item: SourceItem): SkipReason | null {
  if (item.text === null) return item.omitted === "too_large" ? "too_large" : "binary";
  if (VENDOR_OR_GENERATED.test(item.id) || LOCKED_OR_MINIFIED.test(item.id)) {
    return "generated_or_vendor";
  }
  if (!item.id.endsWith(".md")) return "no_extractable_structure";
  if (isDecisionRecord(item.id) || isFeatureDoc(item.id) || isTracker(item.id)) return null;
  // A markdown file that is not one of the three structured shapes is
  // prose. v1 never ingests arbitrary narrative (`SK-PIVOT-017`).
  return "narrative_prose";
}

// ── extraction ────────────────────────────────────────────────────────

function factRecord(
  category: string,
  kind: string,
  content: string,
  tags: string[],
  source: { path: string; key: string; digest: string },
): MemoryRecord {
  return { category, object: "fact", payload: { content, kind, tags, source } };
}

/**
 * A decision record → one `decision` entity plus its current status fact,
 * per D-08's strategy table ("entity for the ID; facts for
 * status/date/supersession").
 */
export function extractDecisionRecord(path: string, content: string): MemoryRecord[] {
  const name = path.split("/").pop() ?? "";
  const id = name.match(DECISION_ID)?.[0];
  if (!id) return [];
  const title = (content.match(/^#\s+(.+)$/m)?.[1] ?? id).replace(/\s+/g, " ").trim();
  // `**Status:** superseded by X` / `**Decision:** …` are the two shapes the
  // repo actually uses; absent either, an existing record is `recorded`.
  const status =
    content
      .match(/^\*\*Status:\*\*\s*(.+)$/m)?.[1]
      ?.replace(/\s+/g, " ")
      .trim() ?? (/superseded by/i.test(content) ? "superseded" : "recorded");
  const records: MemoryRecord[] = [
    {
      category: "decision",
      object: "entity",
      payload: { kind: "decision", canonical_name: id, properties: { title, path } },
    },
    factRecord("decision_status", "decision_status", `${id} status: ${status}`, [id], {
      path,
      key: `${path}#status`,
      digest: digest(status),
    }),
  ];
  // Cross-references → `reference` facts tagged with both endpoints. The
  // `entity_facts` edge rows themselves need an edge verb the public
  // `nlqdb_remember` contract does not have yet (D-08 remaining item), so
  // slice 1 carries the edge in tags only — the same shape the eval
  // corpus's `reference` rows use.
  for (const other of idsIn(content)) {
    if (other === id) continue;
    records.push(
      factRecord("reference", "reference", `${id} references ${other}`, [id, other], {
        path,
        key: `${path}#ref:${other}`,
        digest: digest(other),
      }),
    );
  }
  return records;
}

/** The sync-run episode: what this import did, at which pinned commit. */
export function syncEpisode(
  source: SourceDescriptor,
  counts: Record<string, number>,
): MemoryRecord {
  const parts = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${k}`)
    .join(", ");
  return {
    category: "sync_run",
    object: "episode",
    payload: {
      role: "sync",
      content: `imported ${source.ref} at commit ${source.pin ?? "unpinned"} — ${parts || "nothing extracted"}`,
    },
  };
}

// ── the adapter ───────────────────────────────────────────────────────

export const repoOpsPack: PackAdapter = {
  id: "repo-ops",
  preset: "agent_memory_v1",
  label: "Import repo memory",
  // Drawn from D-03's repo-ops golden-query set so completion proves the
  // same thing the eval family measures.
  goldenQueries: [
    "Which features have open questions, and how many each?",
    "What is blocked, and since when? Show the item and the date, oldest first.",
    "Which decisions were superseded, and by what?",
    "List the doc-sync runs in chronological order — what each one did and when.",
  ],

  parseSource(input: string): SourceParse {
    const target = parseRepoInput(input);
    if (!target) {
      return {
        ok: false,
        reason:
          "Paste a GitHub repository URL (for example https://github.com/owner/repo) or `owner/repo`.",
      };
    }
    return {
      ok: true,
      source: {
        kind: "github-repo",
        ref: `${target.owner}/${target.repo}`,
        pin: null,
        meta: {
          owner: target.owner,
          repo: target.repo,
          ...(target.ref ? { branch: target.ref } : {}),
        },
      },
    };
  },

  async acquire(source: SourceDescriptor, ctx: PackContext): Promise<AcquireResult> {
    const owner = source.meta["owner"];
    const repo = source.meta["repo"];
    if (!owner || !repo) return { ok: false, reason: "source_error" };
    const branch = source.meta["branch"] ?? null;
    const target = { owner, repo, ref: branch };

    // Pin once, then reuse: a retry after the branch moved still reads the
    // commit the preview described.
    let commit = source.pin;
    let pinnedBranch = branch;
    if (!commit) {
      const pinned = await pinCommit(ctx.tracer, ctx.fetch, target);
      if (!pinned.ok) return { ok: false, reason: pinned.reason };
      commit = pinned.commit;
      pinnedBranch = pinned.branch;
    }

    const archive = await fetchArchive(ctx.tracer, ctx.fetch, target, commit, ctx.limits);
    if (!archive.ok) return { ok: false, reason: archive.reason };
    return {
      ok: true,
      source: {
        ...source,
        pin: commit,
        meta: { ...source.meta, ...(pinnedBranch ? { branch: pinnedBranch } : {}) },
      },
      items: archive.entries.map((e) => ({
        id: e.path,
        bytes: e.bytes,
        text: e.text,
        ...(e.omitted ? { omitted: e.omitted } : {}),
      })),
    };
  },

  classify(items: SourceItem[]): ClassifyResult {
    const eligible: SourceItem[] = [];
    const skipped: { id: string; reason: SkipReason }[] = [];
    for (const item of items) {
      const reason = skipReasonFor(item);
      if (reason) skipped.push({ id: item.id, reason });
      else eligible.push(item);
    }
    return { eligible, skipped };
  },

  extract(items: SourceItem[], source: SourceDescriptor): MemoryRecord[] {
    const records: MemoryRecord[] = [];
    for (const item of items) {
      const text = item.text;
      if (text === null) continue;
      if (isDecisionRecord(item.id)) {
        records.push(...extractDecisionRecord(item.id, text));
        continue;
      }
      if (isFeatureDoc(item.id)) {
        const ex = extractOpenQuestions(item.id, text);
        for (const e of ex.entities) {
          records.push({
            category: "feature",
            object: "entity",
            payload: { kind: e.kind, canonical_name: e.canonical_name },
          });
        }
        for (const f of ex.facts) {
          records.push(factRecord("open_question", f.kind, f.content, f.tags, f.source));
        }
        // Cross-references named by the feature doc, tagged to the feature.
        const slug = featureSlug(item.id);
        for (const id of idsIn(text)) {
          records.push(
            factRecord("reference", "reference", `${slug} references ${id}`, [slug, id], {
              path: item.id,
              key: `${item.id}#ref:${id}`,
              digest: digest(id),
            }),
          );
        }
        continue;
      }
      if (isTracker(item.id)) {
        const ex = extractBlockedQueue(item.id, text);
        for (const e of ex.entities) {
          records.push({
            category: "tracker",
            object: "entity",
            payload: { kind: e.kind, canonical_name: e.canonical_name },
          });
        }
        for (const f of ex.facts) {
          records.push(factRecord("tracker", f.kind, f.content, f.tags, f.source));
        }
      }
    }
    // The episode goes last so its counts describe the rest of the import.
    if (records.length > 0) {
      const byCategory: Record<string, number> = {};
      for (const r of records) byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
      records.push(syncEpisode(source, byCategory));
    }
    return records;
  },
};
