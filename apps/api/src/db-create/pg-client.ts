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
