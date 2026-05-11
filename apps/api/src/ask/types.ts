// Shared types for the `/v1/ask` orchestration. Kept narrow — only
// the surfaces tests + the handler need.

import type { QueryResult } from "@nlqdb/db";

export type DbRecord = {
  id: string;
  tenantId: string;
  engine: "postgres";
  connectionSecretRef: string;
  schemaHash: string | null;
  // Compiled DDL written at provision time (`db-create/neon-provision.ts`).
  // The orchestrator feeds this to `deps.llm.plan` as the `schema`
  // field so the planner sees real table + column names. `null` for
  // legacy rows that pre-date migration 0010 — the orchestrator falls
  // back to the schema hash in that case (degraded prompt quality but
  // no 500).
  schemaText: string | null;
};

export type CachedPlan = {
  sql: string;
  schemaHash: string;
};

export type AskRequest = {
  goal: string;
  dbId: string;
  userId: string;
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
  cached: boolean;
  sql: string;
  rows: Record<string, unknown>[];
  rowCount: number;
  // Omitted in JSON-no-summary mode (Accept: application/json), present
  // by default + in SSE mode.
  summary?: string;
  selected_db?: SelectedDbEcho;
  pipe_advisory?: PipeAdvisory;
};

// SK-ASK-014 — when the classifier returns `kind=create` but the caller
// pinned a `dbId`, the handler returns this envelope instead of letting
// the LLM emit `CREATE TABLE` and have the read/write SQL allowlist
// reject it as the cryptic `disallowed_verb`. Surfaces render a chip
// with two actions: "Create new database" (re-send without `dbId`) and
// "Cancel". `pinned_db` is the DB the caller had selected — surfaces
// echo its slug into the chip prompt.
export type ClarifyRequired = {
  status: "clarify_required";
  clarification: "create_or_query_pinned";
  pinned_db: { id: string; slug: string } | null;
  reason: string;
};

export type AskError =
  | { status: "db_not_found" }
  | { status: "schema_unavailable" }
  | { status: "db_misconfigured" }
  | { status: "db_unreachable" }
  | { status: "sql_rejected"; reason: string }
  | { status: "llm_failed" }
  | { status: "rate_limited"; limit: number; count: number; resetAt: number }
  // SK-ASK-016 — the LLM-emitted SQL references a table not present in
  // the target DB's schema. Pre-flight catches it before exec; the 42P01
  // exec backstop catches the cases pre-flight misses. HTTP 409 — the
  // goal was valid but aimed at the wrong DB; the surface can offer
  // "create a fresh DB instead" without dead-ending on a generic 502.
  | { status: "schema_mismatch"; referencedTables: string[]; schemaTables: string[] }
  | ClarifyRequired;

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
export class SchemaMismatchError extends Error {
  readonly code = "schema_mismatch" as const;
  readonly referencedTables: string[];
  readonly schemaTables: string[];
  constructor(referencedTables: string[], schemaTables: string[]) {
    super(
      referencedTables.length > 0
        ? `SQL references table(s) not in schema: ${referencedTables.join(", ")}`
        : "SQL references a relation the target DB does not have",
    );
    this.name = "SchemaMismatchError";
    this.referencedTables = referencedTables;
    this.schemaTables = schemaTables;
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
  | { type: "plan"; sql: string; cached: boolean }
  | { type: "rows"; rows: Record<string, unknown>[]; rowCount: number }
  | { type: "summary"; summary: string }
  | { type: "selected_db"; db: SelectedDbEcho }
  // `SK-MIGRATE-005`: emitted once before `plan_pending` when an
  // analyser audit row exists for `(db_id, query_hash)` within 24h.
  // Surfaces render it as one line in the trace.
  | { type: "pipe_advisory"; advisory: PipeAdvisory };

// Re-export so deps using QueryResult don't need a second @nlqdb/db
// import in callers.
export type { QueryResult };
