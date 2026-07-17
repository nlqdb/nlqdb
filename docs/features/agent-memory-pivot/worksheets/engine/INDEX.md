# Engine track — memory-shaped architecture

Companion to the messaging worksheets (WS-01..WS-13). The messaging track
tells the story; **this track makes the claims durable**. Sequenced and sized
the same way — one slice per daily run, additive where possible, founder-gated
where the blast radius warrants it.

## Why this track exists

The messaging worksheets reposition nlqdb as "analytical memory for AI
agents." But just *being* a database isn't the same as **being the memory
primitive an agent reaches for**. Today an agent that wants memory has to
design its own schema via generic `db.create` — that's friction the framing
doc papers over. This track ships a canonical memory schema, memory-shaped
MCP tools (**additive**, not renaming — SK-MCP-002 stays honest), proper
scoping, TTL, hybrid recall (the gap the solve page admits today), and the
workload-analyzer hook that motivates Phase-3 multi-engine.

## How this track interleaves with the messaging track

| If the daily worst number is… | Pick from |
|---|---|
| Funnel / distribution / wedge conversion | `WS-*` (messaging) |
| Engine quality / agent on-ramp / "wedge claims true" | `E-*` (this folder) |

> **Measurement:** whether the memory is actually *good* — all four quality
> axes (retrieval / temporal / forgetting+contradiction / consolidation) plus
> an analytical-memory-vs-vector head-to-head — is scored by the
> agent-memory-quality eval, `SK-QUAL-023` in
> [`quality-eval/FEATURE.md`](../../../quality-eval/FEATURE.md) (seeded by
> persona-bench's `agent_memory` schema). Pick an `E-*` slice to build the
> primitive; the eval says whether it worked. The recall *quality* layer is
> governed by the founder mandate in
> [`docs/future/memory-architecture-research.md`](../../../../future/memory-architecture-research.md)
> (researched best practices, documented why, speed/efficiency budgets,
> right-sized context per task) — mandatory pre-read for E-05+.

**E-01 is a prerequisite for several `WS-*` worksheets** (WS-07's CreateForm
preset, WS-09's live demo over an `agent_memory` table). It does NOT block
the early messaging worksheets (WS-01..WS-05). The interleave is the point:
one or two messaging slices, then E-01, then E-02 (which sharpens WS-04's
copy with a real tool to point at), etc.

## Sequence

| E | Slice | Risk | Runs | Prereqs | Gate | Cross-link |
|----|-------|------|------|---------|------|------------|
| [E-01](E-01-memory-schema-preset.md) ✅ | Canonical `agent_memory_v1` schema preset for `db.create` — module ✅ + request-path wiring ✅ (SK-HDC-020) | med | ~2 | — | — | unblocks E-02/04/06, sharpens WS-07/09 |
| [E-02](E-02-remember-tool.md) ✅ | Additive MCP tool `nlqdb_remember` (no rename) — `POST /v1/memory/remember` + SDK + tool (SK-PIVOT-008) | med | 1 | E-01 | — | sharpens WS-04 |
| [E-03](E-03-memory-scoping.md) | Per-agent / per-end-user / per-thread scoping (the security-critical slice) | high | ~2 | E-01 | — | — |
| [E-04](E-04-ttl-decay.md) | TTL + cron sweep — `expires_at` on memory rows | low | 1 | E-01 | — | — |
| [E-05](E-05-hybrid-recall-pgvector.md) | Hybrid recall — pgvector + `nlqdb_recall` (closes the honest gap) | high | multi | E-01 | infra-gated (Neon pgvector + free embeddings) | sharpens WS-03 |
| [E-06](E-06-agents-createform-preset.md) | Preset on-ramp on the **authed** create surface (`MEMORY_PRESET`-gated) — anon `/agents` CreateForm path infeasible (SK-PIVOT-010) | med | ~2 | E-01 ✅, WS-07 ✅, `MEMORY_PRESET=1` in prod (dark) | — | redirected run 37 |
| [E-07](E-07-memory-workload-analyzer.md) | Workload-analyzer rule: memory DB above N facts → recommend ClickHouse | med | multi | E-01 | depends on `multi-engine-adapter` / `engine-migration` features (Phase 3) | — |

**Why this order:** E-01 anchors everything (every later slice writes to or
queries it). E-02 makes the wedge tool-discoverable. E-03 is the
security-critical slice (one agent must never read another's memory) —
sequenced early. E-04 is cheap and high-trust ("explicit forget" parity
with Mem0/Zep). E-05 closes the honest "no native vector search yet" gap
that the solve page admits today — the biggest lift, but the slice that
makes the wedge **actually complete**. E-06 lets a signed-in user spin up the
memory preset from the authed create surface (the anon `/agents` path is
infeasible — SK-PIVOT-010). E-07 connects the engine
north-star (data-engine pillar) to the wedge.

## Hard rules

- **Additive, not renaming.** No existing MCP tool, table, or API gets
  renamed. New surfaces sit alongside (SK-PIVOT-006).
- **Existing `db.create` flow stays generalist.** The memory preset is
  one **opt-in** path through `db.create`; the orders-tracker / leaderboard
  / generic flows are untouched (dual front door from GLOBAL-036).
- **No rebuilding of the typed-plan pipeline.** That's the moat as-shipped;
  the memory track *uses* it, doesn't replace it.
- **Engine-quality lanes are not re-escalated.** The engine slices change
  *what's behind* the API; free-chain BIRD/Spider lanes
  are unaffected by adding tables (the existing `db.create` eval covers
  the schema-inference path, not the preset path — preset path is a
  separate ablation, owned by E-01).

## Tracker

Tick on merge.

- [x] E-01 — `agent_memory_v1` schema preset: **module ✅** (2026-06-20, run 29 — `apps/api/src/db-create/presets/agent-memory-v1.ts` + contract test, branch `claude/vibrant-newton-n7v26h`; plain DDL, validator-compatible, embedding deferred to E-05); **request-path wiring ✅** (2026-06-20, run 30 — branch `claude/vibrant-newton-dw7udg`; `DbCreateArgs.preset` + orchestrator branch + `agentMemoryV1Plan()` projection + `POST /v1/databases` `{ preset }` gated behind `MEMORY_PRESET`; SK-HDC-020). One follow-on: quality-eval preset-path ablation row (Neon-branch gated).
- [x] E-02 — `nlqdb_remember` MCP tool (additive): **shipped** (2026-06-20, run 31 — branch `claude/vibrant-newton-cnjzab`; `apps/api/src/memory/remember.ts` server-built deterministic INSERT + `POST /v1/memory/remember` + `wrong_preset` guard + SDK `remember()` + `nlqdb_remember` tool; SK-PIVOT-008). CLI `nlq remember` shipped run 32 (SK-CLI-018, GLOBAL-003 parity complete). Follow-on: e2e Neon `remember → query` smoke (infra).
- [ ] E-03 — per-agent / per-end-user / per-thread scoping. **Mechanism corrected 2026-06-20 (run 32, SK-PIVOT-009):** row-level RLS keyed on an `app.agent_id` session GUC (the pattern the provisioner already uses for `tenant_isolation`), **not** compile-layer `WHERE`-injection — the read path executes free-form LLM SQL as a raw string via `neonSql.query(sql, [])` with no AST step to inject into. Security-critical; ships Neon-gated with a second review.
- [ ] E-04 — TTL + cron sweep. **Sweep core 🟡 (2026-06-21, run 39, SK-PIVOT-011** — `apps/api/src/memory/expire.ts`: `buildExpirySweep` deterministic `facts`-only `DELETE` + `orchestrateSweep` per-DB failure isolation + count aggregation; 7 unit cases). Remaining: the cron Worker that drives it (infra) + the read-side TTL `USING`-clause on E-03's `facts` RLS policy (E-03-gated).
- [ ] E-05 — hybrid recall (pgvector + `nlqdb_recall`)
- [ ] E-06 — preset on-ramp on the **authed** create surface. **Redirected 2026-06-21 (run 37, SK-PIVOT-010):** the anon `/agents` CreateForm path is infeasible across three auth boundaries — `POST /v1/databases` is `requireSession` + `MEMORY_PRESET`-gated (`index.ts:2357,2390`), `POST /v1/memory/remember` rejects anon+pk_live (`index.ts:1426-1433`), and CreateForm is anon-only by contract (`credentials:"omit"`, SK-ANON-008). On-ramp moves to the authed create surface; **blocked on `MEMORY_PRESET=1` in prod** (dark).
- [ ] E-07 — workload-analyzer rule for memory DBs
