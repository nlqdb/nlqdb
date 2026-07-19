// `/v1/ask kind=create` orchestrator. Pure function — every external
// dep is passed in. Mirrors `apps/api/src/ask/orchestrate.ts` (the
// canonical deps-injected pattern in this repo); tests construct
// stubs, the route handler builds prod deps from the request context
// (env bindings + execution ctx) — see `apps/api/src/ask/build-deps.ts`.
//
// Pipeline implements the typed-plan flow from
// [`docs/architecture.md §3.6.1`](../../../../docs/architecture.md#361-endpoint-shape) +
// [`docs/architecture.md §3.6.2`](../../../../docs/architecture.md#362-typed-plan-pipeline-the-create-path):
//
//   inferSchema → compileDdl → validateCompiledDdl →
//   provision → embedTableCards
//
// Each layer is a separate guardrail (`docs/research-receipts.md
// §1`); the orchestrator's job is to ensure they run in order and
// short-circuit cleanly on any failure.
//
// Rate-limit is NOT in this pipeline — per
// `docs/features/hosted-db-create/FEATURE.md` SK-HDC-008 the per-IP
// (5/hr anonymous) / per-account (20/day authed) check runs in
// `apps/api/src/ask/classifier.ts` before the orchestrator is
// called, where the request-level info needed to discriminate IP
// from account is still in scope.
//
// Sub-modules own their own OTel spans on external calls
// (GLOBAL-014); the orchestrator is in-process and adds no external
// boundaries of its own.
//
// Related skill: `docs/features/hosted-db-create/FEATURE.md` is the
// canonical owner of the create path (SK-HDC-001..008). The
// `kind=create` branch routes here from `/v1/ask` per SK-ASK-001
// in `docs/features/ask-pipeline/FEATURE.md`.

import type { RecentTablesStore } from "../ask/recent-tables.ts";
import { deriveSlug } from "../databases/list.ts";
import type { EngineClassifyDeps, EngineClassifyResult } from "./engine-classify.ts";
import { agentMemoryV1Ddl, agentMemoryV1Plan } from "./presets/agent-memory-v1.ts";
import { pruneUninsertableSampleRows } from "./sample-rows.ts";
import type {
  CompileDdlResult,
  DbCreateArgs,
  DbCreateError,
  DbCreateResult,
  DdlValidationResult,
  EmbedDeps,
  Engine,
  InferSchemaArgs,
  InferSchemaDeps,
  InferSchemaResult,
  LLMRouter,
  PgClient,
  ProvisionFn,
  SchemaPlan,
} from "./types.ts";

export type DbCreateDeps = {
  inferSchema: (deps: InferSchemaDeps, args: InferSchemaArgs) => Promise<InferSchemaResult>;
  compileDdl: (plan: SchemaPlan, schemaName: string) => CompileDdlResult;
  validateCompiledDdl: (statements: string[]) => DdlValidationResult;
  // SK-DB-010 — classifier-default engine selection. Called only when
  // `args.engine` is unset; explicit override skips this LLM call (the
  // mock-call assertion in `engine-classify.test.ts` locks that
  // contract). Always resolves with a usable engine; the floor +
  // fallback live inside the classifier.
  classifyEngine: (deps: EngineClassifyDeps, goal: string) => Promise<EngineClassifyResult>;
  // Per SK-HDC-007 the orchestrator takes a generic ProvisionFn so
  // Phase 1 wires `provisionDb` and Phase 4 wires `registerByoDb`
  // with no orchestrator change.
  provision: ProvisionFn;
  // pgvector writer for table-card RAG. Awaited but failure does
  // NOT roll back the provisioned DB — see step 6 below.
  embedTableCards: (deps: EmbedDeps, plan: SchemaPlan, dbId: string) => Promise<void>;
  // Mints a pk_live_ key for the newly-provisioned DB (SK-APIKEYS-001).
  // Optional so unit tests don't need to stub it; production wires
  // `mintPkLiveKey` via `build-deps.ts`. Failures are swallowed —
  // the DB is already committed and queryable without a key.
  mintPkLive?: (dbId: string, tenantId: string) => Promise<string>;
  // 6-char random for the dbId tail. Injectable so tests can
  // assert exact ids; prod uses `crypto.randomUUID().slice(...)` or
  // similar in `build-deps.ts`.
  randomSuffix: () => string;
  // Deterministic SchemaPlan fingerprint, written into the
  // `databases` row so `/v1/ask` plan-cache lookups see a stable
  // hash from the moment the DB exists.
  schemaHash: (plan: SchemaPlan) => string;
  // Forwarded to sub-modules; the orchestrator never calls
  // methods on these directly.
  llm: LLMRouter;
  pg: PgClient;
  d1: D1Database;
  // SK-ASK-012 — push the freshly-provisioned tables onto the
  // principal's recent-tables MRU. Optional so unit tests don't need
  // to stub it; production wires `makeRecentTablesStore` via
  // `build-deps.ts`. Failures inside `touch` are swallowed by the
  // store and never propagate to the response.
  recentTables?: RecentTablesStore;
  // SK-HDC-013 — push tail steps (KV writes, RAG embedding) off the
  // user-visible response path. Production wires
  // `c.executionCtx.waitUntil`; tests can pass a no-op or an awaitable
  // collector. Optional so existing test stubs keep working — when
  // unset, the orchestrator falls back to awaiting tail steps inline
  // (the pre-SK-HDC-013 behaviour).
  waitUntil?: (p: Promise<unknown>) => void;
};

export async function orchestrateDbCreate(
  deps: DbCreateDeps,
  args: DbCreateArgs,
): Promise<DbCreateResult> {
  // SK-HDC-020 — agent-memory preset path. When `args.preset` is set the
  // schema is deterministic: no `classifyEngine`, no `inferSchema`, no
  // `compileDdl` (the LLM is bypassed entirely). The DDL still flows
  // through `validateCompiledDdl` (step 4) + the provisioner, so the
  // SK-HDC-003 defense-in-depth posture is preserved. The branch only
  // changes how `engine`, `plan`, and `ddl` are produced; steps 4–7 are
  // shared with the inferred path.
  const isPreset = args.preset !== undefined;

  // 0. Resolve the engine. Explicit `args.engine` (power-user
  //    override per `GLOBAL-015` / `SK-DB-010`) skips the classifier
  //    LLM call — that's the no-mock-call contract the orchestrator
  //    test enforces. When unset, fall back to the SK-MULTIENG-002
  //    classifier with its built-in confidence floor. The preset pins
  //    `postgres` (its DDL is Postgres-only).
  let engine: Engine;
  if (isPreset) {
    engine = "postgres";
  } else if (args.engine !== undefined) {
    engine = args.engine;
  } else {
    const picked = await deps.classifyEngine({ llm: deps.llm }, args.goal);
    engine = picked.engine;
  }

  // 1. Resolve the SchemaPlan. The preset supplies a deterministic typed
  //    projection (`agentMemoryV1Plan`); otherwise the LLM infers one and
  //    never emits raw DDL (docs/architecture.md §3.6.2 / receipts §2;
  //    SK-HDC-002). Zod validation lives inside `inferSchema`; failures
  //    surface here as `infer_failed`.
  let plan: SchemaPlan;
  // `model` + `confidence` feed the create response's SK-TRUST-002
  // trace block. The preset path never calls an LLM — its DDL is
  // hand-authored and deterministic, so the model slot names the
  // preset instead.
  let model: string;
  let confidence: number;
  if (isPreset) {
    plan = agentMemoryV1Plan();
    model = `preset:${args.preset}`;
    confidence = 1.0;
  } else {
    const inferred = await deps.inferSchema(
      { llm: deps.llm },
      { goal: args.goal, ...(args.name !== undefined ? { name: args.name } : {}) },
    );
    if (!inferred.ok) {
      if (inferred.reason === "plan_invalid") {
        return err({ kind: "infer_failed", reason: "plan_invalid", details: inferred.details });
      }
      return err({ kind: "infer_failed", reason: inferred.reason });
    }
    plan = inferred.plan;
    model = inferred.model;
    confidence = inferred.confidence;
  }

  // 2. Mint the dbId + schema name. Format from docs/architecture.md §3.6:
  //    "db_<slug_hint>_<6-char-random>"; schema name drops the
  //    `db_` prefix (matches Worksheet C's contract). `let` because
  //    SK-HDC-012's collision retry below regenerates the suffix on
  //    `schema_already_exists`.
  const mintIds = (): { dbId: string; schemaName: string } => {
    const s = deps.randomSuffix();
    return { dbId: `db_${plan.slug_hint}_${s}`, schemaName: `${plan.slug_hint}_${s}` };
  };
  let { dbId, schemaName } = mintIds();

  // 3. Produce the schema-qualified DDL. The preset emits its
  //    hand-authored `agent_memory_v1` statements; otherwise the
  //    deterministic compiler emits CREATE TABLE / CREATE INDEX / FK
  //    constraints from the typed plan (SK-HDC-002). Both are pure over
  //    `schemaName`, so the collision-retry below re-derives the preset
  //    DDL when it re-mints the schema name.
  let ddl: string[];
  if (isPreset) {
    ddl = agentMemoryV1Ddl(schemaName);
  } else {
    const compiled = deps.compileDdl(plan, schemaName);
    if (!compiled.ok) {
      return err({
        kind: "compile_failed",
        reason: compiled.reason,
        ...(compiled.details !== undefined ? { details: compiled.details } : {}),
      });
    }
    ddl = compiled.statements;
  }

  // 4. libpg_query parse-validate over the DDL — the second of two DDL
  //    guardrails (docs/architecture.md §3.6.5; SK-HDC-003
  //    defense-in-depth, SK-HDC-006 read/write vs DDL split). Catches
  //    compiler bugs (or a hand-authored preset regression) that smuggled
  //    a destructive verb through. Statement shape is schema-name
  //    independent, so one validation before the retry loop suffices.
  const validation = deps.validateCompiledDdl(ddl);
  if (!validation.ok) {
    return err({
      kind: "ddl_invalid",
      reason: validation.reason,
      statement: validation.statement,
    });
  }

  // 5. Transactional provisioner. Schema + role + RLS + sample
  //    rows + `databases` row + (for non-anonymous tenants)
  //    pk_live row, all in one transaction with rollback on any
  //    structural fail. SK-HDC-007 keeps this dep generic so Phase 4
  //    BYO can swap `provisionDb` for `registerByoDb` with no
  //    orchestrator change.
  //
  //    SK-HDC-012 — when the batch path drops the in-band
  //    `SELECT 1 FROM information_schema.tables` populated guard, a
  //    true 6-hex-suffix collision (~1 in 16M) surfaces as
  //    `schema_already_exists`. Retry up to 3 times with a fresh
  //    `randomSuffix()`; bounded so a misconfigured suffix generator
  //    can't loop forever.
  // `provisionPlan` is normally the inferred plan; SK-HDC-018 may strip
  // its `sample_rows` on a `sample_insert_failed` retry. `collided`
  // re-mints ids only on a `schema_already_exists` clash. (The embed +
  // recent-tables steps below keep using the full `plan` — they're
  // schema concerns, not seed data.)
  let provisioned: Awaited<ReturnType<typeof deps.provision>> | undefined;
  // SK-HDC-019 — deterministic seed salvage. Drop only the sample rows that
  // provably can't insert against the plan's own constraints (forward FK,
  // missing NOT NULL, uncoercible type) so one bad LLM row no longer forces
  // SK-HDC-018's all-or-nothing empty-DB retry. A clean plan prunes nothing,
  // so the happy path is unchanged; the response's `sampleRows` (below) then
  // reflects the actually-seeded set.
  const pruned = pruneUninsertableSampleRows(plan);
  let provisionPlan = pruned.dropped.length > 0 ? { ...plan, sample_rows: pruned.rows } : plan;
  if (pruned.dropped.length > 0) {
    console.warn(
      JSON.stringify({
        msg: "provision_sample_rows_pruned",
        dropped: pruned.dropped.length,
        kept: pruned.rows.length,
        reasons: pruned.dropped.map((d) => d.reason),
      }),
    );
  }
  let collided = false;
  let sampleRowsDropped = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (collided) {
      ({ dbId, schemaName } = mintIds());
      // The DDL is schema-qualified, so re-mint requires re-deriving it.
      // The preset is a pure function of `schemaName`; the inferred path's
      // statements are already compiled and reused as-is.
      if (isPreset) ddl = agentMemoryV1Ddl(schemaName);
      collided = false;
    }
    provisioned = await deps.provision(
      { pg: deps.pg, d1: deps.d1 },
      {
        plan: provisionPlan,
        dbId,
        schemaName,
        ddl,
        tenantId: args.tenantId,
        engine,
        secretRef: args.secretRef,
        schemaHash: deps.schemaHash(plan),
        // The DDL is the smallest faithful schema description the planner
        // needs at /v1/ask time (table names, columns + types, foreign
        // keys). Joined with blank lines so each statement stays legible
        // in the plan prompt.
        schemaText: ddl.join("\n\n"),
        synthetic: args.synthetic === true,
      },
    );
    if (provisioned.ok) break;
    if (provisioned.reason === "schema_already_exists") {
      collided = true;
      continue;
    }
    // SK-HDC-018 — graceful seed-data degradation. A sample row the LLM
    // authored that violates its own schema (FK / NOT NULL / type =
    // SQLSTATE class 22/23 → `sample_insert_failed` per SK-HDC-017) must
    // not 500 the create: the schema is sound, only decorative seed data
    // failed. Retry once without seed rows so the schema-complete DB still
    // commits atomically (each attempt is one transaction — GLOBAL-033 /
    // SK-HDC-012 hold). First-value degrades from "seeded demo" to "empty
    // DB ready to fill", never to HTTP 500.
    if (provisioned.reason === "sample_insert_failed" && !sampleRowsDropped) {
      sampleRowsDropped = true;
      provisionPlan = { ...plan, sample_rows: [] };
      console.warn(
        JSON.stringify({
          msg: "provision_sample_rows_dropped",
          dbId,
          dropped: plan.sample_rows.length,
        }),
      );
      continue;
    }
    break;
  }
  if (!provisioned?.ok) {
    const failure = provisioned ?? {
      ok: false as const,
      reason: "transaction_failed" as const,
      rolled_back: true as const,
    };
    return err({
      kind: "provision_failed",
      reason: failure.reason,
      rolled_back: failure.rolled_back,
    });
  }

  // SK-ASK-012 + SK-HDC-013 — push the recent-tables MRU update off
  // the user-visible response. The dbId is already committed to D1
  // (inside step 5's transaction) and the MRU is a UX-only hint for
  // the next /v1/ask classifier — the response doesn't carry it, so
  // late population is fine. Without a `waitUntil`, we fall back to
  // the pre-SK-HDC-013 inline-await behaviour so existing tests pass.
  //
  // The `Promise.resolve().then(...)` envelope converts any synchronous
  // throw from `touch` (e.g., a future store impl that throws before
  // its first `await`) into a promise rejection the `.catch` can
  // handle — without it, a sync throw escapes the orchestrator and
  // breaks the 200-already-shipped contract on the waitUntil path.
  // Failures are logged so a silent regression in the store doesn't
  // become invisible.
  if (deps.recentTables) {
    const tables = plan.tables.map((t) => t.name);
    const touch = Promise.resolve()
      .then(() =>
        // biome-ignore lint/style/noNonNullAssertion: guarded by `if (deps.recentTables)` above
        deps.recentTables!.touch(args.tenantId, dbId, deriveSlug(dbId), tables),
      )
      .catch((cause) => {
        console.error(
          JSON.stringify({
            msg: "recent_tables_touch_failed",
            dbId,
            message: cause instanceof Error ? cause.message : String(cause),
          }),
        );
      });
    if (deps.waitUntil) deps.waitUntil(touch);
    else await touch;
  }

  // 6. Table-card RAG seed (SK-HDC-013). The dbId is already
  //    committed and queryable; embedding is a RAG-quality concern,
  //    not a correctness one. Pushing it into `waitUntil` removes
  //    Workers-AI / pgvector latency from the response path. The
  //    response already shipped 200; we can't surface `embed_failed`
  //    here — but we DO log so a real embed regression (once the
  //    pgvector slice replaces `noopEmbedTableCards`) doesn't become
  //    a silent black hole.
  //
  //    Test path: when no `waitUntil` is injected, await inline + keep
  //    the typed `embed_failed` envelope so the existing orchestrator
  //    test that pins the failure shape doesn't drift.
  if (deps.waitUntil) {
    deps.waitUntil(
      Promise.resolve()
        .then(() => deps.embedTableCards({ pg: deps.pg, llm: deps.llm }, plan, dbId))
        .catch((cause) => {
          console.error(
            JSON.stringify({
              msg: "embed_table_cards_failed",
              dbId,
              message: cause instanceof Error ? cause.message : String(cause),
            }),
          );
        }),
    );
  } else {
    try {
      await deps.embedTableCards({ pg: deps.pg, llm: deps.llm }, plan, dbId);
    } catch {
      return err({ kind: "embed_failed", dbId });
    }
  }

  // 7. Mint a pk_live_ key for the newly-provisioned DB (SK-APIKEYS-001).
  //    Both anon and authed tenants get a key — callers use it for the
  //    copy-snippet CTA. Failures are swallowed: the DB is already
  //    committed and queryable; the caller gets pkLive: null and the
  //    copy snippet falls back gracefully.
  let pkLive: string | null = null;
  if (deps.mintPkLive) {
    pkLive = await deps.mintPkLive(dbId, args.tenantId).catch(() => null);
  }

  return {
    ok: true,
    dbId,
    schemaName,
    engine,
    pkLive,
    // The provisioned DDL + the model that inferred the plan — the
    // route formats these into the SK-TRUST-002 trace block (the
    // create-path analogue of the read path's compiled-SQL trace).
    ddl,
    model,
    confidence,
    plan: {
      metrics: plan.metrics,
      dimensions: plan.dimensions,
      foreign_keys: plan.foreign_keys,
    },
    // The actually-provisioned seed set — pruned by SK-HDC-019 (only the
    // uninsertable rows) or emptied by SK-HDC-018's retry, so the response
    // never claims rows the DB doesn't hold.
    sampleRows: provisionPlan.sample_rows,
  };
}

function err(error: DbCreateError): DbCreateResult {
  return { ok: false, error };
}
