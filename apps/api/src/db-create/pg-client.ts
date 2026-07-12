// Shared-Neon client + secret-ref resolution, in a module whose import
// chain carries NO libpg-query — `build-deps.ts` (the historic home)
// statically pulls the WASM DDL-validator chain, which crashes at
// module scope in cold isolates (SK-ASK-024 has the full story).
// Callers that only need a Postgres client (`anon-adopt-regrant.ts`)
// import from here; do not add imports that reach the WASM graph.
//
// GLOBAL-021 exception: the control-plane provisioner and the ACL
// retarget need the raw Neon client for role/grant/RLS DDL that the
// `DatabaseAdapter.execute()` seam in `@nlqdb/db` does not expose.
// Owner of `@neondatabase/serverless` remains `packages/db/`; this
// file is the db-create carve-out's client half (`build-deps.ts`
// re-exports it for its existing importers).

import { neon } from "@neondatabase/serverless";
import type { PgClient } from "./types.ts";

// `connection_secret_ref` lookup convention — Phase 1 ships one
// shared Postgres on Neon (PLAN §1.6 / SK-DB-007), so every
// `databases` row references the same env var "DATABASE_URL".
export const DEFAULT_SECRET_REF = "DATABASE_URL";

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

// SK-HDC-014 — Neon keep-warm. Defers the Free-tier 5-min compute
// auto-suspend by issuing a tiny `SELECT 1` on the cron interval, in the
// canonical `db.query` span (GLOBAL-014) with `nlqdb.cron: "keep_warm"`
// so dashboards can split pings from user queries. Throws on Neon
// failure; the `scheduled()` handler catches + logs. Lives here (not
// `build-deps.ts`) because the cron isolate never runs the create path's
// WASM shim — importing through the libpg-query chain risked the same
// module-scope crash SK-ASK-024 root-caused.
//
// OTel imports stay lazy: PR #171 post-merge review showed a
// deterministic vitest-pool-workers deadlock when a request-path module
// gains eager OTel imports (repro note in `test/ask.test.ts`
// SK-ANON-013); two dynamic imports per ~4-min cron fire are negligible.
export async function keepNeonWarm(connectionString: string): Promise<number> {
  const { dbDurationMs } = await import("@nlqdb/otel");
  const { SpanStatusCode, trace } = await import("@opentelemetry/api");
  const tracer = trace.getTracer("@nlqdb/api/keep-warm");
  return tracer.startActiveSpan("db.query", async (span) => {
    span.setAttribute("db.system", "postgresql");
    span.setAttribute("db.operation", "SELECT");
    span.setAttribute("db.statement", "SELECT 1");
    // SK-OBS-001 — bounded label (~3 cron expressions ever).
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
