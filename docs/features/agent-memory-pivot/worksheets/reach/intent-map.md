# Intent map — the stage-0/1 queries reach must win

Companion to [`INDEX.md`](INDEX.md) (R-01). The denominator for every reach
yield row: which queries — human-phrased **and** coding-agent-phrased — we
must be the first actionable answer for, who owns that answer today, and
which nlqdb surface should own it.

Personas: **P2b** (agent-SaaS builder — multi-tenant product, memory per
end-user, builds with Claude Code/Cursor/Codex; default alternative is a DIY
`memories` table) and **P2a** (hobbyist tool-agent builder — today's Jordan).
Split lives in [`docs/research/personas.md`](../../../../research/personas.md) §P2.

## How to read this

- **Rank** = volume proxy (H/M/L, felt-need frequency) × fit (H/M/L, how
  squarely nlqdb answers it). Composite: 🔥 top, ● mid, ○ long-tail.
- **Owns today** = what the searcher lands on now (DIY guide, a vendor, a
  registry). This is who we displace.
- **nlqdb surface** = the surface that should be the first actionable answer.
  `solve/<slug>` = existing page ([`solve.ts`](../../../../../apps/web/src/data/solve.ts));
  `vs/<slug>` = existing competitor page ([`competitors.ts`](../../../../../apps/web/src/data/competitors.ts));
  *gap* = no surface owns it yet → a later R-slice must build it.
- **Agent phrasing** = how a coding agent (Claude Code / Cursor / Codex)
  re-issues the same felt need — imperatives, tool/protocol nouns, stack
  nouns. These are the R-04/R-05 targets (setup guide + registries), the
  ones a machine acts on without a human reading a page.

## The map

### P2b — agent-SaaS builder (multi-tenant, memory-per-end-user)

| # | Human query | Rank | Owns today | nlqdb surface | Agent phrasing |
|---|---|---|---|---|---|
| 1 | per-user memory for AI agent | 🔥 | DIY pgvector guides, Mem0 | `solve/isolate-ai-agent-memory-per-tenant` | "per-tenant memory isolation postgres MCP" |
| 2 | best way to store agent memory | 🔥 | DIY blog posts, Mem0 pip | *gap* → R-03 stage-0 page | "MCP server for agent memory" |
| 3 | multi-tenant agent memory isolation | 🔥 | roll-your-own RLS threads | `solve/isolate-ai-agent-memory-per-tenant` | "row-level security per agent postgres" |
| 4 | mem0 alternative | ● | Mem0 comparison bait | `vs/mem0` | "mem0 alternative MCP" |
| 5 | should I build my own agent memory | ● | HN/Reddit build-vs-buy threads | *gap* → R-02 build-vs-buy page | "agent memory build vs buy postgres" |
| 6 | agent memory postgres | ● | pgvector + LangGraph tutorials | `solve/analytical-queries-over-agent-memory` | "persist agent state postgres" |
| 7 | zep alternative | ● | Zep docs, comparison posts | `vs/zep` | "zep alternative analytical memory" |
| 8 | how to give each user their own agent memory | ● | DIY tenancy threads | `solve/isolate-ai-agent-memory-per-tenant` | "scope agent memory by end_user_id" |
| 9 | analytical queries over agent memory | ○ | nobody (our wedge) | `solve/analytical-queries-over-agent-memory` | "run SQL GROUP BY over agent memory" |
| 10 | ttl / expiring agent memory | ○ | manual cron threads | *gap* → R-03 stage-0 page | "expire old agent memory rows automatically" |

### P2a — hobbyist tool-agent builder (single-user, "my agent forgets")

| # | Human query | Rank | Owns today | nlqdb surface | Agent phrasing |
|---|---|---|---|---|---|
| 11 | AI agent forgets between sessions | 🔥 | DIY JSON-blob + pgvector guides | `solve/give-ai-agent-persistent-memory` | "add persistent memory to AI agent" |
| 12 | add long term memory to AI agent | 🔥 | LangChain/LangGraph memory docs | `solve/give-ai-agent-persistent-memory` | "long term memory MCP server" |
| 13 | agent memory MCP server | 🔥 | official MCP registry, awesome-lists | *gap* → R-05 registry listings | "MCP memory server install claude" |
| 14 | give Claude/Cursor persistent memory | ● | host-specific memory hacks | `solve/give-ai-agent-persistent-memory` | "claude mcp add memory server" |
| 15 | store chatbot conversation history | ● | DIY messages-table tutorials | `solve/store-query-chatbot-conversation-history` | "store and query chatbot history postgres" |
| 16 | share memory across multiple agents | ● | nobody clean | `solve/share-memory-across-multiple-ai-agents` | "shared memory store for multiple agents" |
| 17 | safely give an AI agent database access | ● | scary-access threads | `solve/safely-give-ai-agent-database-access` | "read-only scoped db access for agent" |
| 18 | vector db for agent memory (do I need one) | ○ | Pinecone/Chroma/Qdrant marketing | `vs/pinecone`, `vs/chroma`, `vs/qdrant` | "pgvector vs pinecone for agent memory" |

## What this tells the later slices

- **R-02 (build-vs-buy):** #5 and the DIY-`memories`-table default are
  unowned — the honesty surface is the highest-leverage gap for P2b.
- **R-03 (stage-0 pages):** the top-5 *unowned* human queries are #2 (best
  way to store agent memory), #5 (build vs buy — R-02), #10 (TTL/expiry),
  #13 (agent memory MCP server — also R-05). Existing `solve/*` pages
  already own #1/#3/#6/#8/#9/#11/#12/#14/#15/#16/#17 — R-03 fills the gaps,
  not the covered rows.
- **R-04/R-05 (setup guide + registries):** every "Agent phrasing" column
  entry is a machine target. The MCP-noun ones (#2, #13, #14) resolve to a
  registry listing or the one-command setup guide, not a prose page.
- **R-08 (answer-engine baseline):** the top-10 by rank (the 🔥 rows across
  both personas) are the citation spot-check set.

_GSC (28d to 2026-07-16): intent queries above surface near-zero
impressions today — `/agents` sits at pos ~8 with 3 impressions, no intent
query clears 1 click. That zero **is** the R-01 baseline this map exists to
move._
