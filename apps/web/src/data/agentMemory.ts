// nlqdb's own memory DB, aggregated — the `/agents` dogfood block.
//
// This is the launch's proof surface and the fifth `SK-PIVOT-016`
// criterion: nlqdb runs its own ops on its own memory through the
// PUBLIC MCP surface, and shows the result. A visitor reads this and
// concludes "they actually run on this."
//
// The NUMBERS live in `agentMemory.data.json` (a committed snapshot);
// this module only types them. That split exists so the generator
// `apps/web/scripts/gen-agent-memory.mjs` — run by D-02's
// `memory-sync.yml`, OUT of `astro build` (GLOBAL-013 / SK-PIVOT-012) —
// can refresh the numbers from the live DB by rewriting a plain JSON
// file, never hand-parsing TypeScript.
//
// Source of the committed snapshot: the D-04 run-1 workload (2026-08-11),
// verified in prod against `db_agent_memory_v1_3a8a72` via `/v1/run`
// counts. The `docs/` corpus was extracted by the D-01 skill and written
// through the D-02 convergent `/v1/memory/remember` sync; the analytical
// asks ran through the published `@nlqdb/mcp` stdio server (`nlqdb_query`
// → `/v1/ask`, free chain). See
// `docs/features/agent-memory-pivot/worksheets/dogfood/D-04-first-corpus-sync.md`.
//
// AGGREGATES ONLY (SK-PIVOT-016 hard rule). Counts, distributions,
// timestamps, and the result tables of GROUP-BY golden queries — never
// a raw memory row. The dashboard is a PATTERN the wedge invites users
// to copy, and the pattern must not be "publish your memory rows".

import snapshot from "./agentMemory.data.json";

export interface MemoryTableCount {
  /** table in the `agent_memory_v1` schema */
  table: string;
  count: number;
}

export interface MemoryDistribution {
  /** the low-cardinality categorical value (a `kind` / entity `type`) */
  label: string;
  count: number;
}

export interface MemoryGoldenQuery {
  /** the English question the ops agent asked over MCP */
  q: string;
  /** the exact SQL nlqdb compiled and ran (aggregate, no raw rows) */
  sql: string;
  columns: [string, string];
  rows: Array<[string, number]>;
}

export interface AgentMemorySnapshot {
  /** ISO date this snapshot was read from prod (printed on the page) */
  asOf: string;
  /** the prod memory DB the numbers come from */
  dbId: string;
  /** one-line provenance printed beside the block */
  provenance: string;
  /** CI guard bound: a snapshot older than this many days reddens the test */
  staleAfterDays: number;
  /** real `/v1/ask` calls the ops workload has run through public MCP */
  totalAsks: number;
  /** first-10-queries success on this workload (criterion 2) */
  firstTenSuccessPct: number;
  tableCounts: MemoryTableCount[];
  factsByKind: MemoryDistribution[];
  entitiesByType: MemoryDistribution[];
  goldenQueries: MemoryGoldenQuery[];
  /** the one ask that broke — published, not hidden (SK-PIVOT-019) */
  knownGap: string;
}

export const AGENT_MEMORY: AgentMemorySnapshot = snapshot as AgentMemorySnapshot;
