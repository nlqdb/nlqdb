// Per-principal MRU of recently-touched tables (SK-ASK-010 / WS1).
// This file is a stub until WS1 lands; today it exposes the
// `RecentTable` type plus a no-op store so `routeAsk` (SK-ASK-009)
// compiles before the cache exists.
//
// WS1 will replace `recentTablesStub` with a KV-backed store and add
// `record(...)` / `load(...)` calls inside the orchestrator. The
// `RecentTable` shape is the contract — `routeAsk` reads `dbId` and
// `table`; the rest (`slug`, `touchedAt`) are bookkeeping for WS1's
// MRU eviction.

export type RecentTable = {
  dbId: string;
  slug: string;
  table: string;
  touchedAt: number;
};

export type RecentTablesStore = {
  load(principalId: string): Promise<RecentTable[]>;
};

export const recentTablesStub: RecentTablesStore = {
  load: async () => [],
};
