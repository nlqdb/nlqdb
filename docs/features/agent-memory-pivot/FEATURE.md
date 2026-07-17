---
name: agent-memory-pivot
description: The positioning pivot that makes "analytical memory for AI agents" nlqdb's lead wedge — sequenced, daily-loop-sized worksheets a cold agent picks up one at a time.
when-to-load:
  globs:
    - apps/web/src/pages/agents/**
    - apps/web/src/data/competitors.ts
    - apps/web/src/data/solve.ts
    - apps/web/src/data/showcase-examples.ts
    - docs/features/agent-memory-pivot/**
  topics: [positioning, agent-memory, mem0, zep, letta, pivot, messaging, wedge]
---

# Feature: Agent-Memory Pivot

**One-liner:** Reweight nlqdb's go-to-market so "analytical memory for AI
agents" is the lead wedge — a real, queryable database an agent uses as
memory — delivered as a sequence of small, daily-loop-sized
slices rather than a relaunch. **Three tracks ship in parallel:** messaging
(WS-* — how users discover the wedge), **engine** (E-* — the memory-shaped
primitives that make the wedge claims durable), and **reach** (R-* —
search-moment + coding-agent acquisition, SK-PIVOT-015, driven by `/reach`).
**Status:** in progress (Phase 2 distribution) — **WS-13 headline reposition shipped 2026-06-24** (SK-PIVOT-013; the site leads with the wedge sitewide); **WS-14 home-flow reposition** (SK-PIVOT-014 + SK-WEB-017), since superseded on `/` by the two-door home (SK-WEB-018); E-04 TTL-sweep core shipped (SK-PIVOT-011; cron + RLS clause pending).
**Owners (code):** `apps/web/src/pages/agents/**`, `apps/web/src/data/{competitors,solve,showcase-examples}.ts`, `apps/api/src/db-create/presets/**` (engine track), `packages/mcp/src/server.ts`, `apps/api/src/db-create/neon-provision.ts` + `ask/build-deps.ts` (agent-scope RLS, SK-PIVOT-009), `apps/docs/src/content/docs/mcp.mdx`, `README.md`.
**Cross-refs:** `docs/research/deepseek-moat-framing.md` (the thesis) · `docs/competitors.md §4` (agent-memory landscape) · `docs/research/personas.md §P2` · GLOBAL-036 (canonical text in `docs/decisions/GLOBAL-036-lead-positioning-analytical-agent-memory.md`; index in `docs/decisions.md`).

## Touchpoints — read this feature doc before editing

- `apps/web/src/pages/agents/**` — the dedicated `/agents` front door (new)
- `apps/web/src/data/competitors.ts` — memory-competitor `/vs` pages
- `apps/web/src/data/solve.ts` — agent-memory solve pages
- `apps/web/src/data/showcase-examples.ts` — home carousel slides
- `packages/mcp/src/server.ts`, `apps/docs/src/content/docs/mcp.mdx` — MCP framing
- `docs/features/agent-memory-pivot/worksheets/**` — the backlog

> **The backlog lives in [`worksheets/`](worksheets/)** — cold daily-loop
> agents start at [`worksheets/INDEX.md`](worksheets/INDEX.md) (messaging
> `WS-*`) and [`worksheets/engine/INDEX.md`](worksheets/engine/INDEX.md)
> (engine `E-01..E-08`); rule of thumb is `WS-*` when the worst number is
> funnel/distribution, `E-*` when it is engine quality / agent on-ramp.
> The **reach** track ([`worksheets/reach/INDEX.md`](worksheets/reach/INDEX.md),
> `R-*`) is picked up only by its own `/reach` loop. The
> surface-by-surface copy inventory is
> [`worksheets/messaging-surface-map.md`](worksheets/messaging-surface-map.md).

## What changes where (answers "how does each area change?")

| Area | Change | Owned by |
|---|---|---|
| **Docs decisions** | New **GLOBAL-036** (lead positioning, dual front door). **GLOBAL-019** + `architecture.md §0` wording synced to FSL-1.1→Apache. This feature's `SK-PIVOT-*` carry the tactical calls. | GLOBAL-036 |
| **Scorecard / daily loop** | A **Pivot — agent-memory wedge** section in `docs/scorecard.md` carries one row per worksheet (13 WS + 7 E), ticked ⬜→✅ on merge. The weekly focus number stays founder-set. | this PR (`scorecard.md`) |
| **Architecture** | `architecture.md §0` "Apache-2.0" corrected to FSL-1.1; `§2.1` gains the `/agents` route (a path on `nlqdb.com`, **no new domain**). | this PR (§0); WS-07 (§2.1 route) |
| **Phase plan** | Phase 2 already targets "1 agent product publicly uses nlqdb as memory" — the wedge content folds into Phase 2 distribution. Self-host container pulled forward from Phase 3 (SK-PIVOT-005). | WS-11 |
| **Home page & product/APIs** | Home is now a two-door chooser (SK-WEB-018: agent-memory door + question-your-ClickHouse door), superseding the earlier wedge-led reweight; `/agents` is the deep door (matrix, demo, OG); MCP tool + package descriptions carry the framing. Headline/README/llms.txt swap shipped 2026-06-24 (SK-PIVOT-013). | WS-01…WS-13, SK-WEB-018 |
| **Engine / actual architecture** | Canonical `agent_memory_v1` preset (`facts`/`episodes`/`entities`/`entity_facts`) as a `db.create` path. **Additive** MCP tools `nlqdb_remember` + `nlqdb_recall` (SK-MCP-002). Per-agent scope via row-level RLS (SK-PIVOT-009). TTL + cron sweep, `facts`-only (SK-PIVOT-011). pgvector hybrid recall. Preset on-ramp on the **authed** surface (SK-PIVOT-010). Caller-SQL MCP default lane via read-only `nlqdb_run` (SK-PIVOT-016). Workload-analyzer routes large memory DBs to ClickHouse (Phase 3). | E-01…E-08 |

## Decisions

### SK-PIVOT-001 — The multi-competitor capability matrix is a new surface, not a hacked `/vs` template

**Body:** [`decisions/SK-PIVOT-001-matrix-surface.md`](./decisions/SK-PIVOT-001-matrix-surface.md). The four-column capability matrix is a dedicated typed data structure (`agentMemoryMatrix.ts`) rendered on `/agents`, not an N-column bend of the single-`them` `/vs` template.

### SK-PIVOT-002 — Memory-competitor pages reuse the existing comparison machinery, one per run

**Body:** [`decisions/SK-PIVOT-002-vs-pages-one-per-run.md`](./decisions/SK-PIVOT-002-vs-pages-one-per-run.md). Zep / Letta / LangMem each get a `/vs` page via one `Competitor` entry, one competitor per daily run, each anchored in `docs/competitors.md` first.

### SK-PIVOT-003 — MCP tool + package descriptions carry the agent-memory framing

**Body:** [`decisions/SK-PIVOT-003-mcp-framing.md`](./decisions/SK-PIVOT-003-mcp-framing.md). The MCP tool list is where an agent/host discovers what nlqdb is — tool descriptions gain a memory-shaped lead clause (copy only, no renames; SK-MCP-002 contract preserved).

### SK-PIVOT-004 — Visualizations stay on-brand: code/CSS motion and type, never stock or produced video

- **Decision:** Every pivot "visualization" — the capability matrix, the
  demo, the OG images — is rendered in the existing brand system (acid-lime
  `#c6f432` on near-black `#0b0f0a`, JetBrains Mono, hard shadows, live
  `<nlq-data>` / CSS motion). The framing doc's "one 90-second demo video"
  becomes a **live, interactive in-page demo + a technical blog post**, not a
  produced video with footage.
- **Core value:** Creative, Honest latency
- **Why:** Manifesto tenet 08 forbids stock photos and decorative imagery;
  the site is deliberately illustration-free and that *is* the brand. A live
  demo (a real `GROUP BY` over an `agent_memory` table in the page) is
  on-brand and a stronger proof than a produced video.
- **Consequence in code:** OG images authored in the brand palette as
  type-on-dark (no raster screenshots). The `/agents` demo is `<nlq-data>` or
  the carousel, not `<img>`/`<video>`. The blog post (WS-09) is the long-form
  artifact.
- **Alternatives rejected:** Commission a video — off-brand, stale on first
  change. · Screenshot the matrix as a PNG — raster drift + tenet-08.

### SK-PIVOT-006 — Engine track ships **additive** memory primitives; the existing contract is preserved

**Body:** [`decisions/SK-PIVOT-006-additive-engine-track.md`](./decisions/SK-PIVOT-006-additive-engine-track.md). The engine track (E-01..E-08) ships the wedge's architecture as additive opt-ins — preset, memory tools, RLS scoping, TTL, hybrid recall, authed on-ramp (SK-PIVOT-010), analyzer rule — with **no rename or removal** of any existing tool, API, table, or surface.

### SK-PIVOT-007 — Memory schema `agent_memory_v1` is the canonical shape; evolve by version, never in place

- **Decision:** Agent memory has one canonical schema —
  `agent_memory_v1`'s four tables (`facts`, `episodes`, `entities`,
  `entity_facts`) — and it is part of the **public contract** once shipped.
  Schema evolution happens by promoting to `agent_memory_v2` with a
  documented compatibility note; no in-place column rename or table
  removal on an active memory preset.
- **Core value:** Bullet-proof, Simple
- **Why:** Once an agent's memory lives in `agent_memory_v1`, its `WHERE`
  predicates, MCP-host configs, and downstream analytics all assume the
  shape. An in-place rename is a silent breaking change for every
  integrator. The schema-widening rule (GLOBAL-004) already says logical
  schemas only widen — versioning the preset is the application of that
  rule to a *named* schema (rather than a user-inferred one). The
  ClickHouse migration rule (E-07) hashes on this version to pick a
  target.
- **Consequence in code:** `agent_memory_v1` DDL ships from a typed module
  whose `versionTag` flows into `schema_hash`. Adding a column (widening)
  is allowed; renaming or removing one requires `agent_memory_v2`. The
  agent-scope RLS (E-03, SK-PIVOT-009) is added on the preset path; the
  recall-fusion logic (E-05) and the workload-analyzer rule (E-07) key on
  the version. Tests pin the column set so a silent drift is rejected at
  PR time.
- **Alternatives rejected:** **No versioning — evolve in place** — silent
  breakage for every integrator on the next schema change. · **Per-tenant
  custom memory schemas** — defeats the "zero schema design" wedge; the
  preset *is* the value. · **Defer versioning to v2 time** — versioning is
  a contract; adding it later is harder than starting with it.

### SK-PIVOT-008 — The memory **write** verb is a dedicated server endpoint that builds the SQL itself, never `/v1/run`

- **Decision:** `nlqdb_remember` (E-02) writes through a dedicated
  `POST /v1/memory/remember` endpoint. The server — not the LLM, not the
  caller — builds the deterministic parameterised `INSERT … RETURNING`
  (`apps/api/src/memory/remember.ts` `buildRememberInsert`): every identifier
  is drawn from the fixed `AGENT_MEMORY_V1_COLUMNS` allow-list, every value is
  a bound `$n`. Rejected with `wrong_preset` (409) unless the target DB is an
  `agent_memory_v1` preset (the `db_agent_memory_v1_` id prefix). Entities
  upsert on the `(agent_id, kind, canonical_name)` UNIQUE. `agent_id`
  resolution + scoping is SK-PIVOT-009.
- **Core value:** Bullet-proof, Simple, Goal-first
- **Why:** Routing the write through `/v1/run` would re-open string-built SQL
  over arbitrary agent content and move SQL authorship to the caller — exactly
  the trust boundary the typed-plan pipeline keeps (`SK-PIVOT-006`). A
  server-built endpoint keeps it: the agent controls *data*, never *SQL*. The
  `wrong_preset` guard fails loud (GLOBAL-012). `buildMemoryExec` reuses the
  read path's `set_config('app.tenant_id', …)` transaction so RLS governs the
  INSERT's `WITH CHECK` too.
- **Consequence in code:** New `apps/api/src/memory/remember.ts` (builder +
  validator + orchestrator) + `buildMemoryExec` in `ask/build-deps.ts` + the
  route. SDK `client.remember()` (GLOBAL-003 parity, auto-keyed, `SK-SDK-006`)
  + the additive `nlqdb_remember` tool ship the same PR; `wrong_preset` joins
  the SDK `ApiErrorCode` union. CLI `nlq remember` (Go) is the tracked
  fast-follow. Idempotency has the same accept-the-header posture as `/v1/run`.
- **Alternatives rejected:** **Write via `/v1/run`** — re-opens string-SQL
  over agent content, breaks the boundary. · **Let the LLM compose the
  INSERT** — non-deterministic + a token cost for a mechanical write. ·
  **Generic `/v1/memory` with a `verb` field** — over-abstracts three fixed
  shapes; an explicit `kind` discriminant is simpler.

### SK-PIVOT-009 — Per-agent memory scoping is row-level RLS keyed on `app.agent_id`, never query-rewriting the LLM's SQL

**Body:** [`decisions/SK-PIVOT-009-agent-scope-rls.md`](./decisions/SK-PIVOT-009-agent-scope-rls.md). E-03's `agent_isolation` policy is **`AS RESTRICTIVE`** (Postgres ANDs it with `tenant_isolation`; a default-permissive policy would OR — dead code), keyed on the `app.agent_id` GUC with a baked tenant-literal arm so the account principal — and the E-04 sweep — keep full visibility. `end_user_id`/`thread_id` narrowing is an opt-in GUC-keyed **hard gate**, never an advisory SQL filter. Zero-config for the SaaS builder and their coding agent: every scope server-defaulted, narrowing is one request field, anon has no memory surface (SK-PIVOT-010).

### SK-PIVOT-010 — E-06's preset on-ramp lives on the authed create surface, never the anonymous `/agents` CreateForm

**Body:** [`decisions/SK-PIVOT-010-authed-onramp.md`](./decisions/SK-PIVOT-010-authed-onramp.md). E-06's `agent_memory_v1` preset on-ramp targets the **authenticated** create surface (`POST /v1/databases { preset }`, `MEMORY_PRESET`-gated), not the anonymous `/agents` CreateForm — the path is authed across three boundaries (`requireSession` create, anon-rejecting `remember` verb, `credentials:"omit"` CreateForm). The wedge on-ramp funnels to sign-in; it does not open the product anonymously.

### SK-PIVOT-011 — The TTL sweep is a server-built constant `DELETE`, `facts`-only, with per-DB failure isolation

**Body:** [`decisions/SK-PIVOT-011-ttl-sweep.md`](./decisions/SK-PIVOT-011-ttl-sweep.md). Server-built bound-cutoff `DELETE FROM facts` (never LLM-composed), swept per memory-preset DB with each DB's failure isolated; `facts`-only. Pure core (`expire.ts`) ships ahead of the cron Worker + read-side RLS clause.

### SK-PIVOT-012 — Wedge OG cards are committed static PNGs from a manually-run generator, never built in CI

**Body:** [`decisions/SK-PIVOT-012-og-cards.md`](./decisions/SK-PIVOT-012-og-cards.md). WS-08's `/agents` + memory-`/vs` social cards are pre-rendered PNGs in `apps/web/public/og/`, produced by a manually-run SVG→PNG generator (`scripts/og/gen-og.mjs`, `@resvg/resvg-js`) kept **out of `astro build`** so the rasteriser + fonts never reach the CF free-tier build/Worker path (GLOBAL-013). Wired through `Base.astro`'s existing `ogImage` prop.

### SK-PIVOT-005 — The self-host / anti-VC angle is messaged under FSL-1.1 honestly, and the container is pulled forward to make it true

**Body:** [`decisions/SK-PIVOT-005-fsl-self-host.md`](./decisions/SK-PIVOT-005-fsl-self-host.md). The open/free wedge is stated truthfully under **FSL-1.1** (source-available, self-hostable for non-competing use, BYO LLM key at 0% markup) — not the false "Apache-2.0 + `docker compose up`" today. `GLOBAL-019` + `architecture.md §0` synced to "FSL-1.1-ALv2 → Apache-2.0"; `/agents`/`README` state it FSL-accurately (WS-10). The container (`ghcr.io/nlqdb/api`) is pulled forward (WS-11) so the claim is true before `/agents` leads with it.

### SK-PIVOT-013 — The lead string is "Analytical memory for AI agents"; the WS-13 founder gate tripped 2026-06-24

**Body:** [`decisions/SK-PIVOT-013-headline-reposition.md`](./decisions/SK-PIVOT-013-headline-reposition.md). Founder tripped the GLOBAL-036 headline gate 2026-06-24: the four gated lead strings (Hero lede, `README` H1+tagline, `llms.txt` lede, `package.json` desc + homepage `<title>`/JSON-LD) now lead with **"Analytical memory for AI agents."**; homepage OG → `/og/agents.png`; the `/agents` CTA rebuilt connect-via-MCP. **Head-only** — the proof follow-on landed in **SK-PIVOT-014** (WS-14), itself since superseded on `/` by SK-WEB-018.

### SK-PIVOT-014 — Home-flow reposition: the home's proof leads the wedge (WS-14 follow-on to WS-13)

**Status:** superseded on `/` by [`SK-WEB-018`](../web-app/decisions/SK-WEB-018-two-door-home.md) — the home is now a two-door chooser; the agent-loop proof relocates to `/agents`.

**Body:** [`decisions/SK-PIVOT-014-home-flow-reposition.md`](./decisions/SK-PIVOT-014-home-flow-reposition.md). The WS-13 follow-on: hero's primary action became the SK-WEB-016 `<McpInstall>` row, `Demo.astro` the agent loop, `Replaces.astro` the agent-memory list collapsing into `nlqdb_query(…)`, the generalist flow a `.alsoworks` link to `/app/new`.

### SK-PIVOT-015 — Reach is the pivot's third track: search-moment interception + coding-agent injection, driven by its own `/reach` loop

**Body:** [`decisions/SK-PIVOT-015-reach-track.md`](./decisions/SK-PIVOT-015-reach-track.md). The buying decision happens at stage-0/1 searches ("my agent forgets") — increasingly issued by the builder's own coding agent (Claude Code / Cursor / Codex) — so a third track ([`worksheets/reach/INDEX.md`](worksheets/reach/INDEX.md), R-01..R-08) wins that moment: intent-mapped solve pages, a machine-followable one-command setup guide, MCP registry/directory listings, droppable in-repo artifacts (skill / rules / AGENTS.md), and a coding-agent walker as the yield metric. Runs on its own `/reach` loop (4×/day, offset from `/daily`) so `/daily`'s worst-number selection can't starve it; reach numbers live in the reach INDEX, never `docs/scorecard.md`.

### SK-PIVOT-016 — Caller-inference is the MCP default lane: agents compose SQL; NL is the compile-and-coach fallback

**Body:** [`decisions/SK-PIVOT-016-mcp-caller-sql-default.md`](./decisions/SK-PIVOT-016-mcp-caller-sql-default.md). MCP gains the GLOBAL-015 escape hatch as an additive, **read-only** `nlqdb_run` tool (same validator + RLS exec path as `/v1/run`; E-03's gates scope SQL of any provenance); tool descriptions steer describe→run as the default read lane, `nlqdb_query` responses coach the crossover, and NL stays first-class as the human path + engine-portability layer. MCP "sampling" rejected (unsupported by Claude Code/Desktop). Worksheet [E-08](worksheets/engine/E-08-caller-sql-lane.md); sequenced after E-03.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL;
index in [`docs/decisions.md`](../../decisions.md)).

- **GLOBAL-036** — Lead positioning: analytical memory for AI agents (dual front door).
  - *In this feature:* the canonical positioning decision; every worksheet implements a slice of it.
  - *Dual front door, literal expression:* the two-door home ([`SK-WEB-018`](../web-app/decisions/SK-WEB-018-two-door-home.md)) is the literal dual front door — **Door A** = agent-memory wedge (MCP install), **Door B** = generalist/analytics (BYO ClickHouse via `/app/connect`, `SK-WEB-019` / `SK-DBCONN-001`). The generalist seam is now Door A's *"or just describe your data →"* link to `/app/new` (replacing the SK-WEB-017 secondary hero input; SK-WEB-018 supersedes the three-beat-on-`/` IA).
- **GLOBAL-019** — Free + Open Source core.
  - *In this feature:* the anti-VC angle leans on it; its stale "Apache-2.0 today" wording (and `architecture.md §0`) is corrected to FSL-1.1→Apache in this PR. The FSL-accurate self-host *marketing copy* is WS-10.
- **GLOBAL-024** — Demand-signal telemetry on every "not yet" path.
  - *In this feature:* every new wedge CTA (matrix "try this", the `/agents` connect CTA) emits the typed event; wedge conversion = a registered user reaching a first answer (GLOBAL-036).
- **GLOBAL-025** — North-star KPIs (advance ≥ 1, degrade 0).
- **GLOBAL-033** — Resolution defaults.
- **GLOBAL-034** — Analytics stack.

## Open questions / known unknowns

- **Capability-matrix freshness — Resolved.** WS-06's `MATRIX_VERIFIED_ON` +
  `agentMemoryMatrix.test.ts` fail the §8 test gate (GitHub CI skips web bun
  tests) once the date is > 60 days old, invalid, or future, forcing
  re-verify against `docs/competitors.md` §4.
- **Self-host container scope** — pulling `ghcr.io/nlqdb/api` forward (WS-11)
  may exceed one daily run and touches infra; the worksheet flags the
  founder/infra gate.
