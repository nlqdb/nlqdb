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
| Funnel / distribution / waitlist conversion | `WS-*` (messaging) |
| Engine quality / agent on-ramp / "wedge claims true" | `E-*` (this folder) |

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
| [E-06](E-06-agents-createform-preset.md) | `/agents` CreateForm uses the `agent_memory_v1` preset by default | low | 1 | E-01, WS-07 | — | — |
| [E-07](E-07-memory-workload-analyzer.md) | Workload-analyzer rule: memory DB above N facts → recommend ClickHouse | med | multi | E-01 | depends on `multi-engine-adapter` / `engine-migration` features (Phase 3) | — |

**Why this order:** E-01 anchors everything (every later slice writes to or
queries it). E-02 makes the wedge tool-discoverable. E-03 is the
security-critical slice (one agent must never read another's memory) —
sequenced early. E-04 is cheap and high-trust ("explicit forget" parity
with Mem0/Zep). E-05 closes the honest "no native vector search yet" gap
that the solve page admits today — the biggest lift, but the slice that
makes the wedge **actually complete**. E-06 lets the new `/agents` page
land users on the memory preset, not generic. E-07 connects the engine
north-star (data-engine pillar) to the wedge.

## Hard rules

- **Additive, not renaming.** No existing MCP tool, table, or API gets
  renamed. New surfaces sit alongside (SK-PIVOT-006).
- **Existing `db.create` flow stays generalist.** The memory preset is
  one **opt-in** path through `db.create`; the orders-tracker / leaderboard
  / generic flows are untouched (dual front door from GLOBAL-036).
- **No rebuilding of the typed-plan pipeline.** That's the moat as-shipped;
  the memory track *uses* it, doesn't replace it.
- **Gate (GLOBAL-027) is not touched.** The engine slices change *what's
  behind* the gate; the gate itself stays. Free-chain BIRD/Spider lanes
  are unaffected by adding tables (the existing `db.create` eval covers
  the schema-inference path, not the preset path — preset path is a
  separate ablation, owned by E-01).

## Tracker

Tick on merge.

- [x] E-01 — `agent_memory_v1` schema preset: **module ✅** (2026-06-20, run 29 — `apps/api/src/db-create/presets/agent-memory-v1.ts` + contract test, branch `claude/vibrant-newton-n7v26h`; plain DDL, validator-compatible, embedding deferred to E-05); **request-path wiring ✅** (2026-06-20, run 30 — branch `claude/vibrant-newton-dw7udg`; `DbCreateArgs.preset` + orchestrator branch + `agentMemoryV1Plan()` projection + `POST /v1/databases` `{ preset }` gated behind `MEMORY_PRESET`; SK-HDC-020). One follow-on: quality-eval preset-path ablation row (Neon-branch gated).
- [x] E-02 — `nlqdb_remember` MCP tool (additive): **shipped** (2026-06-20, run 31 — branch `claude/vibrant-newton-cnjzab`; `apps/api/src/memory/remember.ts` server-built deterministic INSERT + `POST /v1/memory/remember` + `wrong_preset` guard + SDK `remember()` + `nlqdb_remember` tool; SK-PIVOT-008). Follow-ons: e2e Neon `remember → query` smoke (infra) + CLI `nlq remember` (Go).
- [ ] E-03 — per-agent / per-end-user / per-thread scoping. **Mechanism corrected 2026-06-20 (run 32, SK-PIVOT-009):** row-level RLS keyed on an `app.agent_id` session GUC (the pattern the provisioner already uses for `tenant_isolation`), **not** compile-layer `WHERE`-injection — the read path executes free-form LLM SQL via `neonSql.unsafe(sql)` with no AST step to inject into. Security-critical; ships Neon-gated with a second review.
- [ ] E-04 — TTL + cron sweep
- [ ] E-05 — hybrid recall (pgvector + `nlqdb_recall`)
- [ ] E-06 — `/agents` CreateForm uses the preset
- [ ] E-07 — workload-analyzer rule for memory DBs
