// Production deps for `orchestrateDbCreate`. Mirrors the pattern
// of `apps/api/src/ask/build-deps.ts` (the read/write counterpart):
// route handler calls this once per request to build the deps
// object the pure-function orchestrator expects. Same seam means
// future swap-outs (different rate limiter, different LLM router,
// observability wrapper) land in one place — not duplicated per
// call site.
//
// Skill cross-refs:
// - `docs/features/hosted-db-create/SKILL.md` — owns the create
//   path. SK-HDC-002 (typed plan), SK-HDC-007 (provisioner split:
//   `provisionDb` is wired here; Phase-4 BYO swaps to
//   `registerByoDb` via the same `provision` slot).
// - `docs/features/ask-pipeline/SKILL.md` — the `kind=create`
//   branch routes here from `/v1/ask` per SK-ASK-001.

import { neon } from "@neondatabase/serverless";
import { validateCompiledDdl } from "../ask/sql-validate-ddl.ts";
import { getLLMRouter } from "../llm-router.ts";
import { compileDdl } from "./compile-ddl.ts";
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

export function buildDbCreateDeps(envBindings: Cloudflare.Env): BuildDbCreateDepsResult {
  const databaseUrl = (envBindings as unknown as Record<string, string | undefined>)[
    DEFAULT_SECRET_REF
  ];
  if (!databaseUrl) {
    throw new Error(
      `buildDbCreateDeps: env binding ${DEFAULT_SECRET_REF} is unset; ` +
        "Phase 1 db.create requires the shared Neon connection (see RUNBOOK §4 secrets).",
    );
  }
  return {
    deps: {
      inferSchema,
      compileDdl,
      validateCompiledDdl,
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
    },
    secretRef: DEFAULT_SECRET_REF,
  };
}

// KNOWN INTEGRATION CAVEAT: Neon HTTP is per-request stateless.
// Sequential `BEGIN; ...; COMMIT;` calls each become a separate
// HTTP round-trip with no shared transaction. The provisioner's
// happy-path tests use a stub PgClient that records the call
// sequence, so this caveat won't be caught until live integration.
// Tracked as a Phase-1 follow-up — likely fix is to either (a)
// use Neon's `transaction([...])` batch API, or (b) switch this
// build site to the WebSocket driver. The orchestrator + provisioner
// surface stays unchanged.
function buildPgClient(connectionString: string): PgClient {
  const sql = neon(connectionString, { fullResults: true });
  return {
    async query<T = Record<string, unknown>>(sqlText: string, params?: unknown[]) {
      const result = await sql.query(sqlText, params ?? []);
      return {
        rows: (result.rows as T[]) ?? [],
        rowCount: result.rowCount ?? 0,
      };
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
