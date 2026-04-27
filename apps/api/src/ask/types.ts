// Shared types for the `/v1/ask` orchestration. Kept narrow — only
// the surfaces tests + the handler need.

import type { QueryResult } from "@nlqdb/db";

export type DbRecord = {
  id: string;
  tenantId: string;
  engine: "postgres";
  connectionSecretRef: string;
  schemaHash: string | null;
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

export type AskResult = {
  status: "ok";
  cached: boolean;
  sql: string;
  rows: Record<string, unknown>[];
  rowCount: number;
  // Omitted in JSON-no-summary mode (Accept: application/json), present
  // by default + in SSE mode.
  summary?: string;
};

export type AskError =
  | { status: "db_not_found" }
  | { status: "schema_unavailable" }
  | { status: "db_misconfigured"; message: string }
  | { status: "db_unreachable"; message: string }
  | { status: "sql_rejected"; reason: string }
  | { status: "llm_failed"; message: string }
  | { status: "rate_limited"; limit: number; count: number };

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
export type OrchestrateEvent =
  | { type: "plan_pending" }
  | { type: "plan"; sql: string; cached: boolean }
  | { type: "rows"; rows: Record<string, unknown>[]; rowCount: number }
  | { type: "summary"; summary: string };

// Re-export so deps using QueryResult don't need a second @nlqdb/db
// import in callers.
export type { QueryResult };
