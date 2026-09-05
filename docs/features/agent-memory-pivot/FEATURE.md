---
name: agent-memory-pivot
description: Prior bet (agent memory as the lead wedge, 2026-06 → 2026-09) — rails kept only as far as the expert-knowledge platform needs them.
when-to-load:
  globs:
    - apps/web/src/pages/agents/**
    - apps/web/src/data/competitors.ts
    - apps/web/src/data/solve.ts
    - apps/web/src/data/showcase-examples.ts
    - tools/docs-memory/**
    - docs/features/agent-memory-pivot/**
  topics: [positioning, agent-memory, mem0, zep, letta, pivot, messaging, wedge]
---

# Feature: Agent-Memory Pivot (prior bet)

**One-liner:** The 2026-06 → 2026-09 bet that "analytical memory for AI
agents" is nlqdb's lead wedge. Replaced by the autonomous-DBA bet
(`GLOBAL-041`); its worksheets, research and positioning decisions are
archived. What survives is the set of rails the expert-knowledge platform
builds on.
**Status:** prior bet — rails maintained only as far as EK needs them
(`agent_memory_v1` seed, `buildRememberInsert`, pack-runner, RLS); no new
slices. `/reach` continues as the marketing lane on
[`docs/research/reach/INDEX.md`](../../research/reach/INDEX.md).
**Owners (code):** `apps/api/src/db-create/presets/agent-memory-v1.ts`,
`apps/api/src/memory/**`, `apps/api/src/pack-runner/**`,
`tools/docs-memory/**`, `packages/mcp/src/server.ts` (`nlqdb_remember` /
`nlqdb_recall`).

## Touchpoints — read this feature doc before editing

- the rails above — edit only when `expert-knowledge-platform` needs it
- `apps/web/src/pages/agents/**`, memory `/vs` and solve pages — marketing
  surfaces; they keep earning search traffic but carry no new investment

## Decisions

### SK-PIVOT-001 — The multi-competitor capability matrix is a new surface, not a hacked `/vs` template

**Body:** [`decisions/SK-PIVOT-001-matrix-surface.md`](./decisions/SK-PIVOT-001-matrix-surface.md). The four-column capability matrix is a dedicated typed data structure (`agentMemoryMatrix.ts`) rendered on `/agents`, not an N-column bend of the single-`them` `/vs` template.

### SK-PIVOT-002 — Memory-competitor pages reuse the existing comparison machinery, one per run

**Body:** [`decisions/SK-PIVOT-002-vs-pages-one-per-run.md`](./decisions/SK-PIVOT-002-vs-pages-one-per-run.md). Zep / Letta / LangMem each get a `/vs` page via one `Competitor` entry, one competitor per daily run, each anchored in `docs/competitors.md` first.

### SK-PIVOT-003 — MCP tool + package descriptions carry the agent-memory framing

**Body:** [`decisions/SK-PIVOT-003-mcp-framing.md`](./decisions/SK-PIVOT-003-mcp-framing.md). The MCP tool list is where an agent/host discovers what nlqdb is — tool descriptions gain a memory-shaped lead clause (copy only, no renames; SK-MCP-002 contract preserved).

### SK-PIVOT-004 — Visualizations stay on-brand: code/CSS motion and type, never stock or produced video

**Body:** [`decisions/SK-PIVOT-004-brand-visuals.md`](./decisions/SK-PIVOT-004-brand-visuals.md). Every pivot "visualization" — the capability matrix, the demo, the OG images — is rendered in the existing brand system (acid-lime `#c6f432` on near-black `#0b0f0a`, JetBrains Mono, hard shadows, live `<nlq-data>` / CSS motion).

### SK-PIVOT-006 — Engine track ships **additive** memory primitives; the existing contract is preserved

**Body:** [`decisions/SK-PIVOT-006-additive-engine-track.md`](./decisions/SK-PIVOT-006-additive-engine-track.md). The architectural commitment behind the wedge ships as a parallel **engine track** (archived `E-01..E-07` worksheets) — a canonical `agent_memory_v1` schema preset, additive MCP tools (`nlqdb_remember`, `nlqdb_recall`), per-agent scoping, TTL, pgvector hybrid recall, an `/agents` CreateForm preset, and a workload-analyzer rule.

### SK-PIVOT-008 — The memory **write** verb is a dedicated server endpoint that builds the SQL itself, never `/v1/run`

**Body:** [`decisions/SK-PIVOT-008-remember-endpoint.md`](./decisions/SK-PIVOT-008-remember-endpoint.md). `nlqdb_remember` (E-02) writes through a dedicated `POST /v1/memory/remember` endpoint.

### SK-PIVOT-009 — Per-agent memory scoping is row-level RLS keyed on `app.agent_id`, never query-rewriting the LLM's SQL

**Body:** [`decisions/SK-PIVOT-009-agent-scope-rls.md`](./decisions/SK-PIVOT-009-agent-scope-rls.md). E-03's `agent_isolation` policy is **`AS RESTRICTIVE`**, keyed on the `app.agent_id` GUC with a baked tenant-literal arm; `end_user_id`/`thread_id` narrowing is an opt-in GUC-keyed **hard gate**, never an advisory SQL filter. Zero-config: every scope server-defaulted, anon has no memory surface (SK-PIVOT-010).

### SK-PIVOT-010 — E-06's preset on-ramp lives on the authed create surface, never the anonymous `/agents` CreateForm

**Body:** [`decisions/SK-PIVOT-010-authed-onramp.md`](./decisions/SK-PIVOT-010-authed-onramp.md). E-06's `agent_memory_v1` preset on-ramp targets the **authenticated** create surface (`POST /v1/databases { preset }`, `MEMORY_PRESET`-gated), not the anonymous `/agents` CreateForm — the path is authed across three boundaries (`requireSession` create, anon-rejecting `remember` verb, `credentials:"omit"` CreateForm). The wedge on-ramp funnels to sign-in; it does not open the product anonymously.

### SK-PIVOT-011 — The TTL sweep is a server-built constant `DELETE`, `facts`-only, with per-DB failure isolation

**Body:** [`decisions/SK-PIVOT-011-ttl-sweep.md`](./decisions/SK-PIVOT-011-ttl-sweep.md). Server-built bound-cutoff `DELETE FROM facts` (never LLM-composed), swept per memory-preset DB with each DB's failure isolated; `facts`-only. Pure core (`expire.ts`) ships ahead of the cron Worker + read-side RLS clause.

### SK-PIVOT-012 — Wedge OG cards are committed static PNGs from a manually-run generator, never built in CI

**Body:** [`decisions/SK-PIVOT-012-og-cards.md`](./decisions/SK-PIVOT-012-og-cards.md). WS-08's `/agents` + memory-`/vs` social cards are pre-rendered PNGs in `apps/web/public/og/`, produced by a manually-run generator (`scripts/og/gen-og.mjs`) kept **out of `astro build`** so the rasteriser + fonts never reach the CF free-tier build path (GLOBAL-013). Wired through `Base.astro`'s `ogImage` prop.

### SK-PIVOT-005 — The self-host / anti-VC angle is messaged under FSL-1.1 honestly, and the container is pulled forward to make it true

**Body:** [`decisions/SK-PIVOT-005-fsl-self-host.md`](./decisions/SK-PIVOT-005-fsl-self-host.md). The open/free wedge is stated truthfully under **FSL-1.1** (source-available, self-hostable for non-competing use, BYO LLM key at 0% markup) — not the false "Apache-2.0 + `docker compose up`" today. `GLOBAL-019` + `architecture.md §0` synced to "FSL-1.1-ALv2 → Apache-2.0"; `/agents`/`README` state it FSL-accurately (WS-10). The container (`ghcr.io/nlqdb/api`) is pulled forward (WS-11) so the claim is true before `/agents` leads with it.

### SK-PIVOT-015 — Reach is the pivot's third track: search-moment interception + coding-agent injection, driven by its own `/reach` loop

**Body:** [`decisions/SK-PIVOT-015-reach-track.md`](./decisions/SK-PIVOT-015-reach-track.md). The buying decision happens at stage-0/1 searches ("my agent forgets"), increasingly issued by the builder's own coding agent, so a third track ([`docs/research/reach/INDEX.md`](../../research/reach/INDEX.md), R-01..R-08) wins that moment: intent-mapped solve pages, a one-command setup guide, MCP registry listings, droppable in-repo artifacts, and a coding-agent walker as the yield metric. Runs on its own `/reach` loop (4×/day, offset from `/daily`) so worst-number selection can't starve it; reach numbers live in the reach worksheet's `NUMBERS.md`, never `docs/scorecard.md`.

### SK-PIVOT-016 — The launch is condition-gated on a lived dogfood workload; conditions, never calendar dates

**Body:** [`decisions/SK-PIVOT-016-dogfood-launch-gate.md`](./decisions/SK-PIVOT-016-dogfood-launch-gate.md). Founder-directed 2026-07-26: the launch-sequence bullet in `docs/blocked-by-human.md` fires when the dogfood gate's five criteria are green (≥ 100 real public-MCP asks from the ops workload, first-10 ≥ 95 % on it, zero silent data loss, temporal golden queries pass, live `/agents` dashboard) — agents may tighten criteria, only the founder loosens; calendar dates are banned from the gate. `/daily` restates gate progress (n/5) beside the bullet's age.

### SK-PIVOT-017 — The dogfood workload is a productized docs→memory skill: structured extraction, one-way sync, markdown canonical

**Body:** [`decisions/SK-PIVOT-017-docs-to-memory-skill.md`](./decisions/SK-PIVOT-017-docs-to-memory-skill.md). An nlqdb-branded skill extracts a repo's **structured operational knowledge** (decisions, statuses, open questions, queues, ledgers) into an nlqdb memory DB via the public MCP surface, kept fresh by a one-way re-sync hook; markdown stays the git-reviewed source of truth. nlqdb's own `docs/` is the first corpus — the SK-PIVOT-016 gate workload and the launch demo in one. v1 never ingests arbitrary prose (the vector-RAG trap); the golden-query set (≥ 10, incl. temporal) rides the `SK-QUAL-023` eval family.

### SK-PIVOT-018 — Memory ships persona-goal packs on the one canonical schema, never per-vertical schemas

**Body:** [`decisions/SK-PIVOT-018-goal-packs.md`](./decisions/SK-PIVOT-018-goal-packs.md). Goal packs = extraction recipe + seed entities + golden queries, all on the one `agent_memory_v1` schema (the seed). Pack #1 repo-ops (`SK-PIVOT-017`); pack #2 founder-ops (accounts, credential *metadata* — never values — listings, the human-actions log, seeded from [`docs/history/founder-actions-log.md`](../../history/founder-actions-log.md)). A pack adds no pack-specific schema, endpoint or tool; `SK-PIVOT-021` supplies one shared product runner for all packs. Candidates for packs #3..N are proposals awaiting founder ranking in the archived `pack-candidates.md` (#1 founder-set 2026-07-29); none is decided.

### SK-PIVOT-019 — nlqdb publishes a reproducible cross-strategy memory benchmark; honest per-purpose winners, never an integrations program

**Body:** [`decisions/SK-PIVOT-019-memory-strategy-benchmark.md`](./decisions/SK-PIVOT-019-memory-strategy-benchmark.md). Same corpus (`SK-PIVOT-017`), same golden queries per `SK-QUAL-023` axis, run against memory strategies (v1: nlqdb, DIY pgvector, plain-context; hosted competitors one per run, ToS-checked) with per-purpose winners published even where nlqdb loses. Public harness in `tools/`; rendered on `/agents`. Build starts when the corpus exists; explicitly not an integrations program.

### SK-PIVOT-021 — Every goal pack ships as a one-click product journey on one shared runner

**Body:** [`decisions/SK-PIVOT-021-one-click-goal-pack-journeys.md`](./decisions/SK-PIVOT-021-one-click-goal-pack-journeys.md). A skill artifact is not a finished pack: one shared runner owns the CTA, pre-auth evidence, least-permission source access, resumable handoffs, honest progress, durable proof and cleanup, while pack-specific work stays declarative per `SK-PIVOT-018`. Pack #1's public-alpha journey is the archived `D-08` worksheet.

### SK-PIVOT-022 — Community memory guidance optimizes for task outcomes, even when nlqdb is absent

**Body:** [`decisions/SK-PIVOT-022-community-first-memory-guidance.md`](./decisions/SK-PIVOT-022-community-first-memory-guidance.md). Cross-strategy guidance recommends the smallest setup that measurably improves the task — plain context, another provider, no persistent memory, or a user-composed architecture may win without nlqdb; repeated counter-evidence narrows or retires the claim. Extends `SK-PIVOT-019` without maintained vendor adapters; nlqdb goal packs stay distinct product surfaces under `SK-PIVOT-018`.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL;
index in [`docs/decisions.md`](../../decisions.md)).

- **GLOBAL-041** — Autonomous DBA.
  - *In this feature:* this is the prior bet; rails maintained only as far as `expert-knowledge-platform` needs them.
- **GLOBAL-019** — Free + Open Source core.
  - *In this feature:* the anti-VC angle leans on it; its stale "Apache-2.0 today" wording (and `architecture.md §0`) is corrected to FSL-1.1→Apache in this PR. The FSL-accurate self-host *marketing copy* is WS-10.
- **GLOBAL-026** — LLM strategy: free chain forever, BYOLLM for everyone, hosted premium on paid.
  - *In this feature:* memory never gets its own meter or SKU; monetization is `GLOBAL-041`'s (the shipped premium tier stays; DBA pricing after Phase B). The marketplace fee is `SK-EKP-002`.
- **GLOBAL-024** — Demand-signal telemetry on every "not yet" path.
  - *In this feature:* every new wedge CTA emits the typed event.
- **GLOBAL-025** — North-star KPIs (advance ≥ 1, degrade 0).
- **GLOBAL-033** — Resolution defaults.
- **GLOBAL-034** — Analytics stack.

## Open questions / known unknowns

- **Capability-matrix freshness — Resolved.** `MATRIX_VERIFIED_ON` +
  `agentMemoryMatrix.test.ts` force a re-verify against `competitors.md` §4
  when the date is invalid/stale (>60d case `skipIf(CI)`; see the tests).
- **Self-host container scope** — pulling `ghcr.io/nlqdb/api` forward (WS-11)
  may exceed one daily run and touches infra; the worksheet flags the
  founder/infra gate.
- **Memory-scope fields are HTTP-only (GLOBAL-003 gap)** — E-03 shipped
  `agentId`/`endUserId`/`threadId` on `/v1/ask` + `/v1/memory/remember`;
  SDK / CLI / MCP / `<nlq-data>` don't forward them yet, so a narrowed agent
  is reachable over raw HTTP only. Nothing regresses (absent ⇒ tenant-default
  scope). Pairs with E-05's `nlqdb_recall`, which needs the same parameters.
