# WS-05 — Carousel: analytics-over-agent-memory slides

**Status:** ✅ done (2026-06-20, run 26 — branch `claude/vibrant-newton-8gbdxc`)
**Sequence:** 5 of 13 · **Risk:** low · **Runs:** 1 · **Prereqs:** none · **Gate:** none

## Goal

The home carousel has one agent-memory slide today (recall: "last 6 turns
across all my agent threads"). Add 1–2 slides that show **analytics over**
agent memory — the wedge that separates a database from a vector store
(`GROUP BY`, per-period aggregation, top-N). Data-only change.

## Scorecard number it moves

Onboarding / UX: the carousel is the home's headline visual; a wedge slide
in rotation lifts the agent-builder reader's comprehension. `Pivot:` boolean
"wedge slide live".

## Read first

- `docs/features/web-app/FEATURE.md` (carousel/showcase conventions)
- `apps/web/src/data/showcase-examples.ts` (the agent-memory slide ≈L325; copy its shape)

## Steps

1. Add 1–2 `showcase-examples.ts` entries, category `read`, surface shape MCP
   or `<nlq-data>`, against an `agent_memory`-style table. Goals that are
   clearly *analytical*, e.g. "per-user, how many things my agent remembered
   this week" / "the 5 facts my agent recalled most across all threads".
2. Provide the `SQL the engine ran` reveal with a real `GROUP BY` / `ORDER BY
   … LIMIT` so the "math is in SQL, not the LLM's head" point lands.
3. `bun run --filter @nlqdb/web check` + test (the carousel renders from data).

## Done when

- [x] 1–2 analytical agent-memory slides in rotation, each with a real
      aggregation in the SQL reveal. (2 added: `read-agent-memory-by-category`
      = `GROUP BY category`; `read-agent-memory-top-recalled` = `GROUP BY …
      ORDER BY … LIMIT 5`. Both MCP surface, `db_agents`.)
- [x] Brand/animation unchanged (reuses the existing typewriter mechanism;
      pure `showcase-examples.ts` data addition, no markup churn).
- [x] INDEX tracker + status ticked.

## Artifact

Screenshot-free: append a short X/Bluesky thread draft ("your agent's memory
should be able to `GROUP BY`") to `distribution-queue.md`.

## Rollback

Remove the added `showcase-examples.ts` entries — pure data, additive.
