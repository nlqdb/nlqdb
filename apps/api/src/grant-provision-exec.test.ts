// EK-06 box 2 — grant-role provisioning executor tests (SK-EKP-008, the
// DB-role half, sub-piece (c), provision leg). The pure batch's contents
// are covered by `grant-provision.test.ts`; this file asserts the executor
// runs that batch in ONE transaction (single Neon round trip), caps it with
// a `statement_timeout`, and fails closed — propagating a Postgres error so
// the mint route leaves no orphan "active" grant.

import { trace } from "@opentelemetry/api";
import { describe, expect, it } from "vitest";
import type { PgClient, PgTransactionStatement } from "./db-create/types.ts";
import { provisionGrantRole } from "./grant-provision-exec.ts";
import { grantRoleName } from "./grant-role.ts";

const GRANT_ID = "11111111-2222-3333-4444-555555555555";
const SCHEMA = "abcdef0123456789";

// Records the batch(es) it was asked to run; `query` is unused by the
// executor and throws to prove the executor only takes the batched path.
function fakePg(onTransaction?: () => void): {
  pg: PgClient;
  batches: PgTransactionStatement[][];
} {
  const batches: PgTransactionStatement[][] = [];
  const pg: PgClient = {
    query: () => {
      throw new Error("query() must not be called — provisioning is batched");
    },
    transaction: async (statements) => {
      batches.push(statements);
      onTransaction?.();
      return statements.map(() => ({ rows: [], rowCount: 0 }));
    },
  };
  return { pg, batches };
}

const tracer = trace.getTracer("test");

describe("provisionGrantRole — one transaction, capped, fail-closed", () => {
  it("runs the whole batch in a single transaction", async () => {
    const { pg, batches } = fakePg();
    await provisionGrantRole(tracer, pg, {
      grantId: GRANT_ID,
      schemaName: SCHEMA,
      scope: ["lessons", "students"],
    });
    expect(batches).toHaveLength(1);
  });

  it("caps the batch with a leading statement_timeout, then the DDL", async () => {
    const { pg, batches } = fakePg();
    await provisionGrantRole(tracer, pg, {
      grantId: GRANT_ID,
      schemaName: SCHEMA,
      scope: ["lessons"],
    });
    expect(batches).toHaveLength(1);
    const sqls = (batches[0] ?? []).map((s) => s.sql);
    expect(sqls[0]).toBe("SET LOCAL statement_timeout = '30s'");
    const role = await grantRoleName(GRANT_ID);
    // The pure DDL follows the cap: role create first, SELECT on the scope,
    // FORCE RLS — a spot-check that the executor forwards the real batch.
    expect(sqls.some((s) => s.includes(`CREATE ROLE "${role}"`))).toBe(true);
    expect(sqls).toContain(`GRANT SELECT ON "${SCHEMA}"."lessons" TO "${role}"`);
    expect(sqls).toContain(`ALTER TABLE "${SCHEMA}"."lessons" FORCE ROW LEVEL SECURITY`);
  });

  it("propagates a Postgres failure (mint fails closed, no orphan grant row)", async () => {
    const { pg } = fakePg(() => {
      throw new Error("permission denied");
    });
    await expect(
      provisionGrantRole(tracer, pg, { grantId: GRANT_ID, schemaName: SCHEMA, scope: ["lessons"] }),
    ).rejects.toThrow(/permission denied/);
  });

  it("fails closed on an empty scope (the pure builder refuses it)", async () => {
    const { pg, batches } = fakePg();
    await expect(
      provisionGrantRole(tracer, pg, { grantId: GRANT_ID, schemaName: SCHEMA, scope: [] }),
    ).rejects.toThrow(/empty scope/);
    // The builder throws before any transaction is attempted.
    expect(batches).toHaveLength(0);
  });
});
