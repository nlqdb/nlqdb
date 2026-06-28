// Production deps for `orchestrateAsk`. Shared between the `/v1/ask`
// and `/v1/chat/messages` handlers so a future seam (swap rate
// limiter, replace LLM router, add tracing wrapper) lands in one
// place — not duplicated per call site.
//
// The Postgres-adapter `exec` callback is created from the worker's
// top-level env via `cloudflare:workers`. It resolves a `databases`
// row's `connection_secret_ref` to a connection URL on every call.

import { env } from "cloudflare:workers";
import { neon } from "@neondatabase/serverless";
import {
  buildClickhouseByoQuery,
  type ClickhouseConnSpec,
  createDohResolver,
  guardEgressHostResolved,
  parseClickhouseUrl,
  parseConnectionUrl,
  type Row,
} from "@nlqdb/db";
import type { LLMRouter } from "@nlqdb/llm";
import { dbDurationMs } from "@nlqdb/otel";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { resolveDb } from "../db-registry.ts";
import { kekFromEnv, openSecret } from "../secret-envelope.ts";
import { buildEventEmitter } from "../events-emitter.ts";
import { getLLMRouter } from "../llm-router.ts";
import { makeFirstQueryTracker } from "./first-query.ts";
import type { OrchestrateDeps } from "./orchestrate.ts";
import { makePlanCache } from "./plan-cache.ts";
import { makeRateLimiter } from "./rate-limit.ts";
import { makeRecentTablesStore } from "./recent-tables.ts";
import { DbConfigError, type DbRecord, type QueryResult } from "./types.ts";

// `llm` defaults to the shared free-tier router (`getLLMRouter`). The
// `/v1/ask` handler passes a per-request override when a BYOLLM lane is
// selected (`resolveAskRouter`), so the swap lands here, not duplicated
// per call site.
export function buildAskDeps(envBindings: Cloudflare.Env, llm?: LLMRouter): OrchestrateDeps {
  return {
    resolveDb: (id, tenantId) => resolveDb(envBindings.DB, id, tenantId),
    planCache: makePlanCache(envBindings.KV),
    llm: llm ?? getLLMRouter(),
    exec: buildExec,
    rateLimiter: makeRateLimiter(envBindings.DB),
    firstQuery: makeFirstQueryTracker(envBindings.KV),
    events: buildEventEmitter(envBindings.EVENTS_QUEUE),
    recentTables: makeRecentTablesStore(envBindings.KV),
    lookupPipeAdvisory: (dbId, queryHash) =>
      lookupPipeAdvisory(envBindings.DB, dbId, queryHash, Date.now()),
  };
}

// `SK-MIGRATE-005`: most recent `clickhouse_pipe_create` audit row for
// `(db_id, query_hash)` within the last 24h, mapped to the
// `PipeAdvisory` shape. Returns null when no row exists or when the
// audit row's `after_json` did not carry a Pipe name (advisory /
// failure rows). The caller treats null as "no surface".
async function lookupPipeAdvisory(
  d1: D1Database,
  dbId: string,
  queryHash: string,
  nowMs: number,
): Promise<{ pipeName: string; createdHoursAgo: number } | null> {
  const cutoffSec = Math.floor((nowMs - 24 * 60 * 60 * 1000) / 1000);
  const row = await d1
    .prepare(
      `SELECT after_json, run_at FROM workload_analyser_runs
       WHERE db_id = ? AND query_hash = ?
         AND kind = 'clickhouse_pipe_create'
         AND run_at >= ?
       ORDER BY run_at DESC LIMIT 1`,
    )
    .bind(dbId, queryHash, cutoffSec)
    .first<{ after_json: string | null; run_at: number }>();
  if (!row?.after_json) return null;
  let pipeName: string | undefined;
  try {
    const parsed = JSON.parse(row.after_json) as { pipeName?: unknown };
    if (typeof parsed.pipeName === "string") pipeName = parsed.pipeName;
  } catch {
    return null;
  }
  if (!pipeName) return null;
  const createdHoursAgo = Math.max(0, Math.floor((nowMs / 1000 - row.run_at) / 3600));
  return { pipeName, createdHoursAgo };
}

// Injectable side-effecting runners so the dispatch + per-engine
// connection wiring is unit-testable without `neon` / ClickHouse network
// calls. Production wires the real Neon + BYO ClickHouse builders
// (`DEFAULT_RUNNERS`); the test passes fakes that record how they were
// called. Each runner receives an already-resolved connection URL.
export type ExecRunners = {
  // Hosted Postgres: search_path + app.tenant_id + the user SQL, batched.
  runHostedPg: (
    url: string,
    schemaName: string,
    tenantId: string,
    sql: string,
    signal?: AbortSignal,
  ) => Promise<QueryResult>;
  // BYO Postgres: the user SQL run directly (no search_path / RLS).
  runByoPg: (url: string, sql: string, signal?: AbortSignal) => Promise<QueryResult>;
  // BYO ClickHouse: rebuild the spec from the URL + run the SQL.
  runClickhouse: (url: string, sql: string, signal?: AbortSignal) => Promise<QueryResult>;
};

// Executes the LLM-emitted SQL against the resolved DB. Dispatches on the
// row's engine + connection shape:
//
//   - `clickhouse` (always a BYO row)            → runClickhouse
//   - `postgres` WITH a `connectionBlob`          → runByoPg (user's own
//     DB; run the SQL directly — no tenant schema / RLS)
//   - `postgres` with NO `connectionBlob` (hosted)→ runHostedPg (the
//     search_path + app.tenant_id RLS transaction)
//
// SQL validation upstream (`validateSql`) is reused as-is for ClickHouse
// this slice — no CH-specific validator yet. Accepted, documented gap.
export async function dispatchExec(
  db: DbRecord,
  sql: string,
  runners: ExecRunners,
  signal?: AbortSignal,
  // Opens a BYO row's sealed connection URL. Injectable so the dispatch
  // is testable without `BYO_SECRET_KEK` in the (node) unit env; prod
  // uses `openByoUrl` (env-backed).
  openUrl: (db: DbRecord) => Promise<string> = openByoUrl,
): Promise<QueryResult> {
  if (db.engine === "clickhouse") {
    const url = await openUrl(db);
    return runners.runClickhouse(url, sql, signal);
  }
  if (db.connectionBlob) {
    const url = await openUrl(db);
    return runners.runByoPg(url, sql, signal);
  }
  const url = (env as unknown as Record<string, string | undefined>)[db.connectionSecretRef];
  if (!url) {
    throw new DbConfigError(
      `connection_secret_ref ${JSON.stringify(db.connectionSecretRef)} did not resolve in env (db_id=${db.id})`,
    );
  }
  const schemaName = db.id.startsWith("db_") ? db.id.slice(3) : db.id;
  return runners.runHostedPg(url, schemaName, db.tenantId, sql, signal);
}

// Production exec — wires the real Neon + BYO ClickHouse runners. This is
// the `OrchestrateDeps.exec` callback `buildAskDeps` passes.
function buildExec(db: DbRecord, sql: string, signal?: AbortSignal): Promise<QueryResult> {
  return dispatchExec(db, sql, DEFAULT_RUNNERS, signal);
}

const DEFAULT_RUNNERS: ExecRunners = {
  runHostedPg: runHostedPgQuery,
  runByoPg: runByoPgQuery,
  runClickhouse: runClickhouseQuery,
};

// Hosted Postgres (shared Neon). Three statements batched in one HTTP
// round-trip:
//   1. set_config('search_path', schemaName, true) — routes unqualified
//      table names to the tenant's schema instead of public.
//   2. set_config('app.tenant_id', tenantId, true) — satisfies the RLS
//      USING clause the provisioner set on every table; without this,
//      current_setting('app.tenant_id', true) = '' and all rows are blocked.
//   3. The user's SQL.
//
// set_config(..., true) is transaction-local (equivalent to SET LOCAL) and
// accepts parameterised values — no identifier injection risk. Schema name
// is derived from db.id by stripping the "db_" prefix, mirroring
// neon-provision.ts's stripDbPrefix.
async function runHostedPgQuery(
  url: string,
  schemaName: string,
  tenantId: string,
  sql: string,
  signal?: AbortSignal,
): Promise<QueryResult> {
  const neonSql = neon(url, { fullResults: true });
  const operation = detectSqlOperation(sql);
  const tracer = trace.getTracer("@nlqdb/api");

  return tracer.startActiveSpan(
    "db.query",
    { attributes: { "db.system": "postgresql", "db.operation": operation } },
    async (span) => {
      const startedAt = performance.now();
      try {
        signal?.throwIfAborted();
        const results = await neonSql.transaction(
          [
            neonSql`SELECT set_config('search_path', ${schemaName}, true)`,
            neonSql`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
            neonSql`${neonSql.unsafe(sql)}`,
          ],
          signal ? { fetchOptions: { signal } } : {},
        );
        const userResult = results[2];
        return {
          rows: (userResult?.rows ?? []) as Row[],
          rowCount: userResult?.rowCount ?? userResult?.rows?.length ?? 0,
        };
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        dbDurationMs().record(performance.now() - startedAt, { operation });
        span.end();
      }
    },
  );
}

// BYO Postgres (the user's own database, connected via /v1/db/connect).
// The connection URL rides the sealed `connectionBlob` (GLOBAL-031); the
// dispatcher opens it and hands the plaintext URL here. We run the user's
// SQL DIRECTLY — no set_config(search_path) / app.tenant_id statements:
// the user's DB has no tenant schema or RLS, so those would error. Tenant
// isolation is at the row level — the `databases` row was already scoped
// to the tenant by `resolveDb`.
async function runByoPgQuery(
  url: string,
  sql: string,
  signal?: AbortSignal,
): Promise<QueryResult> {
  const neonSql = neon(url, { fullResults: true });
  const operation = detectSqlOperation(sql);
  const tracer = trace.getTracer("@nlqdb/api");

  return tracer.startActiveSpan(
    "db.query",
    { attributes: { "db.system": "postgresql", "db.operation": operation } },
    async (span) => {
      const startedAt = performance.now();
      try {
        signal?.throwIfAborted();
        // Re-guard the host before the fetch — the same DNS-rebind TOCTOU
        // narrowing the ClickHouse path does (GLOBAL-035, byo-connect Open
        // question (c)). The connect-time check ran once; DNS can re-point a
        // name at a private/metadata address before this query, so re-resolve
        // and re-classify here. Fails closed on a private/reserved verdict.
        const parsed = parseConnectionUrl(url);
        if (parsed.ok) {
          const verdict = await guardEgressHostResolved(
            parsed.parsed.host,
            createDohResolver(),
          );
          if (!verdict.ok) throw new DbConfigError(verdict.message);
        }
        const result = await neonSql.query(sql, []);
        return {
          rows: (result.rows ?? []) as Row[],
          rowCount: result.rowCount ?? result.rows?.length ?? 0,
        };
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        dbDurationMs().record(performance.now() - startedAt, { operation });
        span.end();
      }
    },
  );
}

// BYO ClickHouse. Rebuild the spec from the opened URL (parser supplies
// host/port/secure/db/user; the password is read off the raw URL — the
// parser strips it as a safe-to-log shape), and run the SQL through the
// BYO query builder with a DNS-rebind re-guard (GLOBAL-035).
async function runClickhouseQuery(
  url: string,
  sql: string,
  signal?: AbortSignal,
): Promise<QueryResult> {
  const parsedResult = parseClickhouseUrl(url);
  if (!parsedResult.ok) {
    throw new DbConfigError("stored ClickHouse URL failed to parse");
  }
  const parsed = parsedResult.parsed;
  let password: string | null = null;
  try {
    const u = new URL(url);
    password = u.password
      ? decodeURIComponent(u.password)
      : (u.searchParams.get("password") ?? null);
  } catch {
    password = null;
  }
  const spec: ClickhouseConnSpec = {
    host: parsed.host,
    port: parsed.port,
    secure: parsed.secure,
    database: parsed.database,
    user: parsed.user,
    password,
  };
  const query = buildClickhouseByoQuery(spec, { resolve: createDohResolver() });
  const operation = detectSqlOperation(sql);
  const tracer = trace.getTracer("@nlqdb/api");

  return tracer.startActiveSpan(
    "db.query",
    { attributes: { "db.system": "clickhouse", "db.operation": operation } },
    async (span) => {
      const startedAt = performance.now();
      try {
        signal?.throwIfAborted();
        const { rows } = await query(sql, {}, signal);
        return { rows, rowCount: rows.length };
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        dbDurationMs().record(performance.now() - startedAt, { operation });
        span.end();
      }
    },
  );
}

// Open a BYO row's sealed connection URL (GLOBAL-031, AAD `dbconn:<id>`).
// A missing blob or unconfigured KEK is an operator/config error, surfaced
// as `DbConfigError` so the orchestrator maps it to `db_misconfigured`.
async function openByoUrl(db: DbRecord): Promise<string> {
  if (!db.connectionBlob) {
    throw new DbConfigError(`BYO row has no connection_blob (db_id=${db.id})`);
  }
  const kek = kekFromEnv(env as { BYO_SECRET_KEK?: string });
  if (!kek) {
    throw new DbConfigError(`BYO_SECRET_KEK is unset; cannot open connection (db_id=${db.id})`);
  }
  return openSecret(db.connectionBlob, { kek, context: `dbconn:${db.id}` });
}

function detectSqlOperation(sql: string): string {
  const stripped = sql.replace(/^(?:\s+|--[^\n]*\n?|\/\*[\s\S]*?\*\/)+/, "");
  const m = stripped.match(/^[A-Za-z]+/);
  return m ? m[0].toUpperCase() : "UNKNOWN";
}

// Executes the deterministic memory-write `INSERT` (E-02) in the tenant's
// schema + RLS context. Same three-statement transaction as `buildExec`
// (set search_path, set app.tenant_id, then the user statement), but the
// third statement is **parameterised** (`neonSql.query(text, params)`)
// because the values are arbitrary agent-supplied content. The two
// `set_config(..., true)` calls are transaction-local, so the
// provisioner's `tenant_isolation` RLS policy governs the INSERT's
// WITH CHECK just as it governs reads.
export async function buildMemoryExec(
  db: DbRecord,
  plan: import("../memory/remember.ts").MemoryInsertPlan,
  signal?: AbortSignal,
): Promise<QueryResult> {
  // Memory writes target the hosted `agent_memory_v1` preset DB (its
  // schema + RLS are ours). A BYO row (ClickHouse, or Postgres with a
  // sealed blob) has neither, so the search_path / app.tenant_id
  // transaction below would be wrong — guard rather than silently
  // mis-execute against a user's own database.
  if (db.engine !== "postgres" || db.connectionBlob) {
    throw new DbConfigError(
      `memory writes are only supported on hosted postgres DBs (db_id=${db.id})`,
    );
  }
  const url = (env as unknown as Record<string, string | undefined>)[db.connectionSecretRef];
  if (!url) {
    throw new DbConfigError(
      `connection_secret_ref ${JSON.stringify(db.connectionSecretRef)} did not resolve in env (db_id=${db.id})`,
    );
  }

  const schemaName = db.id.startsWith("db_") ? db.id.slice(3) : db.id;
  const neonSql = neon(url, { fullResults: true });
  const tracer = trace.getTracer("@nlqdb/api");

  return tracer.startActiveSpan(
    "nlqdb.memory.remember",
    {
      attributes: {
        "db.system": "postgresql",
        "db.operation": "INSERT",
        "nlqdb.memory.table": plan.table,
      },
    },
    async (span) => {
      const startedAt = performance.now();
      try {
        signal?.throwIfAborted();
        const results = await neonSql.transaction(
          [
            neonSql`SELECT set_config('search_path', ${schemaName}, true)`,
            neonSql`SELECT set_config('app.tenant_id', ${db.tenantId}, true)`,
            neonSql.query(plan.text, plan.params),
          ],
          signal ? { fetchOptions: { signal } } : {},
        );
        const userResult = results[2];
        return {
          rows: (userResult?.rows ?? []) as Row[],
          rowCount: userResult?.rowCount ?? userResult?.rows?.length ?? 0,
        };
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        dbDurationMs().record(performance.now() - startedAt, { operation: "INSERT" });
        span.end();
      }
    },
  );
}

// `buildEventEmitter` moved to `apps/api/src/events-emitter.ts` so
// callers that don't import `cloudflare:workers` (notably the gate
// middleware exercised by unit-pool tests) can use it directly.
// Re-exported here so existing imports keep compiling.
export { buildEventEmitter } from "../events-emitter.ts";
