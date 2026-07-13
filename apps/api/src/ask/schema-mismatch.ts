// SK-ASK-016 / SK-ASK-019 — deterministic missing-relation classifier
// for the `/v1/ask` exec catch. Lives here (not inline in orchestrate)
// so the happy path stays a clean cache → plan → exec arc.

import { trace } from "@opentelemetry/api";
import { Nonrecoverable } from "./retry.ts";
import { SchemaMismatchError } from "./types.ts";

const TABLE_MISSING_MSG = /relation .* does not exist/i;
const SCHEMA_MISSING_MSG = /schema .* does not exist/i;

export type SchemaMismatchContext = {
  dbId: string;
  goal: string;
  planSql: string;
  cacheHit: boolean;
  planModel: string;
};

// Returns a `Nonrecoverable` ready to throw when `err` is a PG missing-
// relation / missing-schema error, or `null` otherwise. Stamps the
// active span with structured context and emits one JSON `console.error`
// line so the orphan-schema cohort stays greppable in Workers Logs.
export function classifySchemaError(
  err: unknown,
  ctx: SchemaMismatchContext,
): Nonrecoverable | null {
  const code = (err as { code?: string }).code;
  const msg = err instanceof Error ? err.message : String(err);
  const isSchemaMissing = code === "3F000" || SCHEMA_MISSING_MSG.test(msg);
  const isTableMissing = code === "42P01" || TABLE_MISSING_MSG.test(msg);
  if (!isSchemaMissing && !isTableMissing) return null;
  const reason: "schema_missing" | "table_missing" = isSchemaMissing
    ? "schema_missing"
    : "table_missing";
  const pgCode = code === "3F000" || code === "42P01" ? code : "msg_match";
  recordSchemaMismatch({ ...ctx, reason, pgCode, pgMessage: msg });
  // Carry the SQLSTATE onto the error so the orchestrator can persist it to
  // the KV diag sink (SK-ASK-023) — the span + console line above are the
  // only record today, and both vanish on preview/e2e invocations.
  return new Nonrecoverable(
    "schema_mismatch",
    new SchemaMismatchError([], [], { pgCode, pgMessage: msg }),
  );
}

// The exec catch-all (`db_unreachable`) was a black hole: an exec error
// that is neither missing-relation nor replannable was swallowed with no
// SQLSTATE recorded anywhere — the 2026-07-11 adopted-DB ACL gap (SET
// LOCAL ROLE failing deterministically) hid behind "Couldn't reach the
// database" across nine e2e runs. Same load-bearing-log lesson as
// SK-ASK-019: emit one structured line + span attributes so the next
// mislabeled class is greppable in a single run. Returns the extracted
// (pgCode, pgMessage) so the caller can persist them where preview
// invocations — which log nowhere — still reach (SK-ASK-023).
export function recordExecUnreachable(
  err: unknown,
  ctx: SchemaMismatchContext,
): { pgCode: string; pgMessage: string } {
  const truncate = (s: string) => s.slice(0, 500);
  const code = (err as { code?: string }).code;
  const pgCode = typeof code === "string" ? code : "none";
  const message = truncate(err instanceof Error ? err.message : String(err));
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttribute("nlqdb.ask.db_unreachable.pg_code", pgCode);
    span.setAttribute("nlqdb.ask.db_unreachable.pg_message", message);
    span.setAttribute("nlqdb.ask.db_unreachable.db_id", ctx.dbId);
  }
  console.error(
    JSON.stringify({
      event: "exec_db_unreachable",
      pg_code: pgCode,
      pg_message: message,
      db_id: ctx.dbId,
      goal: truncate(ctx.goal),
      sql: truncate(ctx.planSql),
      cache_hit: ctx.cacheHit,
      plan_model: ctx.planModel,
    }),
  );
  return { pgCode, pgMessage: message };
}

function recordSchemaMismatch(
  detail: SchemaMismatchContext & {
    reason: "schema_missing" | "table_missing";
    pgCode: string;
    pgMessage: string;
  },
): void {
  const truncate = (s: string) => s.slice(0, 500);
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttribute("nlqdb.ask.schema_mismatch.reason", detail.reason);
    span.setAttribute("nlqdb.ask.schema_mismatch.pg_code", detail.pgCode);
    span.setAttribute("nlqdb.ask.schema_mismatch.db_id", detail.dbId);
    span.setAttribute("nlqdb.ask.schema_mismatch.sql", truncate(detail.planSql));
    span.setAttribute("nlqdb.ask.schema_mismatch.goal", truncate(detail.goal));
    span.setAttribute("nlqdb.ask.schema_mismatch.pg_message", truncate(detail.pgMessage));
    span.setAttribute("nlqdb.ask.schema_mismatch.cache_hit", detail.cacheHit);
  }
  // Structured log so head-sampling can't drop the rare orphan-schema
  // events the next prompt-tuning pass needs.
  console.error(
    JSON.stringify({
      event: "schema_mismatch",
      reason: detail.reason,
      pg_code: detail.pgCode,
      pg_message: truncate(detail.pgMessage),
      db_id: detail.dbId,
      goal: truncate(detail.goal),
      sql: truncate(detail.planSql),
      cache_hit: detail.cacheHit,
      plan_model: detail.planModel,
    }),
  );
}
