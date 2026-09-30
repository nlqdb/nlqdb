// The agent-memory capability matrix — source of truth for the wedge's
// signature artifact: "What can your agent actually DO with its memory?"
// (SK-PIVOT-001). Rows = capabilities; columns = Mem0 · Zep · Letta ·
// nlqdb. This is its OWN typed structure, NOT a hacked `/vs/[slug].astro`
// (that template renders one `them` column; this is four-up). Rendered as
// an on-brand glyph grid in WS-06 run 2, reused by `/agents` (WS-07) and
// the blog (WS-09). No raster image — SK-PIVOT-004.
//
// Glyph vocabulary is shared with `ComparisonRow` (comparison-pages
// FEATURE): shipped = ✓, partial = ◐, no = —. Honesty is the conversion
// lever (AEO 2026): every nlqdb ✓ is shippable today, and competitor
// cells are sourced from the web-verified landscape (`docs/competitors.md §4`).
//
// 2026-09-30 re-verify (public docs/repos/changelogs only):
// - Mem0: add/search + hybrid retrieval, filters eq/ne/in/gt/lt/contains +
//   AND/OR/NOT (filter-and-retrieve, no ORDER BY / aggregation — issue #3114
//   still open); Apache-2.0 self-host server.
// - Zep: Graphiti hybrid search (vector+BM25+graph) + neighbor/subgraph
//   traversal; `order_by: "degree"` ranks by connectivity, not a user value.
//   Custom entity/edge types are developer-defined up front, not agent-
//   designed tables. Graphiti Apache-2.0 self-hosts; Zep platform hosted.
// - Letta: V1 API server retired (archive branch); Letta Code's MemFS stores
//   memory as git-backed Markdown found with file-search tools. Keyword search
//   by default; semantic/hybrid needs QMD installed, and local conversation
//   search is full-text only. Apache-2.0 self-host.
// - nlqdb: NL→SQL aggregations + schema provision + diff preview ship;
//   memory recall is SQL filters only (no embedding recall, E-05); no
//   published self-host container (WS-11).
// SK-PIVOT-001 keeps four columns: recall-only entrants (Hindsight, GBrain,
// Memori) do not change the wedge glyphs.

import type { ComparisonClaim } from "./competitors.ts";

export type MatrixRow = {
  // The agent-facing capability, phrased as the job the builder wants done.
  capability: string;
  mem0: ComparisonClaim;
  zep: ComparisonClaim;
  letta: ComparisonClaim;
  nlqdb: ComparisonClaim;
  // One-sentence honest gloss — why a cell is ◐/— rather than ✓, or what
  // the nlqdb ✓ actually does. Omit when self-evident.
  note?: string;
};

// When the competitor cells were last reconciled against their docs/repos.
// A daily-loop alert if > 60 days old (mirrors the engine-row staleness
// rule). Sourced from WS-01 (`docs/competitors.md §4`).
export const MATRIX_VERIFIED_ON = "2026-09-30";

// Rows ordered: shared baseline first (everyone can), then the analytical
// wedge where only nlqdb wins, then the trust/ownership rows. The shape of
// the table IS the argument — recall is table stakes; aggregation is not.
export const AGENT_MEMORY_MATRIX: MatrixRow[] = [
  {
    capability: 'Remember a fact ("Alice has a $50k deal")',
    mem0: "shipped",
    zep: "shipped",
    letta: "shipped",
    nlqdb: "shipped",
    note: "Storing a fact is table stakes — every memory layer does this.",
  },
  {
    capability: "Recall facts by similarity / relevance",
    mem0: "shipped",
    zep: "shipped",
    letta: "partial",
    nlqdb: "partial",
    note: "Mem0/Zep rank by hybrid search. Letta's MemFS searches by keyword unless QMD is installed. nlqdb recalls by SQL filter, not similarity (embedding recall is still E-05).",
  },
  {
    capability: 'Top-N by value ("top 5 deals by size")',
    mem0: "no",
    zep: "no",
    letta: "no",
    nlqdb: "shipped",
    note: "Needs ORDER BY + LIMIT over the full set, not a top-k similarity search.",
  },
  {
    capability: 'Aggregate per group ("average deal size per stage")',
    mem0: "no",
    zep: "no",
    letta: "no",
    nlqdb: "shipped",
    note: "A vector/graph store returns matches; the LLM would have to do the arithmetic in-context — plausible at demo size, not correct or repeatable past the context window. nlqdb runs GROUP BY in Postgres.",
  },
  {
    capability: 'Time-window analytics ("deals closing this month")',
    mem0: "no",
    zep: "no",
    letta: "no",
    nlqdb: "shipped",
    note: "Mem0/Zep can filter or point-in-time-recall by time; neither aggregates across a window.",
  },
  {
    capability: "Full GROUP BY / JOIN / HAVING over memory",
    mem0: "no",
    zep: "no",
    letta: "no",
    nlqdb: "shipped",
    note: "The core wedge: a real query planner over the agent's own data.",
  },
  {
    capability: "Agent designs its own schema",
    mem0: "no",
    zep: "no",
    letta: "no",
    nlqdb: "shipped",
    note: "nlqdb provisions Postgres from the agent's first goal; the others impose a fixed memory shape (Graphiti custom entity types ≠ agent-designed tables).",
  },
  {
    capability: "Diff preview before destructive writes",
    mem0: "no",
    zep: "no",
    letta: "no",
    nlqdb: "shipped",
    note: "DDL/DML is previewed and confirmed before it applies (GLOBAL trust-UX).",
  },
  {
    capability: "Self-hostable",
    mem0: "shipped",
    zep: "partial",
    letta: "shipped",
    nlqdb: "partial",
    note: "Mem0/Letta are Apache-2.0 self-hostable; Zep self-hosts Graphiti but the platform is hosted; nlqdb is FSL source-available (GLOBAL-019), container pull-forward still WS-11.",
  },
];
