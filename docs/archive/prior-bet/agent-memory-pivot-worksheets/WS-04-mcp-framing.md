# WS-04 — MCP tool + package + docs framing → "analytical memory"

**Status:** ✅ done (2026-06-19, run 24 — branch `claude/vibrant-newton-rk77n7`)
**Sequence:** 4 of 13 · **Risk:** low · **Runs:** 1 · **Prereqs:** none · **Gate:** none

## Goal

Make the MCP server's tool descriptions signal **analytical memory for AI
agents** — because the MCP tool list is the exact place a host (Claude
Desktop, Cursor, VS Code) shows an agent what nlqdb *is*, and today it says
nothing about memory. **Copy only — no tool/schema/behaviour change**
(SK-PIVOT-003).

## Scorecard number it moves

Distribution / agent-surface: the single highest-leverage agent-facing
string. Hard to measure directly; treat as a "wedge surface reframed"
boolean on the `Pivot:` line. Pairs with MCP-directory resubmission.

## Read first

- `docs/features/mcp-server/FEATURE.md` (`SK-MCP-002` — tool contract is
  stable; **do not rename tools**)
- `packages/mcp/src/server.ts:73-127` (the three `registerTool` blocks)

## Steps

1. `packages/mcp/src/server.ts` — prepend a memory-shaped lead clause to each
   tool `description`, keeping the precise contract text intact. E.g.
   `nlqdb_query`: *"Query your agent's structured memory in natural language
   — a real database it can `GROUP BY` / `JOIN` / aggregate, not just recall.
   Returns rows + the compiled SQL (in trace). The database is materialised on
   first reference… Destructive plans return `requires_confirm: true` + a
   diff…"* Keep `title`s short; behaviour, `inputSchema`, and `annotations`
   unchanged.
2. `packages/mcp/package.json` `description` → analytical-memory framing.
3. `apps/docs/src/content/docs/mcp.mdx` intro → "the memory MCP server";
   install/usage prose unchanged.
4. `GLOBAL-003` parity check: confirm no other surface hard-codes a
   contradicting tool blurb (`grep -rn "Run a natural-language query"`).
5. `bun run --filter @nlqdb/mcp test` + `typecheck` (protocol tests are
   behaviour, not copy — should stay green).

## Done when

- [x] Three tool descriptions + package desc + `mcp.mdx` intro carry the framing.
- [x] No tool renamed; schemas/annotations untouched; MCP tests green (33).
- [x] INDEX tracker + status ticked.

## Artifact

Re-submit / refresh the MCP-directory listing with the new description →
note the URL in `distribution-queue.md`.

## Rollback

Revert the copy diff — no behavioural surface touched.
