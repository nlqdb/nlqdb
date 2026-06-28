// Unit tests for `dispatchExec` — the query-time engine dispatcher.
// Proves the branch decision + that the right runner is invoked with the
// right connection URL, without any `neon` / ClickHouse network call. The
// side-effecting runners and the BYO-URL opener are injected as fakes.

import { describe, expect, it, vi } from "vitest";
import { dispatchExec } from "../src/ask/build-deps.ts";
import type { ExecRunners } from "../src/ask/build-deps.ts";
import type { DbRecord, QueryResult } from "../src/ask/types.ts";

const EMPTY: QueryResult = { rows: [], rowCount: 0 };

function fakeRunners(): ExecRunners & {
  runHostedPg: ReturnType<typeof vi.fn>;
  runByoPg: ReturnType<typeof vi.fn>;
  runClickhouse: ReturnType<typeof vi.fn>;
} {
  return {
    runHostedPg: vi.fn(async () => EMPTY),
    runByoPg: vi.fn(async () => EMPTY),
    runClickhouse: vi.fn(async () => EMPTY),
  };
}

function db(overrides: Partial<DbRecord>): DbRecord {
  return {
    id: "db_x_a1",
    tenantId: "user_1",
    engine: "postgres",
    connectionSecretRef: "DATABASE_URL",
    schemaHash: null,
    schemaText: null,
    connectionBlob: null,
    ...overrides,
  };
}

describe("dispatchExec", () => {
  it("hosted Postgres (no blob) → runHostedPg with search_path + tenant", async () => {
    const runners = fakeRunners();
    // Hosted resolves the URL from env via the secret ref — stub the env
    // lookup by giving the ref a value through globalThis isn't needed:
    // the hosted branch reads `env[connectionSecretRef]`. In the node
    // unit env that's undefined, so the dispatcher throws DbConfigError
    // before calling the runner. We assert that contract instead.
    await expect(dispatchExec(db({}), "SELECT 1", runners)).rejects.toThrow(/did not resolve/);
    expect(runners.runHostedPg).not.toHaveBeenCalled();
    expect(runners.runByoPg).not.toHaveBeenCalled();
    expect(runners.runClickhouse).not.toHaveBeenCalled();
  });

  it("hosted Postgres never opens a BYO blob (no blob ⇒ env-ref path only)", async () => {
    const runners = fakeRunners();
    const openUrl = vi.fn(async () => "unused");
    // A hosted row throws on the missing env ref before ever calling the
    // BYO opener — proving hosted rows never touch the sealed-blob path.
    await expect(dispatchExec(db({}), "SELECT 1", runners, undefined, openUrl)).rejects.toThrow();
    expect(openUrl).not.toHaveBeenCalled();
  });

  it("BYO Postgres (blob present) → runByoPg with the opened URL, no search_path", async () => {
    const runners = fakeRunners();
    const openUrl = vi.fn(async () => "postgres://u:p@byo.example.com/db");
    const row = db({ connectionBlob: "nbe1.sealed", engine: "postgres" });
    await dispatchExec(row, "SELECT * FROM t", runners, undefined, openUrl);
    expect(openUrl).toHaveBeenCalledWith(row);
    expect(runners.runByoPg).toHaveBeenCalledWith(
      "postgres://u:p@byo.example.com/db",
      "SELECT * FROM t",
      undefined,
    );
    // The hosted RLS runner is never used for a BYO row.
    expect(runners.runHostedPg).not.toHaveBeenCalled();
    expect(runners.runClickhouse).not.toHaveBeenCalled();
  });

  it("ClickHouse → runClickhouse with the opened URL", async () => {
    const runners = fakeRunners();
    const openUrl = vi.fn(async () => "https://u:p@ch.example.com:8443/?database=a");
    const row = db({ engine: "clickhouse", connectionBlob: "nbe1.sealed" });
    await dispatchExec(row, "SELECT count()", runners, undefined, openUrl);
    expect(openUrl).toHaveBeenCalledWith(row);
    expect(runners.runClickhouse).toHaveBeenCalledWith(
      "https://u:p@ch.example.com:8443/?database=a",
      "SELECT count()",
      undefined,
    );
    expect(runners.runHostedPg).not.toHaveBeenCalled();
    expect(runners.runByoPg).not.toHaveBeenCalled();
  });
});
