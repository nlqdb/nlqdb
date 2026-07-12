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

import { fingerprintSchema } from "@nlqdb/db";
import { apiKeyHmacSecret, mintPkLiveKey } from "../api-keys.ts";
import { makeRecentTablesStore } from "../ask/recent-tables.ts";
import { validateCompiledDdl } from "../ask/sql-validate-ddl.ts";
import { getLLMRouter } from "../llm-router.ts";
import { compileDdl } from "./compile-ddl.ts";
import { classifyEngine } from "./engine-classify.ts";
import { inferSchema } from "./infer-schema.ts";
import { provisionDb } from "./neon-provision.ts";
import type { DbCreateDeps } from "./orchestrate.ts";
import type { EmbedDeps, SchemaPlan } from "./types.ts";

// Client construction + the `connection_secret_ref` convention live in
// `pg-client.ts` — a module with NO libpg-query in its import chain, so
// WASM-free callers (`anon-adopt-regrant.ts`) can import them without
// tripping the Emscripten module-scope init this file's validator chain
// drags in. Re-exported here for the existing importers.
export { buildPgClient, DEFAULT_SECRET_REF, resolveDatabaseUrl } from "./pg-client.ts";

import { buildPgClient, DEFAULT_SECRET_REF, resolveDatabaseUrl } from "./pg-client.ts";

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
        mintPkLiveKey(envBindings.DB, apiKeyHmacSecret(envBindings), dbId, tenantId),
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
// `buildPgClient` (used by the provisioner batch above and the
// user-delete route, SK-HDC-016) lives in `pg-client.ts` — see the
// re-export at the top of this file.

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
// helper. The hash function itself is the shared `fingerprintSchema`
// (`@nlqdb/db`) so the hosted and BYO paths produce one column shape.
function defaultSchemaHash(plan: SchemaPlan): string {
  return fingerprintSchema(JSON.stringify(plan));
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

// SK-HDC-014 — `keepNeonWarm` lives in `pg-client.ts` with the rest of
// the `neon(...)` carve-out: the cron isolate never runs the create
// path's WASM shim, so importing it through this file's libpg-query
// chain risked the same module-scope crash SK-ASK-024 root-caused.
