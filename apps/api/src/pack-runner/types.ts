// The shared **pack runner** contract (`SK-PIVOT-021`, dogfood worksheet
// D-08 slice 1). One runner owns the whole product journey; a pack owns
// only judgment about its own source.
//
// ──────────────────────────────────────────────────────────────────────
// Division of labour — the line a reviewer checks
// ──────────────────────────────────────────────────────────────────────
//   The RUNNER owns : the opaque import draft + its durable phase
//                     checkpoints, the resumable URL, the sign-in /
//                     provider-consent resume hooks, real per-phase
//                     counters, the credential-value guard, write
//                     reconciliation, golden-query proof and cleanup.
//   A PACK owns     : how to name and pin its source, how to acquire and
//                     enumerate it, which items are eligible (and the
//                     honest reason a skipped one was skipped), which
//                     `agent_memory_v1` rows each eligible item becomes,
//                     and the golden queries that prove the import.
//
// **N+1 (the test this contract exists to pass).** Instance #1 is
// repo-ops (`packs/repo-ops.ts`): source = a public GitHub archive at a
// pinned commit, items = files. Instance #2 is EK-04's interview-source
// adapter: source = an interview session (`SK-EKP-007`), items =
// exchanges, records = an episode plus the entity/fact rows extracted
// from it. Nothing below mentions repositories, files, GitHub or commits
// — `SourceItem.id` is "stable identity within the source", not a path,
// and `SourceDescriptor.pin` is "the immutable revision", not a SHA. If a
// second pack needs a runner change to plug in, this contract failed and
// the fix belongs here, not in the pack.
//
// A pack adds **no** endpoint, DDL, preset version or MCP tool
// (`SK-PIVOT-018` hard rule): every row it produces is an
// `nlqdb_remember` payload the existing write verb already accepts.

import type { EntityPayload, EpisodePayload, FactPayload } from "../memory/remember.ts";

// ── Journey state ─────────────────────────────────────────────────────

// The five named phases D-08's journey contract renders, in order. There
// is no "percentage": progress is these names plus the real counters
// below. `complete` is the terminal state, not a phase that runs.
export const IMPORT_PHASES = [
  "inspecting",
  "classifying",
  "extracting",
  "saving",
  "verifying",
  "complete",
] as const;
export type ImportPhase = (typeof IMPORT_PHASES)[number];

export function phaseIndex(phase: ImportPhase): number {
  return IMPORT_PHASES.indexOf(phase);
}

/** The pinned, immutable source a draft is bound to for its whole life. */
export type SourceDescriptor = {
  /** Pack-scoped source kind (`"github-repo"`, `"interview-session"`). */
  kind: string;
  /** Canonical, credential-free source reference shown back to the user. */
  ref: string;
  /**
   * The immutable revision the whole import is pinned to — a commit SHA
   * for a repo, a session id for an interview. Resolved once in
   * `inspecting` so every later phase (and every retry) sees exactly the
   * bytes the preview described.
   */
  pin: string | null;
  /** Pack-private, credential-free extras (owner/repo, branch name, …). */
  meta: Record<string, string>;
};

/** One enumerated unit of the source. Generic on purpose — see N+1 above. */
export type SourceItem = {
  /** Stable identity within the source. Unique; used as the skip key. */
  id: string;
  /** Size in bytes when the source measures one, else 0. */
  bytes: number;
  /** Text the pack classifies/extracts from; `null` when unavailable. */
  text: string | null;
  /**
   * Why `text` is `null`, so the skip reason the user reads is the true one
   * rather than "binary" standing in for "we capped it".
   */
  omitted?: "binary" | "too_large";
};

// The `agent_memory_v1` objects a pack may write. Three, not four: the
// public `nlqdb_remember` contract has no edge verb, so `entity_facts`
// edges are not writable from a pack — cross-references ride tags until an
// engine slice adds one (recorded in the D-08 worksheet).
export const MEMORY_OBJECTS = ["entity", "fact", "episode"] as const;
export type MemoryObject = (typeof MEMORY_OBJECTS)[number];

/** One planned write, tagged with the extraction category the preview names. */
export type MemoryRecord = {
  /** Extraction category, e.g. `"decision"` / `"open_question"` / `"sync_run"`. */
  category: string;
} & (
  | { object: "entity"; payload: EntityPayload }
  | { object: "fact"; payload: FactPayload }
  | { object: "episode"; payload: EpisodePayload }
);

/** Why an item was skipped. Rendered verbatim to the user, so keep it honest. */
export type SkipReason =
  | "narrative_prose"
  | "binary"
  | "generated_or_vendor"
  | "too_large"
  | "no_extractable_structure"
  | "credential_value_rejected";

export type ClassifyResult = {
  eligible: SourceItem[];
  /** One entry per skipped item, `reason` from the closed set above. */
  skipped: { id: string; reason: SkipReason }[];
};

// ── The adapter a pack implements ─────────────────────────────────────

/** Runner-owned caps every adapter must respect. */
export type SourceLimits = {
  maxItems: number;
  maxItemBytes: number;
  maxTotalBytes: number;
};

/** Everything an adapter may reach for. No env, no bindings, no DB. */
export type PackContext = {
  /** GLOBAL-014 — external calls hang their span off the runner's tracer. */
  tracer: import("@opentelemetry/api").Tracer;
  /** Injected so adapter tests never touch the network. */
  fetch: typeof fetch;
  limits: SourceLimits;
};

export type SourceParse = { ok: true; source: SourceDescriptor } | { ok: false; reason: string };

export type AcquireResult =
  | { ok: true; source: SourceDescriptor; items: SourceItem[] }
  /**
   * `reason` is a machine code the runner maps to a next action:
   * `source_private` → the private-source consent branch,
   * `rate_limited` → explain + offer retry, everything else → fail loud.
   */
  | { ok: false; reason: string };

export type PackAdapter = {
  /** Stable pack id — the `packId` on the draft row and in the URL. */
  readonly id: string;
  /** Preset the runner provisions for this pack (one seed schema). */
  readonly preset: "agent_memory_v1";
  /** One-line copy the runner renders; the runner hard-codes no pack words. */
  readonly label: string;
  /** Golden queries `verifying` runs as the durable proof (`SK-PIVOT-021`). */
  readonly goldenQueries: readonly string[];

  /** Normalise the user's single input into a credential-free descriptor. */
  parseSource(input: string): SourceParse;

  /**
   * Pin the revision, acquire the source, enumerate its items. The one
   * external-IO method — called once per phase-run and cached by the
   * runner for the rest of that request.
   */
  acquire(source: SourceDescriptor, ctx: PackContext): Promise<AcquireResult>;

  /** Eligible vs skipped-with-reason. Pure. */
  classify(items: SourceItem[]): ClassifyResult;

  /** Eligible items → planned `agent_memory_v1` rows. Pure. */
  extract(items: SourceItem[], source: SourceDescriptor): MemoryRecord[];
};
