// Shared types for the `/v1/ask` orchestration. Kept narrow — only
// the surfaces tests + the handler need.

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
  // Subsequent commits add: rows, summary, traceId.
};

export type AskError =
  | { status: "db_not_found" }
  | { status: "schema_unavailable" }
  | { status: "llm_failed"; message: string };
