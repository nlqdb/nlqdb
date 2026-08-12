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
  openByoPostgres,
  parseClickhouseUrl,
  parseConnectionUrl,
  type Row,
} from "@nlqdb/db";
import type { LLMRouter } from "@nlqdb/llm";
import { dbDurationMs } from "@nlqdb/otel";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import type { AclRetarget } from "../anon-adopt.ts";
import { makeAclRetarget } from "../anon-adopt-regrant.ts";
import { resolveDb } from "../db-registry.ts";
import { buildEventEmitter } from "../events-emitter.ts";
import { getLLMRouter } from "../llm-router.ts";
import type { MemoryInsertPlan, MemoryScope } from "../memory/remember.ts";
import { kekFromEnv, openSecret } from "../secret-envelope.ts";
import { assertTenantRoleName, isTenantRoleMissingError, tenantRoleName } from "../tenant-role.ts";
import { makeConfirmStash } from "./confirm-stash.ts";
import { makeKvDiagSink } from "./diag.ts";
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
//
// `scope` (E-03 / SK-PIVOT-009) is the per-request memory scope: the
// handler resolves it from the principal + the optional `agentId` /
// `endUserId` / `threadId` request fields and it rides into the exec
// transaction as GUCs. Omitted ⇒ `buildHostedExecSteps` defaults to the
// tenant principal (full visibility), so non-memory callers are unchanged.
export function buildAskDeps(
  envBindings: Cloudflare.Env,
  llm?: LLMRouter,
  scope?: MemoryScope,
): OrchestrateDeps {
  return {
    resolveDb: (id, tenantId) => resolveDb(envBindings.DB, id, tenantId),
    planCache: makePlanCache(envBindings.KV),
    confirmStash: makeConfirmStash(envBindings.KV),
    llm: llm ?? getLLMRouter(),
    exec: (db, sql, signal) => buildExec(db, sql, signal, scope),
    rateLimiter: makeRateLimiter(envBindings.DB),
    firstQuery: makeFirstQueryTracker(envBindings.KV),
    events: buildEventEmitter(envBindings.EVENTS_QUEUE),
    recentTables: makeRecentTablesStore(envBindings.KV),
    // SK-ASK-023 — NODE_ENV distinguishes preview rows (e2e staging)
    // from production rows at pull time.
    diag: makeKvDiagSink(envBindings.KV, envBindings.NODE_ENV ?? "unknown"),
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
  // Hosted Postgres: search_path + app.tenant_id + the E-03 scope GUCs +
  // the user SQL, batched.
  runHostedPg: (
    url: string,
    schemaName: string,
    tenantId: string,
    sql: string,
    signal?: AbortSignal,
    scope?: MemoryScope,
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
  // E-03 memory scope — only the hosted path can honour it (a BYO database
  // has neither our schema nor our policies).
  scope?: MemoryScope,
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
  return runners.runHostedPg(url, schemaName, db.tenantId, sql, signal, scope);
}

// SK-ASK-024 — exec-time tenant-ACL self-heal. The adoption-time retarget
// (SK-ANON-003) is best-effort and one-shot, so a missed retarget used to
// brick the adopted DB permanently (every query died at `SET LOCAL ROLE`,
// 22023). The retarget is idempotent, so when exec fails because the
// row's own tenant role is missing we re-run it and retry the statement
// once. Safe by construction: `resolveDb` already scoped the row to the
// caller, and both the matched role and the heal target derive from
// `db.tenantId` — never from user input. A heal failure records its own
// diag row (`exec_acl_heal_failed`) and surfaces the ORIGINAL exec error.
export async function execWithTenantAclHeal(
  db: DbRecord,
  sql: string,
  run: (db: DbRecord, sql: string, signal?: AbortSignal) => Promise<QueryResult>,
  heal: AclRetarget,
  signal?: AbortSignal,
): Promise<QueryResult> {
  try {
    return await run(db, sql, signal);
  } catch (err) {
    const isHosted = db.engine === "postgres" && !db.connectionBlob;
    if (!isHosted || !isTenantRoleMissingError(err, await tenantRoleName(db.tenantId))) throw err;
    try {
      await heal(db.id, db.tenantId);
    } catch {
      throw err;
    }
    trace.getActiveSpan()?.setAttribute("nlqdb.ask.acl_healed", true);
    return run(db, sql, signal);
  }
}

// Production exec — wires the real Neon + BYO ClickHouse runners. This is
// the `OrchestrateDeps.exec` callback `buildAskDeps` passes.
function buildExec(
  db: DbRecord,
  sql: string,
  signal?: AbortSignal,
  scope?: MemoryScope,
): Promise<QueryResult> {
  return execWithTenantAclHeal(
    db,
    sql,
    (d, s, sig) => dispatchExec(d, s, DEFAULT_RUNNERS, sig, openByoUrl, scope),
    makeAclRetarget(env, "exec_acl_heal_failed"),
    signal,
  );
}

const DEFAULT_RUNNERS: ExecRunners = {
  runHostedPg: runHostedPgQuery,
  runByoPg: runByoPgQuery,
  runClickhouse: runClickhouseQuery,
};

// Per-statement wall-clock cap on every request-path exec. DDL already
// caps at 30s (SK-HDC-010); the read/write exec path had NO cap, so a
// pathological query (or a `pg_sleep` that slipped a guard) could hold a
// Worker + Neon connection open indefinitely. 10s is well above the p99
// budget (docs/performance.md §2.1) yet bounds the worst case. Applied to
// hosted, BYO, and memory Postgres exec transactions.
const EXEC_STATEMENT_TIMEOUT = "10s";

export type HostedExecStep = { text: string; params: unknown[] };

// E-03 / SK-PIVOT-009 — the scope GUCs, in the order they are set. Split
// out so the "always set `app.agent_id`, set the narrowing GUCs only when
// the request carries them" rule lives in one place for both wrappers.
// Fail-closed by construction: a GUC we never set reads as NULL, and NULL
// matches no row under the restrictive policies.
function scopeGucSteps(scope: MemoryScope): HostedExecStep[] {
  const steps: HostedExecStep[] = [
    { text: "SELECT set_config('app.agent_id', $1, true)", params: [scope.agentId] },
  ];
  if (scope.endUserId !== undefined) {
    steps.push({
      text: "SELECT set_config('app.end_user_id', $1, true)",
      params: [scope.endUserId],
    });
  }
  if (scope.threadId !== undefined) {
    steps.push({ text: "SELECT set_config('app.thread_id', $1, true)", params: [scope.threadId] });
  }
  return steps;
}

// The ordered statement list run in one hosted-Postgres exec transaction.
// Order is load-bearing:
//   1. search_path      → unqualified names resolve to the tenant schema.
//   2. app.tenant_id    → satisfies the RLS USING clause.
//   2b. app.agent_id (+ app.end_user_id / app.thread_id when the request
//      carries them) → satisfies the RESTRICTIVE memory-scope policies on
//      an `agent_memory_v1` DB (E-03 / SK-PIVOT-009). `app.agent_id` is set
//      on EVERY hosted exec, defaulting to the tenant id — which is the
//      literal baked into the policy's second arm, so a plain tenant read
//      keeps full visibility while an unset GUC (a wrapper that forgot)
//      would see nothing. Non-memory DBs have no policy reading them, so
//      the extra statements are inert there. Set BEFORE `SET LOCAL ROLE`
//      for symmetry with `app.tenant_id`; re-arming either from inside the
//      user SQL is blocked by the `set_config` / `current_setting` function
//      denylist in `sql-validate.ts` (SK-SQLAL-008).
//   3. statement_timeout→ bounds a runaway query (resource guard).
//   4. SET LOCAL ROLE tenant_<hash> → LEAST PRIVILEGE, the load-bearing
//      cross-tenant isolation control. The shared `neondb_owner` OWNS the
//      tables, so it BYPASSES RLS and can read any tenant's schema by
//      qualifying it (`other_schema.tbl`). Dropping to the per-tenant role
//      — which has USAGE only on its own schemas and, being a non-owner,
//      has RLS actually enforced — makes a cross-schema read fail closed
//      and makes any in-query `set_config('app.tenant_id', …)` GUC
//      re-arming useless. Verified against Neon PG17.
//   5. the user statement (raw SQL, or parameterised for memory writes).
// `set_config(…, true)` is transaction-local (= SET LOCAL) and takes
// params. `SET LOCAL ROLE` / `SET LOCAL statement_timeout` cannot be
// parameterised, so the role name (a validated `tenant_<hex>` identifier)
// and the constant timeout are interpolated.
export function buildHostedExecSteps(
  schemaName: string,
  tenantId: string,
  roleName: string,
  userStep: HostedExecStep,
  // Server-defaulted to the tenant principal (SK-PIVOT-009's zero-config
  // contract): callers that know nothing about agents get full-tenant
  // visibility, callers that pass a narrowed scope get it enforced.
  scope: MemoryScope = { agentId: tenantId },
): HostedExecStep[] {
  assertTenantRoleName(roleName);
  return [
    { text: "SELECT set_config('search_path', $1, true)", params: [schemaName] },
    { text: "SELECT set_config('app.tenant_id', $1, true)", params: [tenantId] },
    ...scopeGucSteps(scope),
    { text: `SET LOCAL statement_timeout = '${EXEC_STATEMENT_TIMEOUT}'`, params: [] },
    { text: `SET LOCAL ROLE "${roleName}"`, params: [] },
    userStep,
  ];
}

// Hosted Postgres (shared Neon). Runs the user SQL under least privilege
// (`SET LOCAL ROLE tenant_<hash>`) + a statement timeout, batched in one
// HTTP round-trip. See `buildHostedExecSteps` for the statement order.
async function runHostedPgQuery(
  url: string,
  schemaName: string,
  tenantId: string,
  sql: string,
  signal?: AbortSignal,
  scope?: MemoryScope,
): Promise<QueryResult> {
  const neonSql = neon(url, { fullResults: true });
  const operation = detectSqlOperation(sql);
  const tracer = trace.getTracer("@nlqdb/api");
  const roleName = await tenantRoleName(tenantId);
  const steps = buildHostedExecSteps(
    schemaName,
    tenantId,
    roleName,
    { text: sql, params: [] },
    scope,
  );

  return tracer.startActiveSpan(
    "db.query",
    { attributes: { "db.system": "postgresql", "db.operation": operation } },
    async (span) => {
      const startedAt = performance.now();
      try {
        signal?.throwIfAborted();
        const results = await neonSql.transaction(
          steps.map((s) => neonSql.query(s.text, s.params)),
          signal ? { fetchOptions: { signal } } : {},
        );
        const userResult = results[results.length - 1];
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
//
// Runs over postgres.js / Workers `connect()` sockets (`SK-DBCONN-002`), not
// the Neon HTTP driver, so a BYO Postgres on ANY host works — `neon()` only
// speaks Neon's HTTP protocol. The socket connects lazily on the first query,
// so the egress re-guard below runs BEFORE any socket opens, and the socket is
// closed in `finally`.
async function runByoPgQuery(url: string, sql: string, signal?: AbortSignal): Promise<QueryResult> {
  const operation = detectSqlOperation(sql);
  const tracer = trace.getTracer("@nlqdb/api");

  return tracer.startActiveSpan(
    "db.query",
    { attributes: { "db.system": "postgresql", "db.operation": operation } },
    async (span) => {
      const startedAt = performance.now();
      const conn = openByoPostgres(url);
      try {
        signal?.throwIfAborted();
        // Re-guard the host before the socket opens — the same DNS-rebind
        // TOCTOU narrowing the ClickHouse path does (GLOBAL-035, byo-connect
        // Open question (c)). The connect-time check ran once; DNS can re-point
        // a name at a private/metadata address before this query, so re-resolve
        // and re-classify here. Fails closed on a private/reserved verdict.
        // postgres.js is lazy, so no socket has been dialled yet.
        const parsed = parseConnectionUrl(url);
        // Fail closed if the stored URL no longer parses — symmetric with
        // runClickhouseQuery, which rejects an unparseable URL rather than
        // skipping the guard and dialling an unvalidated host.
        if (!parsed.ok) {
          throw new DbConfigError("stored Postgres URL failed to parse");
        }
        const verdict = await guardEgressHostResolved(parsed.parsed.host, createDohResolver());
        if (!verdict.ok) throw new DbConfigError(verdict.message);
        // Bound the query wall-clock the same as the hosted path. No
        // search_path / RLS / SET ROLE here — this is the user's own DB with
        // no tenant schema; a statement timeout is the only exec guard that
        // applies. Run in one transaction so `SET LOCAL` scopes the timeout to
        // the user statement even behind a transaction-mode pooler.
        return await conn.runBounded(sql, EXEC_STATEMENT_TIMEOUT, signal);
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        await conn.close();
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
// schema + RLS context. Same statement plan as `buildExec`
// (`buildHostedExecSteps`), but the user statement is **parameterised**
// (`neonSql.query(text, params)`) because the values are arbitrary
// agent-supplied content. Every `set_config(..., true)` call is
// transaction-local, so both `tenant_isolation` and the E-03 restrictive
// scope policies govern the INSERT's write check just as they govern reads.
export async function buildMemoryExec(
  db: DbRecord,
  plan: MemoryInsertPlan,
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
  // Same least-privilege + timeout wrapper as the read/write hosted path
  // (`buildHostedExecSteps`): SET LOCAL ROLE tenant_<hash> so the memory
  // INSERT runs as the tenant role (RLS enforced, no cross-schema reach),
  // not the shared owner. The INSERT itself stays parameterised.
  const roleName = await tenantRoleName(db.tenantId);
  const steps = buildHostedExecSteps(
    schemaName,
    db.tenantId,
    roleName,
    { text: plan.text, params: plan.params },
    // E-03 — the row is tagged with exactly this scope, so the restrictive
    // policies' write check passes and a narrowed agent cannot write a row
    // it would not be allowed to read back.
    plan.scope,
  );

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
          steps.map((s) => neonSql.query(s.text, s.params)),
          signal ? { fetchOptions: { signal } } : {},
        );
        const userResult = results[results.length - 1];
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
