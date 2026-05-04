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
// Postgres first, then INSERT D1; on D1 failure we best-effort DROP
// the orphan schema. The reverse order (D1 first) would leave a
// phantom registry row pointing at a non-existent schema, which the
// /v1/ask read path can't recover from. An orphan schema is
// recoverable by a background sweep.
//
// Observability: GLOBAL-014 + .claude/skills/hosted-db-create/SKILL.md
// — every Postgres call gets a `db.query` span (catalog row in
// docs/performance.md §3.1); the BEGIN…COMMIT batch is wrapped in a
// `db.transaction` span. D1 calls are in-process Workers bindings
// and follow the existing api-app convention of un-spanned access.
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
  ProvisionArgs,
  ProvisionDeps,
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

  const txOutcome = await tracer.startActiveSpan("db.transaction", async (txSpan) => {
    txSpan.setAttribute("db.system", "postgresql");
    let txStarted = false;
    try {
      await runQuery(tracer, deps.pg, "BEGIN");
      txStarted = true;

      await runQuery(tracer, deps.pg, `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

      // CREATE SCHEMA IF NOT EXISTS is silently no-op when the schema
      // exists. We can't distinguish from the result, so check directly
      // — re-provisioning into a populated schema would mix two tenants'
      // tables under the same RLS scope. Refuse with rollback.
      const populated = await runQuery(
        tracer,
        deps.pg,
        "SELECT 1 FROM information_schema.tables WHERE table_schema = $1 LIMIT 1",
        [schemaName],
      );
      if (populated.rows.length > 0) {
        await runQuery(tracer, deps.pg, "ROLLBACK");
        return {
          tx: { ok: false as const, reason: "schema_already_exists" as const, rolled_back: true },
        };
      }

      // Postgres has no `CREATE ROLE IF NOT EXISTS`; wrap in a DO block.
      // `roleName` is the hex prefix of a SHA-256, so direct interpolation
      // is safe (no injection surface).
      await runQuery(
        tracer,
        deps.pg,
        `DO $$ BEGIN
           IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${roleName}') THEN
             CREATE ROLE "${roleName}";
           END IF;
         END $$`,
      );
      await runQuery(tracer, deps.pg, `GRANT USAGE ON SCHEMA "${schemaName}" TO "${roleName}"`);

      for (const stmt of args.ddl) {
        try {
          await runQuery(tracer, deps.pg, stmt);
        } catch (err) {
          // Preserve the error on the active tx span — the result
          // shape (per main's ProvisionResult error variant) carries
          // only the reason code, so without recording here the
          // root cause is silently dropped.
          txSpan.recordException(err as Error);
          await safeRollback(tracer, deps.pg);
          return {
            tx: {
              ok: false as const,
              reason: "ddl_execution_failed" as const,
              rolled_back: true,
            },
          };
        }
      }

      // RLS comes after DDL — ENABLE ROW LEVEL SECURITY needs the table
      // to exist. Application-side `SET LOCAL app.tenant_id = …` on every
      // request makes the policy match (read/write path's job).
      const tenantLiteral = escapeSqlLiteral(args.tenantId);
      for (const table of args.plan.tables) {
        assertSafeIdentifier(table.name, "tableName");
        await runQuery(
          tracer,
          deps.pg,
          `ALTER TABLE "${schemaName}"."${table.name}" ENABLE ROW LEVEL SECURITY`,
        );
        await runQuery(
          tracer,
          deps.pg,
          `CREATE POLICY tenant_isolation ON "${schemaName}"."${table.name}" ` +
            `USING (current_setting('app.tenant_id', true) = '${tenantLiteral}')`,
        );
      }

      for (const row of args.plan.sample_rows) {
        try {
          await insertSampleRow(tracer, deps.pg, schemaName, row);
        } catch (err) {
          txSpan.recordException(err as Error);
          await safeRollback(tracer, deps.pg);
          return {
            tx: {
              ok: false as const,
              reason: "sample_insert_failed" as const,
              rolled_back: true,
            },
          };
        }
      }

      await runQuery(tracer, deps.pg, "COMMIT");
      return { tx: { ok: true as const } };
    } catch (err) {
      txSpan.recordException(err as Error);
      txSpan.setStatus({ code: SpanStatusCode.ERROR });
      if (txStarted) await safeRollback(tracer, deps.pg);
      return {
        tx: {
          ok: false as const,
          reason: "transaction_failed" as const,
          rolled_back: true,
        },
      };
    } finally {
      txSpan.end();
    }
  });

  if (!txOutcome.tx.ok) {
    return { ...txOutcome.tx, ok: false };
  }

  // Postgres COMMIT succeeded. D1 INSERT is the second leg of the
  // two-system tx — on failure we leak a schema unless we cleanup.
  try {
    await deps.d1
      .prepare(
        "INSERT INTO databases (id, tenant_id, engine, connection_secret_ref, schema_hash, created_at, updated_at) " +
          "VALUES (?, ?, 'postgres', ?, ?, unixepoch(), unixepoch())",
      )
      .bind(args.dbId, args.tenantId, args.secretRef, args.schemaHash)
      .run();
  } catch (_err) {
    // TODO(SK-OBS-*): create a dedicated span for the D1 leg so the
    // root cause is captured here too. The active txSpan has already
    // ended at this point; trace.getActiveSpan() can return undefined
    // in worker contexts. For now the reason code is the only signal
    // surfaced upward.
    await dropSchemaBestEffort(tracer, deps.pg, schemaName);
    return { ok: false, reason: "registry_insert_failed", rolled_back: true };
  }

  // pkLive is null in the provisioner v0 — `pk_live_<dbId>` minting
  // is the api-keys subsystem's job (`.claude/skills/api-keys/SKILL.md`),
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

async function insertSampleRow(
  tracer: Tracer,
  pg: PgClient,
  schemaName: string,
  row: SchemaPlan["sample_rows"][number],
): Promise<void> {
  // SK-HDC-009 — every identifier validated; every value parameterised.
  assertSafeIdentifier(row.table, "sampleRow.table");
  const columns = Object.keys(row.values);
  for (const col of columns) assertSafeIdentifier(col, "sampleRow.column");

  if (columns.length === 0) {
    await runQuery(tracer, pg, `INSERT INTO "${schemaName}"."${row.table}" DEFAULT VALUES`);
    return;
  }

  const colList = columns.map((c) => `"${c}"`).join(", ");
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
  const params = columns.map((c) => row.values[c]);
  await runQuery(
    tracer,
    pg,
    `INSERT INTO "${schemaName}"."${row.table}" (${colList}) VALUES (${placeholders})`,
    params,
  );
}

async function safeRollback(tracer: Tracer, pg: PgClient): Promise<void> {
  try {
    await runQuery(tracer, pg, "ROLLBACK");
  } catch {
    // The connection may already be in a broken state — Neon will
    // reset it on next checkout. Swallow so we still surface the
    // original failure reason to the caller.
  }
}

async function dropSchemaBestEffort(
  tracer: Tracer,
  pg: PgClient,
  schemaName: string,
): Promise<void> {
  try {
    await runQuery(tracer, pg, `DROP SCHEMA "${schemaName}" CASCADE`);
  } catch {
    // Sweep job picks up orphans; better to surface registry_insert_failed
    // to the caller than to mask it with a cleanup error.
  }
}

// Per-statement `db.query` span emission — GLOBAL-014 + the skill's
// commentary on it. Mirrors `packages/db/src/postgres.ts`'s adapter
// span shape: same span name, same `db.system` / `db.operation`
// attributes, same `nlqdb.db.duration_ms` histogram. Existing as a
// local helper because our `PgClient` seam is one level below the
// instrumented `DatabaseAdapter` (we need transactional session
// semantics; the adapter is per-call HTTP).
async function runQuery(
  tracer: Tracer,
  pg: PgClient,
  sql: string,
  params?: unknown[],
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
        return await pg.query(sql, params);
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
