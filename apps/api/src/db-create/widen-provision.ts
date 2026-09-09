// Widen-on-write transaction builder — GLOBAL-041 Phase A step 5,
// SK-SCHEMA-008. One source for the exact statement batch that widens a
// hosted DB's schema and lands the write that needed it, in ONE server-side
// transaction: the ADD COLUMN / CREATE TABLE and the INSERT either both
// commit or both roll back. Pure string builder — no DB access — so the
// batch is unit-testable and the executor (the next slice, GLOBAL-041 Phase
// A step 1 routing) can never disagree with a test on what it runs. The
// `grant-provision.ts` / `neon-provision.ts` posture applied to the widen
// primitive.
//
// The LLM never reaches this batch as DDL text: the extend prompt emits a
// typed `WidenPlan` (GLOBAL-041 Phase A step 2), `extend-schema.ts`
// Zod-validates it (SK-HDC-003 layer 1), and `compile-write-ddl.ts` — the
// ONLY widen-DDL emitter — turns it into the deterministic strings this
// builder orders (layer 2 = the `sql-validate-ddl.ts` allow-list that runs
// over that DDL). The INSERT is the orchestrator's already-validated write
// plan (`sql-validate.ts` allow-list); this builder places it, it does not
// author it.
//
// Runs as the shared Neon OWNER, exactly like `neon-provision.ts`: CREATE
// TABLE / ALTER need owner privileges the least-privilege tenant role does
// not hold, and the owner bypasses RLS, so the INSERT lands into the tenant
// schema the same way the provisioner's sample rows do. The `tenant_isolation`
// policy the batch attaches to a widen-CREATED table therefore guards FUTURE
// tenant-role reads (`build-deps.ts` `SET LOCAL ROLE tenant_<hash>`), not this
// owner-run INSERT. The executor must NOT prepend `SET LOCAL ROLE` — the DDL
// would be denied — so the batch never switches roles.
//
// Identifier safety (SK-HDC-009): `schemaName` and every widen-created table
// name pass `assertSafeIdentifier` before double-quote interpolation, the
// tenant literal in the policy is `escapeSqlLiteral`-escaped, and the role
// name is a SHA-256 hex prefix asserted by `assertTenantRoleName` —
// `CREATE POLICY` / `GRANT` / `ALTER TABLE` identifiers cannot be
// parameterised. `compile-write-ddl.ts` re-checks the same identifiers; the
// re-check here is defense in depth (this builder is exported and a future
// caller might hand-build a plan).

import type { WidenPlan } from "@nlqdb/db";
import { dbDurationMs } from "@nlqdb/otel";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { assertTenantRoleName, tenantRoleName } from "../tenant-role.ts";
import type { CompileWriteFailureReason } from "./compile-write-ddl.ts";
import { compileWriteDdl } from "./compile-write-ddl.ts";
import { assertSafeIdentifier, escapeSqlLiteral, sqlStateOf } from "./neon-provision.ts";
import type { PgClient, PgTransactionResult, PgTransactionStatement } from "./types.ts";

export type WidenBatchResult =
  | { ok: true; statements: PgTransactionStatement[] }
  // The compiler's typed reasons pass straight through — a caller that gets
  // an invalid plan through the Zod gate (a hand-built plan, a reserved
  // identifier) sees the same reason `compile-write-ddl.ts` would return,
  // never a downstream libpg_query reject.
  | { ok: false; reason: CompileWriteFailureReason; details?: unknown };

// Assemble the ordered widen-on-write transaction batch: schema widen (DDL) +
// per-created-table RLS + tenant-role grants + the write, in one BEGIN/COMMIT.
// `insert` is the orchestrator's validated write plan (schema-relative per
// SK-ASK-025 — the `search_path` set below resolves it); the DDL is
// schema-qualified so it is unaffected by `search_path`.
export async function buildWidenBatch(input: {
  schemaName: string;
  tenantId: string;
  plan: WidenPlan;
  insert: PgTransactionStatement;
}): Promise<WidenBatchResult> {
  const { schemaName, tenantId, plan, insert } = input;
  assertSafeIdentifier(schemaName, "schemaName");

  // Compile first: a bad plan fails here with a typed reason and no batch is
  // built (mirrors `neon-provision.ts` refusing before any Postgres work).
  const compiled = compileWriteDdl(plan, schemaName);
  if (!compiled.ok) return compiled;

  const roleName = await tenantRoleName(tenantId);
  assertTenantRoleName(roleName);
  const tenantLiteral = escapeSqlLiteral(tenantId);

  const statements: PgTransactionStatement[] = [];

  // 30 s cap (SK-HDC-010): a widen batch is CREATE/ALTER on an empty or
  // already-populated table plus one INSERT — never the 600 s index case,
  // so no per-statement bump like the provisioner's index loop.
  statements.push({ sql: "SET LOCAL statement_timeout = '30s'" });
  // Resolve the orchestrator's schema-relative INSERT to this DB's schema.
  // The DDL below is schema-qualified, so `search_path` only bites the write.
  statements.push({ sql: "SELECT set_config('search_path', $1, true)", params: [schemaName] });

  for (const sql of compiled.statements) statements.push({ sql });

  // RLS + the `tenant_isolation` policy for each widen-CREATED table — the
  // identical predicate `neon-provision.ts` attaches at create time (one
  // security predicate, emitted one way). An ADD COLUMN target already
  // carries both (the table pre-existed), so only new tables need it.
  for (const table of plan.create_tables) {
    assertSafeIdentifier(table.name, "tableName");
    statements.push({
      sql: `ALTER TABLE "${schemaName}"."${table.name}" ENABLE ROW LEVEL SECURITY`,
    });
    statements.push({
      sql:
        `CREATE POLICY tenant_isolation ON "${schemaName}"."${table.name}" ` +
        `USING (current_setting('app.tenant_id', true) = '${tenantLiteral}')`,
    });
  }

  // Grant the tenant role DML on the new tables + USAGE on their sequences so
  // the least-privilege exec path can read and write them on the next
  // /v1/ask. Only when a table was created: an ADD COLUMN inherits the
  // table's existing grant (a Postgres table privilege covers columns added
  // later). Schema-wide, matching `neon-provision.ts`.
  if (plan.create_tables.length > 0) {
    statements.push({
      sql: `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "${schemaName}" TO "${roleName}"`,
    });
    statements.push({
      sql: `GRANT USAGE ON ALL SEQUENCES IN SCHEMA "${schemaName}" TO "${roleName}"`,
    });
  }

  // The write, last: it references the columns/tables the DDL above just
  // created, so it must run after them, and inside the same transaction so a
  // widen with a doomed INSERT (a constraint the values violate) rolls the
  // whole thing back — the schema never widens for a write that never landed
  // (SK-SCHEMA-008).
  statements.push(insert);

  return { ok: true, statements };
}

// GLOBAL-041 Phase A step 5, EXEC half (SK-SCHEMA-008). Runs the batch
// `buildWidenBatch` assembled as ONE Neon HTTP transaction (server-side
// BEGIN/COMMIT via `pg.transaction([...])`, the same primitive
// `neon-provision.ts` uses), so the widen DDL and the INSERT that needed it
// commit or roll back together. Pure over its injected `PgClient`: tests pass
// a stub, the orchestrator (step 1 routing, next slice) passes the real Neon
// client. Stops at the Postgres commit — rewriting `schema_text` / `schema_hash`
// in D1 (step 6) is the caller's next hop, deferred until the hash-recompute
// decision is settled (FEATURE.md open questions), exactly as the create path
// commits Postgres first then writes D1 (`neon-provision.ts`).
//
// Failure classification mirrors `neon-provision.ts::mapTransactionError` but
// splits along the widen batch's two phases — DDL first, then the INSERT last:
//   - class 42 (undefined object / syntax / privilege) is the DDL phase; our
//     compiler + `sql-validate-ddl.ts` authored that SQL, so a reject here is a
//     compiler/privilege bug, not the user's values → `widen_ddl_failed`.
//   - class 22 (data exception) / class 23 (integrity constraint) can only come
//     from the trailing INSERT — the user's write values → `write_rejected`.
//   - no SQLSTATE (TLS reset / timeout) is infra → `transaction_failed`.
// The raw `error` rides through on failure so the orchestrator wire-in can reuse
// its existing `classifyWriteConstraint` / `classifyDataException` to build the
// precise client envelope (the `write_constraint` clarify, `invalid_value`),
// while `reason` + `sqlState` give this executor a self-contained, testable
// outcome for the span and coarse-grained callers.
export type WidenExecFailureReason = "widen_ddl_failed" | "write_rejected" | "transaction_failed";

export type WidenExecResult =
  | { ok: true; results: PgTransactionResult[] }
  | {
      ok: false;
      reason: WidenExecFailureReason;
      sqlState: string | undefined;
      rolled_back: true;
      error: unknown;
    };

export async function executeWidenBatch(
  deps: { pg: PgClient },
  statements: PgTransactionStatement[],
): Promise<WidenExecResult> {
  // Per-call tracer so it binds to whatever provider is installed when the
  // call runs (tests use `installTelemetryForTest`, prod the per-request
  // provider) — the same acquisition posture as `provisionDb`.
  const tracer = trace.getTracer("@nlqdb/api/db-create");
  return tracer.startActiveSpan("db.transaction", async (span) => {
    span.setAttribute("db.system", "postgresql");
    span.setAttribute("db.transaction.statement_count", statements.length);
    span.setAttribute("db.transaction.batch_call", true);
    // Bounded label so dashboards can split the widen transaction from the
    // create-time provision batch that shares the `db.transaction` span name.
    span.setAttribute("nlqdb.db.transaction.kind", "widen");
    const startedAt = performance.now();
    try {
      const results = await deps.pg.transaction(statements);
      return { ok: true as const, results };
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      // SK-HDC-017 — pin the raw SQLSTATE on the span so `widen_ddl_failed`
      // is never a black hole: an operator can tell an engine-quality DDL
      // failure from an infra one. Bounded 5-char string (or `none`).
      const sqlState = sqlStateOf(err);
      span.setAttribute("db.transaction.error_sqlstate", sqlState ?? "none");
      return {
        ok: false as const,
        reason: mapWidenExecError(sqlState),
        sqlState,
        rolled_back: true as const,
        error: err,
      };
    } finally {
      // Mirror the provisioner's `TRANSACTION`-labelled histogram so the
      // widen batch shows up alongside create batches + per-statement
      // durations (docs/performance.md §3.3 cardinality budget).
      dbDurationMs().record(performance.now() - startedAt, { operation: "TRANSACTION" });
      span.end();
    }
  });
}

// SQLSTATE class → coarse widen-exec reason. Class split follows the batch's
// order (DDL then the trailing INSERT), so the class alone pins the phase.
function mapWidenExecError(sqlState: string | undefined): WidenExecFailureReason {
  if (sqlState === undefined) return "transaction_failed"; // infra (TLS / timeout)
  if (sqlState.startsWith("22") || sqlState.startsWith("23")) return "write_rejected"; // INSERT values
  if (sqlState.startsWith("42")) return "widen_ddl_failed"; // DDL phase — compiler/privilege
  return "transaction_failed";
}
