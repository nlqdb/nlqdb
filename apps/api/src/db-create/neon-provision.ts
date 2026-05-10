// db.create — Neon provisioner. Applies a validated DDL list to a
// fresh schema on the shared Neon branch and registers the new db
// in D1's `databases` table (migration 0001_init.sql).
//
// Tenancy model: docs/architecture.md §3.6.6 — Phase 1 puts every db on a
// single shared Neon branch as a schema. Isolation is layered:
//   1. per-db schema (search_path on the read path)
//   2. per-tenant role with USAGE only on its own schemas
//   3. row-level security policy on every table, bound to
//      `current_setting('app.tenant_id', true)`
// Cross-tenant leak therefore requires three independent failures —
// see docs/research-receipts.md §6 (instatunnel multi-tenant RLS
// post-mortem) for the prior art that motivated the layering.
//
// Atomicity: Postgres + D1 form a two-system transaction. We commit
// Postgres first (one HTTP round-trip via `pg.transaction([...])`,
// SK-HDC-012), then INSERT D1; on D1 failure we best-effort DROP
// the orphan schema. The reverse order (D1 first) would leave a
// phantom registry row pointing at a non-existent schema, which the
// /v1/ask read path can't recover from. An orphan schema is
// recoverable by a background sweep.
//
// Observability: GLOBAL-014 + docs/features/hosted-db-create/FEATURE.md
// — the BEGIN…COMMIT batch lives in one `db.transaction` span carrying
// the statement count. Per-statement `db.query` spans are not emitted
// for the batched path (one HTTP call ⇒ one span); the cleanup path's
// `DROP SCHEMA` still uses `pg.query` and emits its own span. D1 calls
// are in-process Workers bindings and follow the existing api-app
// convention of un-spanned access.
//
// SQL injection: SK-HDC-009 — every identifier (schema/table/column)
// passes `assertSafeIdentifier` before quoting; every value is
// either parameterised ($N) or escaped via `escapeSqlLiteral`. The
// LLM-emitted plan is Zod-validated upstream (SK-HDC-002/003); this
// module is the last-mile defense.

import { dbDurationMs } from "@nlqdb/otel";
import { SpanStatusCode, type Tracer, trace } from "@opentelemetry/api";
import type {
  PgClient,
  PgTransactionStatement,
  ProvisionArgs,
  ProvisionDeps,
  ProvisionFailureReason,
  ProvisionResult,
  SchemaPlan,
} from "./types.ts";

export type {
  PgClient,
  ProvisionArgs,
  ProvisionDeps,
  ProvisionFailureReason,
  ProvisionFn,
  ProvisionResult,
} from "./types.ts";

export async function provisionDb(
  deps: ProvisionDeps,
  args: ProvisionArgs,
): Promise<ProvisionResult> {
  // Tracer is acquired per-call so it binds to whatever provider is
  // installed when the call runs — tests use `installTelemetryForTest`
  // (SK-OBS-005); production gets the per-request provider.
  const tracer = trace.getTracer("@nlqdb/api/db-create");

  const schemaName = stripDbPrefix(args.dbId);
  assertSafeIdentifier(schemaName, "schemaName");

  // D1 idempotency gate: if the registry already has a row for this
  // dbId, the orchestrator generated a colliding id (caller bug).
  // We refuse to re-provision; orchestrator regenerates and retries.
  // No Postgres tx started, so `rolled_back: false`.
  const existing = await deps.d1
    .prepare("SELECT id FROM databases WHERE id = ?")
    .bind(args.dbId)
    .first<{ id: string }>();
  if (existing) {
    return { ok: false, reason: "schema_already_exists", rolled_back: false };
  }

  const tenantHash = await sha256Hex(args.tenantId, 16);
  const roleName = `tenant_${tenantHash}`;

  // SK-HDC-012 — build the full provision batch as one statement
  // list. Neon's `transaction([...])` sends them in a single HTTP
  // request wrapped in a server-side BEGIN/COMMIT. Postgres
  // transactional DDL guarantees full rollback on any statement
  // failure (CREATE SCHEMA / TABLE / POLICY / INSERT all roll back;
  // CREATE INDEX CONCURRENTLY is the only DDL exception, and our
  // compiler doesn't emit CONCURRENTLY).
  //
  // Identifier safety: schemaName + roleName + per-table names already
  // pass `assertSafeIdentifier` before this point, so direct double-
  // quoted interpolation is safe (SK-HDC-009).
  const tenantLiteral = escapeSqlLiteral(args.tenantId);
  const statements: PgTransactionStatement[] = [];

  // 30 s default cap so a misbehaving Neon connection or a pathological
  // DDL expression can't hold the Worker open indefinitely (SK-HDC-010).
  // Per-statement bumps to 600 s for index DDL apply inside the loop
  // below. `SET LOCAL` scopes to the transaction; the whole batch is
  // one server-side transaction so SET LOCAL/reset cycles work the same
  // as in the legacy interactive flow.
  statements.push({ sql: "SET LOCAL statement_timeout = '30s'" });

  // SK-HDC-012 dropped the `CREATE SCHEMA IF NOT EXISTS` + `SELECT 1
  // FROM information_schema.tables` populated-guard pair: a non-guarded
  // CREATE SCHEMA fails with SQLSTATE `42P06` on a true id-suffix
  // collision (~1 in 16M), which we map to `schema_already_exists` and
  // the orchestrator retries with a fresh suffix. The D1 idempotency
  // gate above still catches the prior-run case.
  statements.push({ sql: `CREATE SCHEMA "${schemaName}"` });

  // Postgres has no `CREATE ROLE IF NOT EXISTS`; wrap in a DO block.
  // `roleName` is the hex prefix of a SHA-256, so direct interpolation
  // is safe (no injection surface).
  statements.push({
    sql: `DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${roleName}') THEN
              CREATE ROLE "${roleName}";
            END IF;
          END $$`,
  });
  statements.push({
    sql: `GRANT USAGE ON SCHEMA "${schemaName}" TO "${roleName}"`,
  });

  for (const stmt of args.ddl) {
    // CREATE INDEX on a populated table can run well past 30 s
    // (CREATE TABLE / ALTER TABLE on an empty schema do not).
    // Bump per-statement to 600 s for index DDL only — other
    // statements keep the default 30 s ceiling. SK-HDC-010.
    const isIndexStmt = /\bindex\b/i.test(stmt);
    if (isIndexStmt) {
      statements.push({ sql: "SET LOCAL statement_timeout = '600s'" });
    }
    statements.push({ sql: stmt });
    if (isIndexStmt) {
      statements.push({ sql: "SET LOCAL statement_timeout = '30s'" });
    }
  }

  // RLS comes after DDL — ENABLE ROW LEVEL SECURITY needs the table
  // to exist. Application-side `SET LOCAL app.tenant_id = …` on every
  // request makes the policy match (read/write path's job).
  for (const table of args.plan.tables) {
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

  // Sample-row inserts STAY parameterized (SK-HDC-009 point 2) — only
  // pre-validated identifiers use double-quote interpolation; values
  // travel as `$N` params on each statement.
  for (const row of args.plan.sample_rows) {
    statements.push(buildSampleInsert(schemaName, row));
  }

  const txOutcome = await tracer.startActiveSpan("db.transaction", async (txSpan) => {
    txSpan.setAttribute("db.system", "postgresql");
    txSpan.setAttribute("db.transaction.statement_count", statements.length);
    txSpan.setAttribute("db.transaction.batch_call", true);
    const startedAt = performance.now();
    try {
      await deps.pg.transaction(statements);
      return { tx: { ok: true as const } };
    } catch (err) {
      txSpan.recordException(err as Error);
      txSpan.setStatus({ code: SpanStatusCode.ERROR });
      const reason = mapTransactionError(err);
      return {
        tx: {
          ok: false as const,
          reason,
          rolled_back: true,
        },
      };
    } finally {
      // Mirror packages/db's adapter histogram so dashboards see the
      // batch call alongside per-statement durations from the legacy
      // path. Operation label is `TRANSACTION` to keep it bounded
      // (docs/performance.md §3.3 cardinality budget).
      const elapsed = performance.now() - startedAt;
      dbDurationMs().record(elapsed, { operation: "TRANSACTION" });
      txSpan.end();
    }
  });

  if (!txOutcome.tx.ok) {
    return { ...txOutcome.tx, ok: false };
  }

  // Postgres COMMIT succeeded. D1 INSERT is the second leg of the
  // two-system tx — on failure we leak a schema unless we cleanup.
  // SK-DB-010 — the orchestrator-resolved engine flows in via
  // `args.engine`. Phase 1 still always provisions a Postgres schema
  // here (this file is the Neon provisioner); a non-`postgres` engine
  // would route through a different `provision` dep before W2's
  // Tinybird adapter lands. We persist whatever the orchestrator
  // resolved so the engine column is the canonical record.
  try {
    await deps.d1
      .prepare(
        "INSERT INTO databases (id, tenant_id, engine, connection_secret_ref, schema_hash, created_at, updated_at) " +
          "VALUES (?, ?, ?, ?, ?, unixepoch(), unixepoch())",
      )
      .bind(args.dbId, args.tenantId, args.engine, args.secretRef, args.schemaHash)
      .run();
  } catch (_err) {
    // The D1 INSERT never landed, so only the Postgres schema needs
    // tearing down — `dropSchemaAndRegistry` no-ops on the absent
    // registry row by design (SK-HDC-011).
    await dropSchemaAndRegistry(tracer, deps.pg, deps.d1, args.dbId, schemaName);
    return { ok: false, reason: "registry_insert_failed", rolled_back: true };
  }

  // pkLive is null in the provisioner v0 — `pk_live_<dbId>` minting
  // is the api-keys subsystem's job (`docs/features/api-keys/FEATURE.md`),
  // not the provisioner's. The orchestrator handles the anonymous-vs-
  // authed split before issuing the key. Tracked as a Phase-1 follow-up.
  return {
    ok: true,
    dbId: args.dbId,
    schemaName,
    pkLive: null,
  };
}

// SK-HDC-007 — split the provisioner abstraction from day one. Phase 4
// wires `registerByoDb` for the BYO `POST /v1/db/connect` endpoint
// (docs/architecture.md §3.6.7). Today it throws so the orchestrator's
// injection seam is real, not theoretical, and so a Phase 4 PR is a
// function-body fill-in rather than a rebuild.
export async function registerByoDb(
  _deps: ProvisionDeps,
  _args: ProvisionArgs,
): Promise<ProvisionResult> {
  throw new Error(
    "registerByoDb: BYO Postgres lands in Phase 4 — see docs/architecture.md §3.6.7 / SK-HDC-007",
  );
}

function stripDbPrefix(dbId: string): string {
  if (!dbId.startsWith("db_")) {
    throw new Error(`provisionDb: dbId must start with "db_", got "${dbId}"`);
  }
  return dbId.slice(3);
}

// SK-HDC-009 — identifier guard. Defense in depth against a
// compromised compiler or a hand-rolled caller. Postgres identifiers
// in our world are `[a-zA-Z_][a-zA-Z0-9_]*`; reject anything else
// before quoting so a malformed table name can't break out of the
// double-quoted form.
function assertSafeIdentifier(value: string, label: string): void {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`provisionDb: unsafe ${label} "${value}"`);
  }
  if (value.length > 63) {
    throw new Error(`provisionDb: ${label} "${value}" exceeds Postgres 63-char identifier limit`);
  }
}

// SK-HDC-009 — single-quote escape for SQL string literals. Used
// only where parameterisation isn't possible (DDL — `CREATE POLICY
// USING (... = '<tenant_id>')`). Doubling single quotes is the
// canonical Postgres escape; combined with the surrounding `'…'`
// quotes it prevents literal-breakout.
function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function buildSampleInsert(
  schemaName: string,
  row: SchemaPlan["sample_rows"][number],
): PgTransactionStatement {
  // SK-HDC-009 — every identifier validated; every value parameterised.
  assertSafeIdentifier(row.table, "sampleRow.table");
  const columns = Object.keys(row.values);
  for (const col of columns) assertSafeIdentifier(col, "sampleRow.column");

  if (columns.length === 0) {
    return { sql: `INSERT INTO "${schemaName}"."${row.table}" DEFAULT VALUES` };
  }

  const colList = columns.map((c) => `"${c}"`).join(", ");
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
  const params = columns.map((c) => row.values[c]);
  return {
    sql: `INSERT INTO "${schemaName}"."${row.table}" (${colList}) VALUES (${placeholders})`,
    params,
  };
}

// Map a Neon `transaction()` rejection to the existing
// `ProvisionFailureReason` union. Neon rejects with `NeonDbError`
// carrying a Postgres SQLSTATE in `code`; everything else becomes
// the catch-all `transaction_failed`.
function mapTransactionError(err: unknown): ProvisionFailureReason {
  const code = (err as { code?: string } | null)?.code;
  if (code === "42P06") return "schema_already_exists"; // duplicate_schema
  if (code === "42P07") return "ddl_execution_failed"; // duplicate_table
  if (code === "42501") return "ddl_execution_failed"; // insufficient_privilege
  // Sample-row inserts come last in the batch; check_violation /
  // not_null_violation / foreign_key_violation map cleanly here even
  // though Postgres returns them with different SQLSTATEs (23xxx).
  // The DDL chunk above runs first so an integrity error after that
  // implies an INSERT failure.
  if (typeof code === "string" && code.startsWith("23")) return "sample_insert_failed";
  return "transaction_failed";
}

// SK-HDC-011 — single rollback primitive for the create path. Both the
// registry-insert-failed compensation (above) and SK-ASK-011's
// speculative rollback call this. Idempotent + best-effort: missing
// schema or absent registry row is not an error, so retries (manual
// operator intervention or future automated sweeps) can call freely.
// Identifier safety: the public callsites (`provisionDb` here and
// `SpeculativeHandle.rollback`) feed in values that came from
// `assertSafeIdentifier` upstream — but we re-validate at the
// boundary because the function is exported and a future caller
// might forget. Mirrors SK-HDC-009's defense-in-depth posture.
export async function dropSchemaAndRegistry(
  tracer: Tracer,
  pg: PgClient,
  d1: D1Database,
  dbId: string,
  schemaName: string,
): Promise<void> {
  assertSafeIdentifier(schemaName, "schemaName");
  try {
    await runQuery(tracer, pg, `DROP SCHEMA "${schemaName}" CASCADE`);
  } catch {
    // Sweep job picks up orphans; better to surface the original
    // failure to the caller than to mask it with a cleanup error.
  }
  try {
    await d1.prepare("DELETE FROM databases WHERE id = ?").bind(dbId).run();
  } catch {
    // D1 cleanup is best-effort for the same reason — a transient
    // D1 failure shouldn't override the caller's primary error code.
  }
}

// Per-statement `db.query` span emission for the cleanup path —
// GLOBAL-014 + the skill's commentary on it. Mirrors
// `packages/db/src/postgres.ts`'s adapter span shape: same span
// name, same `db.system` / `db.operation` attributes, same
// `nlqdb.db.duration_ms` histogram. The provision path itself runs
// under one `db.transaction` span (SK-HDC-012); this helper covers
// `dropSchemaAndRegistry`'s single `DROP SCHEMA` call.
async function runQuery(
  tracer: Tracer,
  pg: PgClient,
  sql: string,
): Promise<{ rows: Record<string, unknown>[]; rowCount?: number }> {
  const operation = detectOperation(sql);
  return tracer.startActiveSpan(
    "db.query",
    {
      attributes: {
        "db.system": "postgresql",
        "db.operation": operation,
      },
    },
    async (span) => {
      const startedAt = performance.now();
      try {
        return await pg.query(sql);
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        const elapsed = performance.now() - startedAt;
        dbDurationMs().record(elapsed, { operation });
        span.end();
      }
    },
  );
}

// Same semantics as `packages/db/src/postgres.ts:detectOperation` —
// extract the SQL command name per OTel `db.operation.name`. DDL
// uses the "VERB NOUN" pair (`CREATE TABLE`, `DROP INDEX`); other
// commands use the leading verb. Cardinality is naturally bounded.
const DDL_VERBS = new Set(["CREATE", "DROP", "ALTER", "TRUNCATE"]);

function detectOperation(sql: string): string {
  const stripped = sql.replace(/^(?:\s+|--[^\n]*\n?|\/\*[\s\S]*?\*\/)+/, "");
  const verbMatch = stripped.match(/^[A-Za-z]+/);
  if (!verbMatch) return "UNKNOWN";
  const verb = verbMatch[0].toUpperCase();
  if (!DDL_VERBS.has(verb)) return verb;
  const nounMatch = stripped.slice(verbMatch[0].length).match(/^\s+([A-Za-z]+)/);
  return nounMatch?.[1] ? `${verb} ${nounMatch[1].toUpperCase()}` : verb;
}

async function sha256Hex(input: string, hexChars: number): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex.slice(0, hexChars);
}
