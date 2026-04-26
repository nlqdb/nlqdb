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
  createdAt: number;
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
  | { status: "db_unreachable"; message: string }
  | { status: "sql_rejected"; reason: string }
  | { status: "llm_failed"; message: string };

// Streaming events for the SSE response path. Sent in order:
//   `plan` → `rows` → `summary` (last is omitted in JSON-no-summary).
export type OrchestrateEvent =
  | { type: "plan"; sql: string; cached: boolean }
  | { type: "rows"; rows: Record<string, unknown>[]; rowCount: number }
  | { type: "summary"; summary: string };

// Re-export so deps using QueryResult don't need a second @nlqdb/db
// import in callers.
export type { QueryResult };
