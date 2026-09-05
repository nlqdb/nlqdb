// Shared types for the `/v1/ask` orchestration. Kept narrow — only
// the surfaces tests + the handler need.

import type { QueryResult } from "@nlqdb/db";
import type { FailoverReasonParam as FailoverReason, LlmLane } from "@nlqdb/errors";
import type { NlqSurface } from "@nlqdb/events";

export type DbRecord = {
  id: string;
  tenantId: string;
  engine: "postgres" | "clickhouse";
  connectionSecretRef: string;
  schemaHash: string | null;
  // Compiled DDL written at provision time (`db-create/neon-provision.ts`).
  // The orchestrator feeds this to `deps.llm.plan` as the `schema`
  // field so the planner sees real table + column names. `null` for
  // legacy rows that pre-date migration 0010 — the orchestrator falls
  // back to the schema hash in that case (degraded prompt quality but
  // no 500).
  schemaText: string | null;
  // BYO ("connect your own") connection blob — the AES-GCM sealed
  // connection URL (GLOBAL-031, AAD `dbconn:<id>`). Non-null only for
  // BYO rows (`db-connect/connect.ts`); hosted rows leave it null and
  // resolve `connectionSecretRef` against env. The query-time dispatcher
  // (`ask/build-deps.ts`) branches on this: non-null ⇒ open the blob and
  // run the user SQL directly (no tenant schema / RLS).
  connectionBlob: string | null;
};

// SK-TRUST-002 — `model` + `confidence` ride alongside the cached SQL
// so the response's `trace` block is stable across cache hits. Legacy
// entries (no fields) fall through to placeholder defaults in the
// orchestrator.
export type CachedPlan = {
  sql: string;
  schemaHash: string;
  model?: string;
  confidence?: number;
};

// SK-TRUST-002 — every `/v1/ask` response carries this block. Always
// emitted, always rendered. `plan_id` is the content-address pair
// `${schema_hash}:${query_hash}` per GLOBAL-006 (stable across hits).
export type Trace = {
  sql: string;
  plan_id: string;
  confidence: number;
  model: string;
  cache_hit: boolean;
};

export type AskRequest = {
  goal: string;
  dbId: string;
  // Tenant id — passed to `resolveDb`, recent-tables, first-query; for sk_* principals this is the account, not the key.
  userId: string;
  // SK-MCP-009 rate-limit bucket; defaults to `userId` so chat + tests don't churn.
  rateLimitBucketKey?: string;
  // SK-TRUST-001 — render-before-commit gate. First call (omitted /
  // false) returns `requires_confirm: true` + `diff` for write paths
  // and skips exec. Surfaces re-send the same goal with `confirm: true`
  // to commit. Read paths ignore this field. Per the decision, there
  // is no bypass on `/v1/ask` — the escape hatch for power users is
  // `/v1/run` (GLOBAL-015).
  confirm?: boolean;
  // SK-APIKEYS-003 — a read-only principal (`pk_live_` embed). A plan that
  // is a write — from the LLM, the plan cache, or the confirm stash — is
  // refused before exec with `forbidden / read_only_principal`, the same
  // gate `/v1/run` applies. `confirm: true` does not override it.
  readOnly?: boolean;
  // SK-ASK-009 — the routed `kind`, carried into orchestration. `"write"`
  // reaches the planner (so it emits a data-modifying statement) and is
  // enforced post-plan: a write goal that plans as a read is re-planned, not
  // silently executed as a SELECT. Absent ⇒ read intent (default). Non-route
  // callers (chat, internal helpers) omit it and keep the read default.
  intent?: "query" | "write";
  // SK-TRUST-004 — originating surface, threaded from the route so the
  // orchestrator can slice the destructive-op retry-rate instrument
  // (`feature.destructive.*`) by surface. Optional: non-route callers
  // (tests, internal helpers) omit it and the emit is skipped rather than
  // fabricating a surface that would pollute the metric.
  surface?: NlqSurface;
};

// SK-TRUST-001 — plain-English preview of a write plan. Values derived
// server-side (parser + pre-flight COUNT) — surfaces never compute the
// affected-rows count themselves; that would be a silent-lie risk
// under GLOBAL-011. `DDL` reserved for the future db-create slice; the
// `/v1/ask` write path never emits it (DDL via `/v1/ask` is rejected
// by the allowlist).
export type AskDiff = {
  verb: "UPDATE" | "DELETE" | "INSERT" | "DDL";
  table: string;
  affectedRows: number;
  summary: string;
};

// SK-ASK-009: when `dbId` was absent and the LLM disambiguator picked
// a candidate (above the 0.7 confidence floor), the response carries
// `selected_db` so the surface can render attribution + a one-click
// switch. Absent on responses where the caller pinned `dbId` directly.
export type SelectedDbEcho = {
  id: string;
  slug: string;
  confidence: number;
  reason: string;
};

// `SK-MIGRATE-005`: surfaced when an audit row exists for the resolved
// `(db_id, query_hash)` within the last 24h. Caveat — in W5 the Pipe
// is created but not yet on the read path; future SK-MIGRATE wires the
// adapter-side dispatch.
export type PipeAdvisory = {
  pipeName: string;
  createdHoursAgo: number;
};

export type AskResult = {
  status: "ok";
  rows: Record<string, unknown>[];
  rowCount: number;
  // Omitted in JSON-no-summary mode (Accept: application/json), present
  // by default + in SSE mode.
  summary?: string;
  selected_db?: SelectedDbEcho;
  pipe_advisory?: PipeAdvisory;
  // SK-TRUST-001 — set on the first hop of a write path (no `confirm`
  // in the request). `rows` is empty + `rowCount` 0 on this hop; the
  // write hasn't run yet. Surfaces render `diff` and re-send with
  // `confirm: true` to commit.
  requires_confirm?: boolean;
  diff?: AskDiff;
  // SK-TRUST-002 — always emitted. The compiled SQL + cache state live
  // here (not at the top level) so the trust block is one cohesive
  // record. Surfaces render it as a collapsed-by-default pane.
  trace: Trace;
};

// SK-ASK-026 — one interpretation offered on a `destructive_ambiguous`
// clarify. The surface re-sends `goal` (dropping the DB pin when
// `forceNoPin`) through the same re-send path the SK-ASK-009 picker and
// SK-ASK-014 create chip already use — no new privileged action.
export type ClarifyOption = {
  label: string;
  goal: string;
  forceNoPin?: boolean;
};

// A `clarify_required` envelope. Two shapes share it:
//   • `create_or_query_pinned` (SK-ASK-014) — the classifier returned
//     `kind=create` but the caller pinned a `dbId`. Surfaces render a chip
//     with two hardcoded actions ("Create new database" / "Cancel") and
//     echo `pinned_db`'s slug into the prompt. Returned by the handler.
//   • `destructive_ambiguous` (SK-ASK-026) — the read/write allowlist
//     rejected the plan for a destructive-ambiguous reason (the "clear db"
//     family). Surfaces render one chip / choice per `options` entry
//     instead of the flat `sql_rejected` dead-end. Returned by the
//     orchestrator at the plan-loop reject.
//   • `low_confidence` (GLOBAL-040) — the plan sat below the tier confidence
//     floor. Rather than the old standalone `low_confidence` error, it rides
//     this rail with one re-sendable `options` entry per candidate reading, so
//     a low-confidence outcome is a guided turn on every surface, never a
//     dead-end. (Floor activation stays gated on quality-eval — SK-TRUST-003.)
// All replace the cryptic `disallowed_verb`/`sql_rejected`/`low_confidence` a
// destructive, create, or below-floor goal would otherwise dead-end on.
export type ClarifyRequired = {
  code: "clarify_required";
  clarification:
    | "create_or_query_pinned"
    | "destructive_ambiguous"
    | "missing_required_reference"
    // GLOBAL-040 — a below-floor plan surfaces here (options = candidate
    // readings), never as a standalone `low_confidence` dead-end error.
    | "low_confidence";
  pinned_db: { id: string; slug: string } | null;
  reason: string;
  // SK-ASK-026 — present on `destructive_ambiguous`; one re-sendable
  // interpretation per entry. Absent on `create_or_query_pinned`.
  options?: ClarifyOption[];
};

// SK-ERR-001 — the discriminant is `code`, and each variant's remaining fields
// are exactly the params its registry entry declares (`@nlqdb/errors`). The
// route handler hands the whole object to `askErrorEnvelope`, which renders the
// message + action + retryable, so adding a code needs one registry entry and
// no handler edit.
export type AskError =
  | { code: "db_not_found" }
  | { code: "schema_unavailable" }
  | { code: "db_misconfigured" }
  | { code: "db_unreachable" }
  | { code: "sql_rejected"; reason: string }
  // SK-APIKEYS-003 — a read-only principal planned a write.
  | { code: "forbidden"; reason: "read_only_principal" }
  // SK-LLM-051 — the bounded, secret-free cause the router already computed.
  // Discarding it is what made a rejected BYOLLM key read as "try rephrasing"
  // (2026-08-17). Raw provider text stays on the `llm.plan` span.
  | {
      code: "llm_failed";
      reason?: FailoverReason;
      lane?: LlmLane;
      provider?: string;
      model?: string;
    }
  | { code: "rate_limited"; limit: number; count: number; resetAt: number }
  // SK-ASK-016 — the LLM-emitted SQL references a table not present in
  // the target DB's schema. Pre-flight catches it before exec; the 42P01
  // exec backstop catches the cases pre-flight misses. HTTP 409 — the
  // goal was valid but aimed at the wrong DB; the surface can offer
  // "create a fresh DB instead" without dead-ending on a generic 502.
  | { code: "schema_mismatch"; referencedTables: string[]; schemaTables: string[] }
  // SK-TRUST-006 — a write that affects nothing is never a successful
  // empty read. `phase: "preview"` means the pre-flight count proved the
  // write would touch 0 rows, so it was never offered for approval;
  // `phase: "commit"` means an approved write ran and the engine reported
  // 0 rows affected. Either way nothing changed. HTTP 409 — the goal
  // parsed, the SQL ran, but the values matched no rows. `verb` / `table`
  // are omitted only when the plan's target couldn't be named.
  | { code: "write_no_rows"; phase: "preview" | "commit"; verb?: string; table?: string }
  // SK-ASK-029 — the write reached the engine and the engine refused it: a
  // required column was missing, a foreign key pointed at a row that doesn't
  // exist, a unique/check rule failed. Deterministic (never retried) and
  // 409 — the goal is answerable once the caller names real values. Carries
  // identifiers only, never the offending values.
  | {
      code: "write_constraint";
      kind: WriteConstraintKind;
      table?: string;
      column?: string;
      constraint?: string;
    }
  // SK-ASK-030 — Postgres SQLSTATE class 22 (data exception: bad cast, numeric
  // overflow, divide by zero). Deterministic like class 23, and the same
  // catch-all used to bucket it as `db_unreachable` and retry it three times.
  | { code: "invalid_value"; pgCode?: string }
  | ClarifyRequired;

export type WriteConstraintKind = "not_null" | "foreign_key" | "unique" | "check" | "exclusion";

// Thrown by `exec` callbacks when a DB row's `connection_secret_ref`
// doesn't resolve to anything in env (operator config error, not a
// transient infra issue). Orchestrator distinguishes from generic
// throws so the handler can return a clearer error to the caller —
// "your nlqdb deploy is missing a secret" reads differently than
// "couldn't reach Neon right now".
export class DbConfigError extends Error {
  readonly code = "db_misconfigured" as const;
  constructor(message: string) {
    super(message);
    this.name = "DbConfigError";
  }
}

// SK-ASK-016 — the LLM-emitted SQL references a table the target DB
// doesn't have. Thrown from the orchestrator's pre-flight check (where
// `referencedTables` / `schemaTables` are both populated) or from the
// exec catch on PG `42P01` (where we only know the SQL ran against a
// missing relation; arrays are empty). Outer catch maps to the typed
// `schema_mismatch` envelope; SK-ASK-013's retry loop bails after one
// attempt — retrying the same SQL produces the same error.
// `reason` is the classifier's verdict even when Neon drops `.code` and
// `pgCode` falls back to `msg_match` (SK-ASK-019).
export type SchemaMismatchDiag = {
  reason: "schema_missing" | "table_missing";
  pgCode: string;
  pgMessage: string;
};

export class SchemaMismatchError extends Error {
  readonly code = "schema_mismatch" as const;
  readonly referencedTables: string[];
  readonly schemaTables: string[];
  // SK-ASK-023 — the exec-catch classifier (`classifySchemaError`) knows the
  // SQLSTATE (`3F000` schema-missing vs `42P01` table-missing) that told a
  // deterministic missing-relation apart from connectivity. The class-facing
  // arrays are empty on that path, so carry the SQLSTATE here: the
  // orchestrator persists it to the KV diag sink where preview/e2e logs
  // vanish (same black hole SK-ASK-023 closed for `db_unreachable`). Absent
  // on the pre-flight path, which populates the arrays instead.
  readonly diag?: SchemaMismatchDiag;
  constructor(referencedTables: string[], schemaTables: string[], diag?: SchemaMismatchDiag) {
    super(
      referencedTables.length > 0
        ? `SQL references table(s) not in schema: ${referencedTables.join(", ")}`
        : "SQL references a relation the target DB does not have",
    );
    this.name = "SchemaMismatchError";
    this.referencedTables = referencedTables;
    this.schemaTables = schemaTables;
    this.diag = diag;
  }
}

// SK-ASK-029 — a PG integrity-constraint violation (SQLSTATE class 23) on the
// write path. Thrown by `classifyWriteConstraint` from the exec catch and
// mapped to the typed `write_constraint` envelope; deterministic, so
// SK-ASK-013's retry bails after one attempt.
export class WriteConstraintError extends Error {
  readonly code = "write_constraint" as const;
  constructor(
    readonly kind: WriteConstraintKind,
    // Identifiers only (table / column / constraint name) — never the
    // offending values.
    readonly target: { table?: string; column?: string; constraint?: string },
  ) {
    super(`write rejected by a ${kind} constraint`);
    this.name = "WriteConstraintError";
  }
}

// Streaming events for the SSE response path. Sent in order:
//   `plan_pending` → `plan` → `rows` → `summary`
//
// `plan_pending` is an unconditional heartbeat fired before the cache
// lookup so SSE clients see a stable event order regardless of cache
// hit/miss. On a cache hit the `plan` event lands immediately after;
// on a miss it covers the multi-second LLM latency. Token-level chunks
// land in a follow-up slice — providers need streamPlan support first.
//
// `summary` is omitted in JSON-no-summary mode.
//
// `selected_db` is emitted by the route handler (not the orchestrator)
// before `plan_pending` when SK-ASK-009 disambiguation auto-targeted
// the DB — surfaces wire it into a "picked X" attribution chip.
export type OrchestrateEvent =
  | { type: "plan_pending" }
  // SK-TRUST-002 — the `plan` event carries the full trace block
  // (sql, plan_id, confidence, model, cache_hit) so SSE consumers
  // accumulate one record instead of stitching it across events.
  | { type: "plan"; trace: Trace }
  | { type: "rows"; rows: Record<string, unknown>[]; rowCount: number }
  | { type: "summary"; summary: string }
  | { type: "selected_db"; db: SelectedDbEcho }
  // SK-TRUST-001 — emitted on the preview hop of a write path, after
  // `plan` and before any `rows`/`summary`. Terminal for the stream;
  // the client must re-send with `confirm: true` to commit.
  | { type: "confirm_required"; diff: AskDiff }
  // `SK-MIGRATE-005`: emitted once before `plan_pending` when an
  // analyser audit row exists for `(db_id, query_hash)` within 24h.
  // Surfaces render it as one line in the trace.
  | { type: "pipe_advisory"; advisory: PipeAdvisory };

// Re-export so deps using QueryResult don't need a second @nlqdb/db
// import in callers.
export type { QueryResult };
