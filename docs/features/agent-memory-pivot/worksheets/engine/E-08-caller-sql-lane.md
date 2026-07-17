# E-08 — Caller-SQL default lane on MCP: `nlqdb_run` + describe→run steering

**Status:** ⬜ not started
**Sequence:** Engine 8 of 8 · **Risk:** med · **Runs:** ~2 · **Prereqs:** E-03 (scope gates live before inviting arbitrary agent SQL at memory scale) · **Gate:** none

## Goal

Make caller-composed SQL the default MCP read lane per
[SK-PIVOT-016](../../decisions/SK-PIVOT-016-mcp-caller-sql-default.md): a
coding agent gets the schema from `nlqdb_describe`, writes its own SQL, and
calls an additive **read-only** `nlqdb_run` — zero LLM config, no inference
hop on our side, frontier-quality SQL at $0. This closes the GLOBAL-015
escape-hatch parity gap (HTTP `/v1/run`, CLI `nlq run`, SDK `runSql()`
exist; MCP has no raw lane) and is the smoothest-onboarding lane for the
SaaS builder + their coding agent.

## Scorecard number it moves

`Pivot:` MCP read latency for agent callers (drops the LLM hop: seconds →
ms) and free-chain LLM spend per MCP query (→ ~0 on the run lane).
Feeds the reach track's R-06 coding-agent walker pass rate.

## Read first

- [`SK-PIVOT-016`](../../decisions/SK-PIVOT-016-mcp-caller-sql-default.md) —
  the canonical decision (read-only v1, sampling rejected, NL =
  portability layer)
- `docs/features/mcp-server/FEATURE.md` — SK-MCP-002 (verb list gains
  `nlqdb_run` on ship), SK-MCP-007 (shared orchestration), GLOBAL-023
  trust note
- `docs/features/sdk/FEATURE.md` — SK-SDK-009 (`runSql()`), SK-SDK-012
  (`dryRun`)
- `docs/features/sql-allowlist/FEATURE.md` — the three-stage validator +
  `containsWriteVerb` `/v1/run` reuses unchanged

## Steps

1. **Run 1 — the tool.** `packages/mcp` registers `nlqdb_run` (additive):
   input `{ db, sql }`, calls `/v1/run` via the SDK (GLOBAL-001), rejects
   write verbs with a one-sentence pointer to `nlqdb_remember` /
   `nlqdb_query` (GLOBAL-012). Description leads with the memory framing
   (SK-PIVOT-003 pattern) + "compose SQL from `nlqdb_describe`'s schema".
   Update SK-MCP-002's verb list + both flow-005 walker catalogs
   (`scripts/flow-005-walk.sh`, `scripts/flow-005-stdio-walk.sh`) + tool
   annotation hints (`readOnlyHint`).
2. **Run 2 — the steering + parity closure.** `nlqdb_query` response text
   gains the "edit this SQL, re-run via `nlqdb_run`" coach line;
   `nlqdb_describe` description names the run lane. `mcp.mdx` + package
   description updated. GLOBAL-003 check: HTTP/CLI/SDK already have run;
   annotate the `<nlq-data>` elements gap (NL-only by design — embed
   surface, not an agent surface) in `elements/FEATURE.md` open questions
   if review disagrees.

## Done when

- [ ] `nlqdb_run` live on both transports (hosted + stdio), read-only,
      same `/v1/run` orchestration; walkers green with the new catalog.
- [ ] describe→run steering in tool descriptions; `nlqdb_query` coach
      line in responses. R-04's machine-followable guide names the lane.
- [ ] Tests: tool schema + read-only rejection + SDK call path;
      `bun run typecheck && lint && test` green.
- [ ] SK-MCP-002 index line + engine INDEX tracker ticked.

## Artifact

The R-04 setup guide + R-07 droppable artifacts teach describe→run as the
default pattern; a "your agent writes the SQL" note → `distribution-queue.md`.

## Rollback

Copy-level steering reverts freely. The tool itself is additive and
read-only — removing it breaks no existing caller; deregister from the
catalog + walkers in one PR if needed.
