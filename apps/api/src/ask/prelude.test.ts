// WS5 fixes A + B unit tests. The helpers in `prelude.ts` are pure;
// the route-handler integration just plugs production fns into the
// deps. These tests lock the worksheet's contracts:
//
//   • `kickoffAskPrelude` invokes both reads synchronously (in the
//     same microtask tick) so the cold-path D1 round-trip overlaps
//     with the KV recent-tables fetch (fix A).
//   • `resolveAnonEngineOverride` pins anon principals to postgres
//     so the cheap-tier `classifyEngine` LLM call is skipped on the
//     anon create path (fix B) — explicit `body.engine` always wins.

import { describe, expect, it, vi } from "vitest";
import { kickoffAskPrelude, resolveAnonEngineOverride } from "./prelude.ts";

describe("kickoffAskPrelude (WS5 fix A)", () => {
  it("fires both reads before any await yields", async () => {
    const listSpy = vi.fn(async () => []);
    const kvSpy = vi.fn(async () => []);
    const { listPromise, recentTablesPromise } = kickoffAskPrelude(
      { listDatabases: listSpy, loadRecentTables: kvSpy },
      "anon:abcd1234",
    );
    // Both spies were invoked synchronously (no await between them
    // in the kickoff helper). If the helper had awaited the first
    // read, the second spy would not yet have been called.
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(kvSpy).toHaveBeenCalledTimes(1);
    expect(listSpy).toHaveBeenCalledWith("anon:abcd1234");
    expect(kvSpy).toHaveBeenCalledWith("anon:abcd1234");
    // Returned promises are independent — awaiting one does not
    // block the other from resolving.
    await Promise.all([listPromise, recentTablesPromise]);
  });

  it("returns both promises pending before either resolves (overlap proof)", async () => {
    let listDone = false;
    let kvDone = false;
    const deferLater = (ms: number, done: () => void) =>
      new Promise<[]>((resolve) =>
        setTimeout(() => {
          done();
          resolve([]);
        }, ms),
      );
    const prelude = kickoffAskPrelude(
      {
        listDatabases: () => deferLater(20, () => (listDone = true)),
        loadRecentTables: () => deferLater(10, () => (kvDone = true)),
      },
      "user_1",
    );
    // Right after kickoff: neither has resolved. Both are in flight.
    expect(listDone).toBe(false);
    expect(kvDone).toBe(false);
    await prelude.recentTablesPromise;
    // KV (shorter) is done; D1 still in flight — proves they overlapped.
    expect(kvDone).toBe(true);
    expect(listDone).toBe(false);
    await prelude.listPromise;
    expect(listDone).toBe(true);
  });
});

describe("resolveAnonEngineOverride (WS5 fix B)", () => {
  it("anon principal + no body.engine → 'postgres' (skips classifier)", () => {
    expect(resolveAnonEngineOverride(undefined, "anon")).toBe("postgres");
  });

  it("user principal + no body.engine → undefined (classifier runs)", () => {
    expect(resolveAnonEngineOverride(undefined, "user")).toBeUndefined();
  });

  it("explicit body.engine wins over anon-default (power-user override)", () => {
    expect(resolveAnonEngineOverride("clickhouse", "anon")).toBe("clickhouse");
  });

  it("explicit body.engine wins for authed too (SK-DB-010 power-user path)", () => {
    expect(resolveAnonEngineOverride("clickhouse", "user")).toBe("clickhouse");
    expect(resolveAnonEngineOverride("postgres", "user")).toBe("postgres");
  });
});
