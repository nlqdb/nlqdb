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
// cells are sourced from the WS-01 web-verified landscape
// (`docs/competitors.md §4`, re-verified 2026-08-01) — not the aspirational
// framing doc, which mislabelled several self-host claims.
//
// 2026-08-01 evidence (public docs/repos only):
// - Mem0: add/search + V3 hybrid retrieval (semantic+BM25+entity), filters,
//   expiration_date; Apache-2.0 OSS + self-host server. No SQL planner.
// - Zep: Graphiti temporal graph hybrid search (vector+BM25+graph); Graphiti
//   Apache-2.0 self-hostable; Zep platform hosted. No GROUP BY / JOIN.
// - Letta: core/recall/archival tiers + archival_memory_search; Apache-2.0
//   self-host (App Server). No relational aggregation over memory.
// - nlqdb: NL→SQL aggregations + schema provision + diff preview ship;
//   embedding hybrid recall still E-05; self-host container still WS-11.
// Landscape also added Hindsight + GBrain in docs/competitors.md §4 (recall /
// personal-brain shaped). SK-PIVOT-001 keeps this matrix at four columns —
// new recall-only entrants do not change the wedge glyphs.

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
export const MATRIX_VERIFIED_ON = "2026-08-01";

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
    letta: "shipped",
    nlqdb: "shipped",
    note: "Mem0/Zep/Letta rank by hybrid/semantic search; nlqdb recalls via SQL filters (embedding hybrid still E-05).",
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
    note: "A vector/graph store returns matches; the LLM would have to do the arithmetic. nlqdb runs GROUP BY in Postgres.",
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
