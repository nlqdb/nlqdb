// Grant-role provisioning executor (SK-EKP-008, EK-06 box 2 — the DB-role
// half, sub-piece (c), provision leg). Runs the pure `buildGrantRoleDdl`
// batch (`grant-provision.ts`) against the shared Neon branch in one
// spanned transaction, so minting a grant stands up the per-grant,
// non-owner, SELECT-only role the cross-tenant exec path (`grant-exec.ts`)
// later assumes with `SET LOCAL ROLE`. Kept out of `grant-provision.ts` so
// that module stays a pure, DB-free string builder the unit tests and both
// callers agree on (the `neon-provision.ts` builder/executor split).
//
// Ordering (mirrors `neon-provision.ts`'s "Postgres first, D1 second"
// two-system transaction): the mint route provisions the role BEFORE it
// writes the D1 `grants` row. A later D1 failure then leaves only an orphan
// role — harmless and idempotent (the DO-block create re-runs cleanly, and
// a role no `grants` row points at is never assumed, since `getActiveGrant`
// resolves the grant from D1 first). The reverse order would leave an
// "active" grant whose every buyer query fails closed on a missing role —
// worse for the seller (P6).
//
// GLOBAL-014 — the batch runs in one `db.transaction` span mirroring the
// provisioner's shape (statement count, batch_call), so the mint's DB
// round-trip is observable. A 30 s `statement_timeout` caps a pathological
// DDL/connection so the mint request can't hang the Worker (SK-HDC-010,
// the same ceiling `neon-provision.ts` uses).

import { SpanStatusCode, type Tracer } from "@opentelemetry/api";
import type { PgClient } from "./db-create/types.ts";
import { buildGrantRoleDdl } from "./grant-provision.ts";

export async function provisionGrantRole(
  tracer: Tracer,
  pg: PgClient,
  input: { grantId: string; schemaName: string; scope: string[] },
): Promise<void> {
  const ddl = await buildGrantRoleDdl(input);
  const statements = [
    { sql: "SET LOCAL statement_timeout = '30s'" },
    ...ddl.map((sql) => ({ sql })),
  ];
  await tracer.startActiveSpan("db.transaction", async (span) => {
    span.setAttribute("db.system", "postgresql");
    span.setAttribute("db.transaction.statement_count", statements.length);
    span.setAttribute("db.transaction.batch_call", true);
    span.setAttribute("nlqdb.grants.provision", true);
    try {
      await pg.transaction(statements);
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw err;
    } finally {
      span.end();
    }
  });
}
