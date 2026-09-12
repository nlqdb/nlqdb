// GLOBAL-041 Phase A step 1 COMPOSE half (SK-SCHEMA-008). Sequences the
// already-built callees into one injected-deps absorb; unwired from `/v1/ask`
// (the hot-path splice is the next slice). The LLM never emits SQL — Zod plan
// in, `compileWriteDdl` + injected `validateCompiledDdl` (SK-HDC-006 layer 2)
// out, then one Neon transaction so widen + write commit or roll back together.

import type { LLMRouter } from "@nlqdb/llm";
import { compileWriteDdl } from "../db-create/compile-write-ddl.ts";
import { extendSchema } from "../db-create/extend-schema.ts";
import type { DdlValidationResult, PgClient } from "../db-create/types.ts";
import { buildWidenBatch, executeWidenBatch, widenedSchema } from "../db-create/widen-provision.ts";
import { rewriteWidenedSchema } from "../db-registry.ts";
import type { QueryResult } from "./types.ts";

export type ExtendDeps = {
  llm: LLMRouter;
  pg: PgClient;
  d1: D1Database;
  // Injected so this module never static-imports `sql-validate-ddl.ts`
  // (libpg_query WASM on the `/v1/ask` read/write path). Same seam as
  // `orchestrateDbCreate`; the hot-path wire passes the real validator.
  validateCompiledDdl: (statements: string[]) => DdlValidationResult;
};

export type ExtendArgs = {
  dbId: string;
  tenantId: string;
  schemaName: string;
  schemaText: string;
  observedHash: string;
  goal: string;
  // Already allow-listed by `sql-validate.ts` upstream; placed last in the
  // batch, never concatenated into DDL.
  writeSql: string;
};

export type ExtendOutcome =
  | {
      ok: true;
      result: QueryResult;
      schemaRewritten: boolean;
      model: string;
      confidence: number;
      // GLOBAL-041 Phase A step 7 — the widen DDL the engine ran to absorb
      // this write (`CREATE TABLE` / `ADD COLUMN`), so the orchestrator can
      // surface it in the response `trace.widen` (SK-TRUST-002 parity). These
      // are the same `compileWriteDdl` statements the batch re-compiled and
      // executed, so they describe exactly what committed.
      widenDdl: string[];
    }
  | {
      ok: false;
      stage: "plan" | "compile" | "exec";
      reason: string;
      sqlState?: string | undefined;
      error?: unknown;
    };

export async function extendOnWrite(deps: ExtendDeps, args: ExtendArgs): Promise<ExtendOutcome> {
  const designed = await extendSchema(
    { llm: deps.llm },
    { goal: args.goal, schema: args.schemaText },
  );
  if (!designed.ok) return { ok: false, stage: "plan", reason: designed.reason };
  const { plan, model, confidence } = designed;

  // Compile then allow-list before the batch builder re-compiles the same
  // plan into the transaction (cheap; both are pure). Skipping the allow-list
  // here would be the only path that executes compiler output unparsed.
  const compiled = compileWriteDdl(plan, args.schemaName);
  if (!compiled.ok) return { ok: false, stage: "compile", reason: compiled.reason };
  const validation = deps.validateCompiledDdl(compiled.statements);
  if (!validation.ok) return { ok: false, stage: "compile", reason: validation.reason };

  const batch = await buildWidenBatch({
    schemaName: args.schemaName,
    tenantId: args.tenantId,
    plan,
    insert: { sql: args.writeSql },
  });
  if (!batch.ok) return { ok: false, stage: "compile", reason: batch.reason };

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

  const last = exec.results.at(-1);
  const result: QueryResult = {
    rows: (last?.rows ?? []) as QueryResult["rows"],
    rowCount: last?.rowCount ?? 0,
  };

  // Best-effort CAS (SK-SCHEMA-011): the write already committed. A lost race
  // or D1 blip leaves D1 one observation behind — never fail the absorb.
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
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "widen_schema_rewrite_failed",
          dbId: args.dbId,
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  return { ok: true, result, schemaRewritten, model, confidence, widenDdl: compiled.statements };
}
