// The shared pack-runner state machine (`SK-PIVOT-021`, D-08 slice 1).
//
// One `advance` call runs one phase and persists its checkpoint, so
// progress is durable at every boundary and a retry resumes from the last
// committed point instead of restarting. The five phases and their real
// counters are D-08's journey contract; nothing here invents a percentage.
//
//   inspecting  → pin the revision, acquire + enumerate  (items/total)
//   classifying → eligible vs skipped, with reasons      (eligible/skipped)
//   extracting  → planned `agent_memory_v1` rows          (records/category)
//   saving      → one `nlqdb_remember` write per record   (rows/object)
//   verifying   → read-back reconcile + golden queries    (planned vs written)
//
// **Retry idempotency.** `saving` advances and persists `saveCursor` after
// every single write. `facts` is append-only, so a crash between "row
// written" and "cursor persisted" is the one window that could duplicate a
// row; checkpointing per row (rather than per batch) narrows it to one row
// and makes "retry never duplicates" a property the tests can assert.
// Import volumes are tens-to-hundreds of rows, so the extra control-plane
// writes are cheap next to the guarantee.
//
// **Auth resumability.** Phases before `saving` need no account: the
// public preflight is the `GLOBAL-007` first value. `saving` returns
// `auth_required` / `db_required` *without mutating the draft*, which is
// the seam sign-in and provider-consent redirects resume through — the
// draft simply waits at `saving` until it has a tenant and a memory DB.

import type { ImportDraft, ScanCheckpoint, Verification } from "./draft-store.ts";
import type { DraftStore } from "./draft-store.ts";
import {
  IMPORT_PHASES,
  type ImportPhase,
  MEMORY_OBJECTS,
  type MemoryObject,
  type MemoryRecord,
  type PackAdapter,
  type PackContext,
  phaseIndex,
  type SourceDescriptor,
  type SourceItem,
} from "./types.ts";

/** How many skipped items the preview keeps by id. The histogram is complete. */
const SKIP_SAMPLE_MAX = 200;
/** Hard ceiling on planned writes — an import is a preview, not a migration. */
export const MAX_RECORDS = 2000;

export type RunnerDeps = {
  store: DraftStore;
  /** Pack id → adapter. The runner never branches on a pack id itself. */
  packs: Record<string, PackAdapter>;
  ctx: PackContext;
  /** One `nlqdb_remember` write. Throws to fail the phase. */
  writeMemory: (dbId: string, record: MemoryRecord) => Promise<void>;
  /** Read back row counts per memory object, for a real reconcile. */
  countRows?: (dbId: string) => Promise<Record<string, number>>;
  /** Run one golden query and render its answer. Omitted ⇒ recorded pending. */
  askGolden?: (dbId: string, query: string) => Promise<string>;
  now: () => number;
  newId: () => string;
};

export type RunnerReject =
  /** The `input` did not name a source this pack can use. */
  | { reason: "invalid_source"; detail: string }
  | { reason: "unknown_pack" }
  /** `saving` reached with no tenant — send the user through sign-in. */
  | { reason: "auth_required" }
  /** Signed in, but no isolated memory DB is attached yet. */
  | { reason: "db_required" }
  /** The source could not be read: `detail` is the pack's machine code. */
  | { reason: "source_unavailable"; detail: string }
  | { reason: "phase_failed"; detail: string };

export type RunnerOutcome =
  | { ok: true; draft: ImportDraft }
  | ({ ok: false; draft: ImportDraft | null } & RunnerReject);

// ── Credential-value guard (runner-owned, applies to every pack) ───────
//
// `SK-PIVOT-018` is absolute: a pack stores credential *metadata* —
// service, key name, scope, date — and never a secret value. The guard
// lives here rather than in an adapter so a new pack cannot forget it.
// It is a rejecting filter, not a redactor: a record whose text looks like
// it carries a live secret is dropped with a visible reason, because
// silently rewriting a user's content would be a worse failure than
// skipping it.
const SECRET_VALUE_PATTERNS: RegExp[] = [
  // nlqdb's own key families (SK-APIKEYS-*) — the ones dogfooding will hit.
  /\b(?:sk_live|sk_mcp|pk_live)_[A-Za-z0-9_-]{8,}/,
  // Common provider prefixes: OpenAI/Anthropic/Google/GitHub/Slack/Stripe.
  /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}/,
  /\bAIza[0-9A-Za-z_-]{30,}/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/,
  /\bxox[abposr]-[A-Za-z0-9-]{10,}/,
  /\b(?:r|s)k_(?:live|test)_[A-Za-z0-9]{16,}/,
  // AWS access key id, and a private-key PEM header.
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/,
  /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----/,
  // `KEY=<opaque blob>` — an assignment whose value is long and unspaced.
  /\b[A-Z][A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|APIKEY|API_KEY|PRIVATE_KEY)[A-Z0-9_]*\s*[:=]\s*["']?[A-Za-z0-9+/_=-]{16,}/,
];

/** True when the text carries something that looks like a live secret value. */
export function carriesSecretValue(text: string): boolean {
  return SECRET_VALUE_PATTERNS.some((re) => re.test(text));
}

// Every field of the payload, not a per-object subset: a pack is free to put
// text in `tags`, `properties`, `source` or `tool_calls`, and a guard that
// inspects only the fields today's packs use is a guard a pack can slip past.
function recordText(record: MemoryRecord): string {
  return JSON.stringify(record.payload);
}

/**
 * Drop every planned record that carries a secret value. Returns the kept
 * records and how many were rejected, so the preview can show the count
 * honestly rather than the user discovering a silent omission later.
 */
export function guardSecretValues(records: MemoryRecord[]): {
  kept: MemoryRecord[];
  rejected: number;
} {
  const kept: MemoryRecord[] = [];
  let rejected = 0;
  for (const record of records) {
    if (carriesSecretValue(recordText(record))) rejected += 1;
    else kept.push(record);
  }
  return { kept, rejected };
}

// ── Derived counters — never stored twice, so they cannot disagree ─────

export function recordsByCategory(records: MemoryRecord[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of records) out[r.category] = (out[r.category] ?? 0) + 1;
  return out;
}

export function rowsByObject(records: MemoryRecord[]): Record<MemoryObject, number> {
  const out: Record<MemoryObject, number> = { entity: 0, fact: 0, episode: 0 };
  for (const r of records) out[r.object] += 1;
  return out;
}

/** The progress payload every surface renders. Real units only. */
export function draftProgress(draft: ImportDraft) {
  const records = draft.records ?? [];
  return {
    phase: draft.phase,
    items: draft.scan
      ? {
          total: draft.scan.itemsTotal,
          eligible: draft.scan.eligible,
          skipped: draft.scan.itemsTotal - draft.scan.eligible,
          skipReasons: draft.scan.skipReasons,
        }
      : null,
    records: draft.records ? recordsByCategory(records) : null,
    written: rowsByObject(records.slice(0, draft.saveCursor)),
    plannedWrites: draft.records ? rowsByObject(records) : null,
    verification: draft.verification,
  };
}

/** The wire projection of a draft. Carries no source content, ever. */
export function importView(draft: ImportDraft) {
  return {
    id: draft.id,
    packId: draft.packId,
    source: { kind: draft.source.kind, ref: draft.source.ref, pin: draft.source.pin },
    dbId: draft.dbId,
    claimed: draft.tenantId !== null,
    progress: draftProgress(draft),
    skippedSample: draft.scan?.skipped ?? [],
    error: draft.error,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}

// ── Draft lifecycle ───────────────────────────────────────────────────

export async function createDraft(
  deps: RunnerDeps,
  input: { packId: string; input: string; tenantId: string | null },
): Promise<RunnerOutcome> {
  const adapter = deps.packs[input.packId];
  if (!adapter) return { ok: false, draft: null, reason: "unknown_pack" };
  const parsed = adapter.parseSource(input.input);
  if (!parsed.ok) {
    return { ok: false, draft: null, reason: "invalid_source", detail: parsed.reason };
  }
  const now = deps.now();
  const draft: ImportDraft = {
    id: deps.newId(),
    tenantId: input.tenantId,
    packId: adapter.id,
    phase: "inspecting",
    source: parsed.source,
    dbId: null,
    saveCursor: 0,
    scan: null,
    records: null,
    verification: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };
  await deps.store.create(draft);
  return { ok: true, draft };
}

/**
 * Run phases until the draft reaches `until` (default: exactly one phase),
 * or until a phase cannot proceed. A rejection that needs the user
 * (`auth_required`, `db_required`) leaves the draft untouched at its
 * current phase; a rejection that is a failure stamps `error` so a retry
 * can clear it.
 *
 * `acquire` is memoised for the whole call, so running the three
 * pre-write phases in one request costs one source acquisition.
 */
export async function advanceDraft(
  deps: RunnerDeps,
  draft: ImportDraft,
  opts: { until?: ImportPhase } = {},
): Promise<RunnerOutcome> {
  const adapter = deps.packs[draft.packId];
  if (!adapter) return { ok: false, draft, reason: "unknown_pack" };

  const until = opts.until ?? nextPhase(draft.phase);
  let current = draft;
  let cached: Acquired | null = null;
  const acquire = async (source: SourceDescriptor): Promise<Acquired> => {
    if (cached) return cached;
    const got = await adapter.acquire(source, deps.ctx);
    if (!got.ok) throw new SourceUnavailable(got.reason);
    cached = { items: got.items, source: got.source };
    return cached;
  };

  while (phaseIndex(current.phase) < phaseIndex(until)) {
    const before = current.phase;
    try {
      const step = await runPhase(deps, adapter, current, acquire);
      if (!step.ok) return step;
      current = step.draft;
      // A phase that did not move the draft would spin forever. Only a
      // corrupt stored `phase` can reach this, but "hang the request" is the
      // wrong way to find out.
      if (current.phase === before) return { ok: true, draft: current };
    } catch (err) {
      const detail = err instanceof SourceUnavailable ? err.code : errText(err);
      const reason = err instanceof SourceUnavailable ? "source_unavailable" : "phase_failed";
      // A phase may already have committed partial progress — `saving`
      // checkpoints after every row — so the error stamp goes on the latest
      // durable state rather than clobbering it with a stale copy.
      const latest = (await deps.store.get(current.id)) ?? current;
      current = { ...latest, error: { phase: before, reason: detail }, updatedAt: deps.now() };
      await deps.store.save(current);
      return { ok: false, draft: current, reason, detail };
    }
  }
  return { ok: true, draft: current };
}

/**
 * Clear a stamped failure and continue from the last durable checkpoint.
 * Retry is not "start again": `saveCursor`, the scan and the extraction
 * plan all survive, so the work already done is never repeated.
 */
export async function retryDraft(
  deps: RunnerDeps,
  draft: ImportDraft,
  opts: { until?: ImportPhase } = {},
): Promise<RunnerOutcome> {
  const cleared: ImportDraft = { ...draft, error: null, updatedAt: deps.now() };
  await deps.store.save(cleared);
  return advanceDraft(deps, cleared, opts);
}

class SourceUnavailable extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function nextPhase(phase: ImportPhase): ImportPhase {
  return IMPORT_PHASES[Math.min(phaseIndex(phase) + 1, IMPORT_PHASES.length - 1)] ?? "complete";
}

/** True when the source held nothing this pack could extract (D-08 scenario 5). */
export function importIsEmpty(draft: ImportDraft): boolean {
  return draft.phase === "complete" && (draft.records?.length ?? 0) === 0;
}

// ── The phases ────────────────────────────────────────────────────────

/** What one source acquisition yields: the items, and the now-pinned source. */
type Acquired = { items: SourceItem[]; source: SourceDescriptor };

async function runPhase(
  deps: RunnerDeps,
  adapter: PackAdapter,
  draft: ImportDraft,
  acquire: (source: SourceDescriptor) => Promise<Acquired>,
): Promise<RunnerOutcome> {
  switch (draft.phase) {
    case "inspecting": {
      const { items, source } = await acquire(draft.source);
      const bytesTotal = items.reduce((n, i) => n + i.bytes, 0);
      const scan: ScanCheckpoint = {
        itemsTotal: items.length,
        bytesTotal,
        eligible: 0,
        skipped: [],
        skipReasons: {},
      };
      // The revision the adapter pinned replaces the unpinned descriptor the
      // draft was created with; every later phase and retry reads that pin.
      return commit(deps, draft, { phase: "classifying", scan, source });
    }

    case "classifying": {
      const { items, source } = await acquire(draft.source);
      const { eligible, skipped } = adapter.classify(items);
      const skipReasons: ScanCheckpoint["skipReasons"] = {};
      for (const s of skipped) skipReasons[s.reason] = (skipReasons[s.reason] ?? 0) + 1;
      const scan: ScanCheckpoint = {
        itemsTotal: items.length,
        bytesTotal: items.reduce((n, i) => n + i.bytes, 0),
        eligible: eligible.length,
        skipped: skipped.slice(0, SKIP_SAMPLE_MAX),
        skipReasons,
      };
      return commit(deps, draft, { phase: "extracting", scan, source });
    }

    case "extracting": {
      // `classify` is re-derived rather than checkpointed: it is pure and
      // cheap, and storing the eligible items would mean putting source
      // *content* in the control plane, which the draft contract forbids.
      const { items, source } = await acquire(draft.source);
      const { eligible } = adapter.classify(items);
      const extracted = adapter.extract(eligible, source);
      // The runner's guard, not the pack's: no pack can opt out.
      const guarded = guardSecretValues(extracted);
      const scan: ScanCheckpoint | null =
        draft.scan && guarded.rejected > 0
          ? {
              ...draft.scan,
              skipReasons: {
                ...draft.scan.skipReasons,
                credential_value_rejected:
                  (draft.scan.skipReasons.credential_value_rejected ?? 0) + guarded.rejected,
              },
            }
          : draft.scan;
      if (guarded.kept.length === 0) {
        // A source with no extractable structure is a real, useful answer
        // (D-08 acceptance scenario 5), not a failure — but there is
        // nothing to write, so the journey completes here rather than
        // provisioning a DB that would only be deleted.
        return commit(deps, draft, { phase: "complete", records: [], scan, source });
      }
      return commit(deps, draft, {
        phase: "saving",
        records: guarded.kept.slice(0, MAX_RECORDS),
        scan,
        source,
      });
    }

    case "saving": {
      if (!draft.tenantId) return { ok: false, draft, reason: "auth_required" };
      const dbId = draft.dbId;
      if (!dbId) return { ok: false, draft, reason: "db_required" };
      const records = draft.records ?? [];
      let current = draft;
      // Resume from the cursor: rows [0, saveCursor) are already durable.
      for (let i = current.saveCursor; i < records.length; i++) {
        const record = records[i];
        if (!record) continue;
        await deps.writeMemory(dbId, record);
        current = { ...current, saveCursor: i + 1, updatedAt: deps.now() };
        await deps.store.save(current);
      }
      return commit(deps, current, { phase: "verifying" });
    }

    case "verifying": {
      if (!draft.dbId) return { ok: false, draft, reason: "db_required" };
      const records = draft.records ?? [];
      const planned = rowsByObject(records);
      const cursorCounts = rowsByObject(records.slice(0, draft.saveCursor));
      let written = cursorCounts;
      let writtenSource: Verification["writtenSource"] = "save_cursor";
      if (deps.countRows) {
        written = await deps.countRows(draft.dbId);
        writtenSource = "read_back";
      }
      const mismatches: string[] = [];
      for (const object of MEMORY_OBJECTS) {
        const want = planned[object] ?? 0;
        const got = written[object] ?? 0;
        // Entities upsert on (agent_id, kind, canonical_name), so a plan
        // that names the same entity twice legitimately reads back fewer
        // rows. Everything else must match exactly.
        const ok = object === "entity" ? got <= want : got === want;
        if (!ok) mismatches.push(`${object}: planned ${want}, found ${got}`);
      }
      const golden: Verification["golden"] = [];
      for (const query of adapter.goldenQueries) {
        const answer = deps.askGolden ? await deps.askGolden(draft.dbId, query) : null;
        golden.push({ query, answer });
      }
      const verification: Verification = {
        planned,
        written,
        writtenSource,
        reconciled: mismatches.length === 0,
        mismatches,
        golden,
      };
      return commit(deps, draft, { phase: "complete", verification });
    }

    default:
      return { ok: true, draft };
  }
}

async function commit(
  deps: RunnerDeps,
  draft: ImportDraft,
  patch: Partial<ImportDraft> & { phase: ImportPhase },
): Promise<RunnerOutcome> {
  const next: ImportDraft = { ...draft, ...patch, error: null, updatedAt: deps.now() };
  await deps.store.save(next);
  return { ok: true, draft: next };
}
