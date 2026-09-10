// GLOBAL-041 Phase A step 1 (extend routing wire-in), COMPOSE half
// (SK-SCHEMA-008). The pure extend orchestrator: given a write whose plan
// referenced a table/field the observed schema does not yet carry, absorb it
// inline — design the smallest `WidenPlan`, run the widen DDL + the write as
// ONE Neon transaction, then catch D1's `schema_text`/`schema_hash` up so the
// next `/v1/ask` plans against the widened shape. Every external dep is
// injected (llm, pg, d1); the orchestrator's hot-path wire (the EXEC half of
// step 1, next slice) constructs the prod deps and splices this in at the two
// `schema_mismatch` WRITE branches — Defense A (pre-flight `checkSchemaTables`)
// and Defense B (exec `42P01`). Pure over its deps so the composition is
// unit-testable without the full `/v1/ask` harness, exactly like the five
// callees it orders.
//
// It composes, it does not author. Each layer is a built, separately-tested
// slice; this module only sequences them and threads the one transaction:
//   - `extend-schema.ts::extendSchema` — the LLM designs a typed `WidenPlan`,
//     Zod-gated (SK-HDC-003 layer 1); no raw DDL crosses the LLM boundary.
//   - `widen-provision.ts::buildWidenBatch` — compiles that plan to DDL
//     (`compile-write-ddl.ts`, the single emitter, allow-listed by
//     `sql-validate-ddl.ts`) and orders `search_path` → widen DDL → RLS/grants
//     → the write into one BEGIN/COMMIT.
//   - `widen-provision.ts::executeWidenBatch` — runs it as one Neon
//     transaction; widen + write commit or roll back together (SK-SCHEMA-008).
//   - `widen-provision.ts::widenedSchema` + `db-registry.ts::rewriteWidenedSchema`
//     — the step-6 D1 catch-up (SK-SCHEMA-011).
//
// Each layer's typed failure passes straight through as an `ExtendOutcome` the
// orchestrator maps to the client envelope and the KPI-1 counters (SK-SCHEMA-010:
// `ok` ⇒ `asks_extend_ok`, any reject ⇒ `asks_extend_failed`). The absorb never
// silently narrows or invents — a plan that can't be designed, a shape that
// can't compile, or a transaction that rolls back all surface honestly.

import type { LLMRouter } from "@nlqdb/llm";
import { extendSchema } from "../db-create/extend-schema.ts";
import type { PgClient } from "../db-create/types.ts";
import { buildWidenBatch, executeWidenBatch, widenedSchema } from "../db-create/widen-provision.ts";
import { rewriteWidenedSchema } from "../db-registry.ts";
import type { QueryResult } from "./types.ts";

export type ExtendDeps = {
  // Has `extendSchema` — the extend-prompt tier that designs the `WidenPlan`.
  llm: LLMRouter;
  // The DB's Neon HTTP client — `transaction([...])` runs the widen+write batch
  // server-side in one BEGIN/COMMIT (SK-HDC-012). The orchestrator builds it
  // from the resolved connection secret in its hot-path wire.
  pg: PgClient;
  // The control-plane D1 — the single surface `resolveDb` reads, so the
  // schema catch-up writes where the next request will observe it (SK-SCHEMA-002).
  d1: D1Database;
};

export type ExtendArgs = {
  // Identity + observed state — all from the orchestrator's resolved `DbRecord`.
  dbId: string;
  // The owning tenant (the orchestrator's `req.userId`). Scopes both the widen
  // batch's RLS/grants and the D1 CAS.
  tenantId: string;
  // The DB's physical Postgres schema name (the orchestrator's `hostedSchema`).
  // The widen DDL is schema-qualified with it; the batch's `search_path`
  // resolves the schema-relative write against it.
  schemaName: string;
  // `db.schemaText` — the observed DDL the LLM extends (never re-designs) and
  // the base the widened `schema_text` appends to. The caller guarantees it is
  // non-null (the pre-flight/exec mismatch it routes from only fires with a
  // populated schema).
  schemaText: string;
  // `db.schemaHash` the orchestrator planned against — the expected hash for the
  // step-6 compare-and-swap (SK-SCHEMA-011).
  observedHash: string;
  // The user's write goal — what the extend prompt widens the schema toward.
  goal: string;
  // The orchestrator's validated, schema-relative INSERT plan (`sql-validate.ts`
  // already passed it). This module places it last in the batch; it does not
  // author or re-validate it — the allow-list is the boundary and ran upstream.
  writeSql: string;
};

// Where the absorb stopped, so the orchestrator builds the precise envelope:
//   - `plan`    — the extend LLM designed no valid `WidenPlan` (`llm_failed` /
//                 `plan_invalid`). Never the user's fault; the schema is unchanged.
//   - `compile` — a plan that got past the Zod gate could not compile to safe
//                 DDL (a reserved identifier, a not-null/default add). Nothing
//                 touched Postgres.
//   - `exec`    — the one transaction rolled back; `error` carries the raw PG
//                 error so the orchestrator reuses `classifyWriteConstraint` /
//                 `classifyDataException` for a values-level `write_rejected`,
//                 and `sqlState` pins the DDL-vs-values phase (`widen-provision.ts`
//                 maps class 42 → DDL, 22/23 → the trailing INSERT's values).
export type ExtendOutcome =
  | {
      ok: true;
      // The write's committed rows — the LAST statement's result (the batch
      // orders the INSERT last), mapped to the orchestrator's `QueryResult` so
      // it resumes its normal post-write flow (write_no_rows guard, write
      // summary, `ask.completed`) unchanged.
      result: QueryResult;
      // Whether the D1 catch-up landed (the CAS won). `false` is not an error:
      // the write committed; the next request re-observes and re-widens.
      schemaRewritten: boolean;
      // From the extend LLM — ride the orchestrator's SK-TRUST-002 trace block
      // so an extend-absorbed write names the model that designed the widen.
      model: string;
      confidence: number;
    }
  | {
      ok: false;
      stage: "plan" | "compile" | "exec";
      reason: string;
      sqlState?: string | undefined;
      error?: unknown;
    };

export async function extendOnWrite(deps: ExtendDeps, args: ExtendArgs): Promise<ExtendOutcome> {
  // 1. Design the smallest `WidenPlan` that admits the write's fields. The LLM
  //    sees the observed schema as ground truth to extend, never re-design; its
  //    output is Zod-gated inside `extendSchema` before any SQL is compiled.
  const designed = await extendSchema(
    { llm: deps.llm },
    { goal: args.goal, schema: args.schemaText },
  );
  if (!designed.ok) return { ok: false, stage: "plan", reason: designed.reason };
  const { plan, model, confidence } = designed;

  // 2. Order the widen DDL + RLS/grants + the write into one BEGIN/COMMIT. A
  //    plan that passed the Zod gate but can't compile (a reserved identifier)
  //    fails here with the compiler's typed reason and never reaches Postgres.
  const batch = await buildWidenBatch({
    schemaName: args.schemaName,
    tenantId: args.tenantId,
    plan,
    insert: { sql: args.writeSql },
  });
  if (!batch.ok) return { ok: false, stage: "compile", reason: batch.reason };

  // 3. Run it as one Neon transaction — the widen and the write it needed
  //    commit or roll back together (SK-SCHEMA-008), so the schema never widens
  //    for a write that never landed. A rollback returns the raw PG error for
  //    the orchestrator to classify (the user's values vs a DDL/infra fault).
  const exec = await executeWidenBatch({ pg: deps.pg }, batch.statements);
  if (!exec.ok) {
    return {
      ok: false,
      stage: "exec",
      reason: exec.reason,
      sqlState: exec.sqlState,
      error: exec.error,
    };
  }

  // 4. Committed. The write's rows are the batch's LAST result (`buildWidenBatch`
  //    places the INSERT last). Map it into a `QueryResult` — the orchestrator's
  //    post-write flow (SK-TRUST-006 write_no_rows guard, SK-ASK-028 summary)
  //    then treats an extend-absorbed write exactly like an ordinary one.
  const last = exec.results.at(-1);
  const result: QueryResult = {
    rows: (last?.rows ?? []) as QueryResult["rows"],
    rowCount: last?.rowCount ?? 0,
  };

  // 5. Catch D1 up so the NEXT ask plans against the widened shape and the plan
  //    cache re-keys (old entries evict by miss, SK-SCHEMA-005). Best-effort +
  //    compare-and-swap on the observed hash (SK-SCHEMA-011): a lost CAS (a
  //    concurrent widen moved the hash first) or a D1 blip leaves D1 one
  //    observation behind the committed physical schema — which SK-SCHEMA-011's
  //    monotonicity argument bounds at a re-observation, never the committed
  //    write. So the catch-up never fails the absorb: the write already landed.
  let schemaRewritten = false;
  const widened = widenedSchema(args.schemaText, plan, args.schemaName);
  if (widened.ok) {
    try {
      const { updated } = await rewriteWidenedSchema(deps.d1, {
        id: args.dbId,
        tenantId: args.tenantId,
        expectedHash: args.observedHash,
        schemaText: widened.schemaText,
        schemaHash: widened.schemaHash,
      });
      schemaRewritten = updated;
    } catch {
      // D1 write blip — the transaction already committed. Never rethrow: the
      // absorb succeeded; the next request re-observes and re-widens.
    }
  }

  return { ok: true, result, schemaRewritten, model, confidence };
}
