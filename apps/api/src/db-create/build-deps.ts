// Production deps for `orchestrateDbCreate`. Mirrors the pattern
// of `apps/api/src/ask/build-deps.ts` (the read/write counterpart):
// route handler calls this once per request to build the deps
// object the pure-function orchestrator expects. Same seam means
// future swap-outs (different rate limiter, different LLM router,
// observability wrapper) land in one place — not duplicated per
// call site.
//
// Skill cross-refs:
// - `docs/features/hosted-db-create/FEATURE.md` — owns the create
//   path. SK-HDC-002 (typed plan), SK-HDC-007 (provisioner split:
//   `provisionDb` is wired here; Phase-4 BYO swaps to
//   `registerByoDb` via the same `provision` slot).
// - `docs/features/ask-pipeline/FEATURE.md` — the `kind=create`
//   branch routes here from `/v1/ask` per SK-ASK-001.

// GLOBAL-021 exception: the control-plane provisioner needs the raw
// Neon client to issue CREATE SCHEMA / role / RLS DDL that the
// `DatabaseAdapter.execute()` seam in `@nlqdb/db` does not expose.
// Owner of `@neondatabase/serverless` remains `packages/db/`; this
// import is the documented one-file carve-out.
import { neon } from "@neondatabase/serverless";
import { mintPkLiveKey } from "../api-keys.ts";
import { makeRecentTablesStore } from "../ask/recent-tables.ts";
import { validateCompiledDdl } from "../ask/sql-validate-ddl.ts";
import { getLLMRouter } from "../llm-router.ts";
import { compileDdl } from "./compile-ddl.ts";
import { classifyEngine } from "./engine-classify.ts";
import { inferSchema } from "./infer-schema.ts";
import { provisionDb } from "./neon-provision.ts";
import type { DbCreateDeps } from "./orchestrate.ts";
import type { EmbedDeps, PgClient, SchemaPlan } from "./types.ts";

// `connection_secret_ref` lookup convention — Phase 1 ships one
// shared Postgres on Neon (PLAN §1.6 / SK-DB-007), so every
// `databases` row references the same env var "DATABASE_URL". The
// route handler resolves this once when constructing deps; the
// orchestrator forwards the resolved string to the provisioner.
const DEFAULT_SECRET_REF = "DATABASE_URL";

export type BuildDbCreateDepsResult = {
  deps: DbCreateDeps;
  // The `secretRef` value the orchestrator should pass through to
  // `ProvisionArgs.secretRef`. Resolved here so the route handler
  // doesn't need to know about ref-name conventions.
  secretRef: string;
};

// SK-HDC-013 — `waitUntil` lifts tail steps (recent-tables MRU,
// table-card embedding) off the response path. Production passes
// `c.executionCtx.waitUntil` from the route handler; the orchestrator
// then fires the tail work into that lifetime so the response returns
// without blocking on it.
// Reads the canonical Phase-1 secret ref. Throws with a precise
// message when unset so an operator-config bug surfaces clearly
// instead of bubbling up as an opaque Neon-side error.
export function resolveDatabaseUrl(envBindings: Cloudflare.Env): string {
  const databaseUrl = (envBindings as unknown as Record<string, string | undefined>)[
    DEFAULT_SECRET_REF
  ];
  if (!databaseUrl) {
    throw new Error(
      `nlqdb: env binding ${DEFAULT_SECRET_REF} is unset; ` +
        "Phase 1 db.create / db.delete requires the shared Neon connection (see RUNBOOK §4 secrets).",
    );
  }
  return databaseUrl;
}

export function buildDbCreateDeps(
  envBindings: Cloudflare.Env,
  waitUntil?: (p: Promise<unknown>) => void,
): BuildDbCreateDepsResult {
  const databaseUrl = resolveDatabaseUrl(envBindings);
  return {
    deps: {
      inferSchema,
      compileDdl,
      validateCompiledDdl,
      // SK-DB-010: classifier-default engine selection. Skipped when
      // the route handler passes an explicit `engine` on `DbCreateArgs`.
      classifyEngine,
      // SK-HDC-007: Phase 1 wires provisionDb. Phase 4 (BYO Postgres
      // per docs/architecture.md §3.6.7) swaps in `registerByoDb` here
      // — single function-body change, no orchestrator refactor.
      provision: provisionDb,
      // pgvector table-card RAG seed. The real implementation lives
      // in a follow-up slice (the embedTableCards module per
      // research-receipts §3 — Pinterest table-card pattern). For
      // today the stub no-ops so the orchestrator's success path is
      // exercisable end-to-end; the orchestrator already handles the
      // `embed_failed` error envelope, but a stub-success keeps
      // /v1/ask returning 200 instead of `embed_failed` on every
      // create until pgvector lands.
      embedTableCards: noopEmbedTableCards,
      randomSuffix: defaultRandomSuffix,
      schemaHash: defaultSchemaHash,
      llm: getLLMRouter(),
      pg: buildPgClient(databaseUrl),
      d1: envBindings.DB,
      // SK-ASK-012: post-provision MRU push. Same KV binding as the
      // ask path so a fresh DB shows up in the principal's recent
      // tables on the very next /v1/ask classify hop.
      recentTables: makeRecentTablesStore(envBindings.KV),
      // SK-APIKEYS-001: mint pk_live_ key for the newly-provisioned DB.
      mintPkLive: (dbId, tenantId) =>
        mintPkLiveKey(envBindings.DB, envBindings.BETTER_AUTH_SECRET, dbId, tenantId),
      // SK-HDC-013: off-critical-path tail steps. Optional — omit in
      // tests / scheduled-handler callers that don't need to defer.
      ...(waitUntil !== undefined ? { waitUntil } : {}),
    },
    secretRef: DEFAULT_SECRET_REF,
  };
}

// SK-HDC-012 — `transaction()` batches the provisioner's full statement
// list (SET LOCAL + CREATE SCHEMA + role + DDL + RLS + sample inserts)
// into one Neon HTTP round trip wrapped server-side in BEGIN/COMMIT.
// Postgres transactional DDL guarantees full rollback on any failure
// (CREATE INDEX CONCURRENTLY is the documented exception, and our
// compiler does not emit CONCURRENTLY). `query` stays for the cleanup
// path's `DROP SCHEMA` and the D1 idempotency `SELECT`.
//
// Exported so the user-delete route (SK-HDC-016) can build a PgClient
// without paying for the LLM router, embed deps, and recent-tables
// store the full `buildDbCreateDeps` wires up — none of which the
// delete path touches. Pairs with `resolveDatabaseUrl(env)` below for
// the secret-ref convention.
export function buildPgClient(connectionString: string): PgClient {
  const sql = neon(connectionString, { fullResults: true });
  return {
    async query<T = Record<string, unknown>>(sqlText: string, params?: unknown[]) {
      const result = await sql.query(sqlText, params ?? []);
      return {
        rows: (result.rows as T[]) ?? [],
        rowCount: result.rowCount ?? 0,
      };
    },
    async transaction(statements) {
      // Each `sql.query(text, params)` call returns a NeonQueryPromise;
      // `sql.transaction([...])` consumes the array and emits a single
      // HTTP request. `isolationLevel: "ReadCommitted"` matches Postgres
      // default — no concurrent reader is racing the schema being
      // created. `fetchOptions` is whole-batch (per CONFIG.md); the
      // route handler's executionCtx already provides the lifetime
      // guard so we don't wire one here.
      const promises = statements.map((s) => sql.query(s.sql, s.params ?? []));
      const results = await sql.transaction(promises, { isolationLevel: "ReadCommitted" });
      return results.map((r) => ({
        rows: (r.rows as Record<string, unknown>[]) ?? [],
        rowCount: r.rowCount ?? 0,
      }));
    },
  };
}

// 6-char random suffix for the dbId tail. Format from
// docs/architecture.md §3.6: db_<slug>_<6 hex>. Uses crypto.randomUUID
// (Workers + Node 18+ + Bun all have it) and slices to keep the
// suffix short enough that the full dbId fits Postgres's 63-char
// identifier limit even for long `slug_hint` values.
function defaultRandomSuffix(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 6);
}

// Deterministic SchemaPlan fingerprint. Consumed by `/v1/ask`'s
// plan cache (`packages/llm` cache key includes `schema_hash`)
// so the cache invalidates on any plan change. The hash is over
// the JSON-canonicalised plan — keys are stable insertion-order
// in Zod-validated objects, so JSON.stringify is enough today.
// If we add Map/Set fields later this needs a canonical-JSON
// helper.
function defaultSchemaHash(plan: SchemaPlan): string {
  // FNV-1a 32-bit — non-cryptographic, fast, deterministic, fine
  // for cache fingerprinting (we don't need collision resistance
  // against adversaries here; only stability across calls). 8 hex
  // chars is plenty for the schema_hash column's fingerprint role.
  let hash = 0x811c9dc5;
  const json = JSON.stringify(plan);
  for (let i = 0; i < json.length; i++) {
    hash = (hash ^ json.charCodeAt(i)) >>> 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

// No-op embed stub. Returns a resolved Promise so the orchestrator's
// step 6 (await embedTableCards) doesn't fail. Tracked as a
// follow-up — the real implementation writes one pgvector row per
// table-card per docs/research-receipts.md §3 (Pinterest pattern).
async function noopEmbedTableCards(
  _deps: EmbedDeps,
  _plan: SchemaPlan,
  _dbId: string,
): Promise<void> {}

// SK-HDC-014 — Neon keep-warm. Defers the Free-tier 5-min compute
// auto-suspend by issuing a tiny `SELECT 1` on the cron interval.
// Lives next to `buildPgClient` so the documented one-file `neon(...)`
// carve-out stays here (no second file imports `@neondatabase/serverless`
// — GLOBAL-021).
//
// Wrapped in the canonical `db.query` span (GLOBAL-014 — every external
// call gets a span) with `db.statement: "SELECT 1"` so dashboards /
// Tempo can pull just the keep-warm pings via that filter. The
// `nlqdb.db.duration_ms{operation:"SELECT"}` histogram lands here too,
// matching the per-statement pattern from `packages/db`'s adapter so
// keep-warm timings show up on the same chart as user queries — the
// case we care about is "keep-warm itself is paying a cold-start tax"
// (= interval too long; pings need to come more often). Throws on
// Neon failure; the caller (`scheduled()` handler) catches + logs.
//
// OTel imports are lazy via dynamic `import()`. Confirmed in PR #171
// post-merge review: hoisting `import { dbDurationMs, ... }` to the
// top of this file causes a **100% deterministic** integration-test
// hang in `apps/api/test/ask.test.ts > SK-ANON-013` (timeout 5 s).
// The test's call path doesn't reach `keepNeonWarm` — yet adding the
// eager OTel import to a module that the route handler dynamically
// imports (`build-deps.ts`) is enough to deadlock vitest-pool-workers
// (`singleWorker: true`). Repro: 3/3 fails with eager imports, 0/3
// fails with lazy. Workaround stays until either Cloudflare narrows
// down the workerd interaction or we move the keep-warm to its own
// module that the request path never touches. The cost is two
// `await import(...)` calls per cron fire (~once / 4 min) — negligible.
export async function keepNeonWarm(connectionString: string): Promise<number> {
  const { dbDurationMs } = await import("@nlqdb/otel");
  const { SpanStatusCode, trace } = await import("@opentelemetry/api");
  const tracer = trace.getTracer("@nlqdb/api/keep-warm");
  return tracer.startActiveSpan("db.query", async (span) => {
    span.setAttribute("db.system", "postgresql");
    span.setAttribute("db.operation", "SELECT");
    span.setAttribute("db.statement", "SELECT 1");
    // SK-OBS-001 — distinguishes keep-warm pings from user-issued
    // `SELECT 1`s in Tempo. Bounded label value (~3 cron expressions
    // ever); no catalog cardinality impact.
    span.setAttribute("nlqdb.cron", "keep_warm");
    const startedAt = performance.now();
    try {
      const sql = neon(connectionString, { fullResults: true });
      await sql.query("SELECT 1");
      return performance.now() - startedAt;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw err;
    } finally {
      dbDurationMs().record(performance.now() - startedAt, { operation: "SELECT" });
      span.end();
    }
  });
}
