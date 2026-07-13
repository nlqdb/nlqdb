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
slices rather than a relaunch. **Two tracks ship in parallel:** messaging
(WS-01..WS-13 — how users discover the wedge) and **engine** (E-01..E-07 —
the memory-shaped primitives that make the wedge claims durable).
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
> (engine `E-01..E-07`); rule of thumb is `WS-*` when the worst number is
> funnel/distribution, `E-*` when it is engine quality / agent on-ramp. The
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
| **Engine / actual architecture** | Canonical `agent_memory_v1` preset (`facts`/`episodes`/`entities`/`entity_facts`) as a `db.create` path. **Additive** MCP tools `nlqdb_remember` + `nlqdb_recall` (SK-MCP-002). Per-agent scope via row-level RLS (SK-PIVOT-009). TTL + cron sweep, `facts`-only (SK-PIVOT-011). pgvector hybrid recall. Preset on-ramp on the **authed** surface (SK-PIVOT-010). Workload-analyzer routes large memory DBs to ClickHouse (Phase 3). | E-01…E-07 |

## Decisions

### SK-PIVOT-001 — The multi-competitor capability matrix is a new surface, not a hacked `/vs` template

- **Decision:** The "What can your agent actually DO with its memory?" table
  (rows = capabilities; columns = Mem0 · Zep · Letta · **nlqdb**) ships as its
  own typed data structure rendered on `/agents`, **not** by extending the
  `/vs/[slug].astro` single-`them`-column template.
- **Core value:** Simple, Creative
- **Why:** The comparison template renders one competitor column (`us` vs
  `them`). The wedge's signature artifact is a *four-column* side-by-side;
  bending the template into an N-column one complicates every existing `/vs`
  page for one consumer. A dedicated typed matrix keeps both simple.
- **Consequence in code:** A typed `agentMemoryMatrix.ts` with
  `{ capability, mem0, zep, letta, nlqdb }` rows rendered as a glyph grid
  (`✓ / ◐ / —`, the `ComparisonRow` vocabulary). Honest claims only. Reused
  on `/agents` + the blog.
- **Alternatives rejected:** Add N `them` columns to `ComparisonRow` —
  pollutes all six existing pages. · A static image — unmaintainable + off-brand (tenet 08).

### SK-PIVOT-002 — Memory-competitor pages reuse the existing comparison machinery, one per run

- **Decision:** Zep, Letta, and LangMem each get a `/vs` page by adding one
  `Competitor` entry to `competitors.ts` (persona `P2 agent builder`),
  **one competitor per daily run**, each anchored in `docs/competitors.md`
  first.
- **Core value:** Simple, Goal-first
- **Why:** The machinery is already static + one-file-per-competitor
  (`SK-CMP-002`); one competitor per run keeps each diff reviewable and each a
  distribution artifact.
- **Consequence in code:** Per entry: real MCP tool names only,
  `whenChooseThem`/`whenChooseUs` ≤ 16 words, `feature` rows verifiable today,
  FAQ names the competitor. Update slug lists in `scripts/verify-flows.sh` +
  `tools/stranger-test/`.
- **Alternatives rejected:** One mega-PR for all three — unreviewable, wastes
  three runs' artifacts. · Skip the `competitors.md` anchor — ships an
  un-vetted claim.

### SK-PIVOT-003 — MCP tool + package descriptions carry the agent-memory framing

- **Decision:** The MCP server's tool descriptions, `title`s, and the
  `packages/mcp` npm description signal "analytical memory your agent can
  query" — because the MCP tool list is where an AI agent/host *discovers*
  what nlqdb is, and it currently says nothing about memory.
- **Core value:** Goal-first, Creative
- **Why:** When a host (Claude Desktop, Cursor, VS Code) lists nlqdb's tools,
  the one-line descriptions are the entire pitch to the agent. Today
  `nlqdb_query` reads "Run a natural-language query…" — accurate but invisible
  to the memory use case.
- **Consequence in code:** `packages/mcp/src/server.ts` tool `description`s
  gain a memory-shaped lead clause without losing the contract text (rows +
  compiled SQL, materialise-on-reference, `requires_confirm` diff);
  `package.json` + `mcp.mdx` match. Copy only, no behaviour/schema change.
  Read `mcp-server/FEATURE.md` first (GLOBAL-003 parity).
- **Alternatives rejected:** Rename tools to `nlqdb_remember`/`nlqdb_recall` —
  breaks `SK-MCP-002` + parity tests for cosmetic gain. · Leave generic —
  forfeits the highest-leverage agent-facing surface.

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

- **Decision:** The architectural commitment behind the wedge ships as a
  parallel **engine track** (`worksheets/engine/E-01..E-07`) — a canonical
  `agent_memory_v1` schema preset, additive MCP tools (`nlqdb_remember`,
  `nlqdb_recall`), per-agent scoping, TTL, pgvector hybrid recall, an
  `/agents` CreateForm preset, and a workload-analyzer rule. **No existing
  MCP tool, API, table, or surface is renamed or removed.** The existing
  generalist `db.create` / `nlqdb_query` / `<nlq-data>` flows keep their
  contracts; the memory shape sits alongside as a first-class opt-in.
- **Core value:** Bullet-proof, Simple, Goal-first
- **Why:** The moat ("real SQL on structured memory, typed-plan trust
  boundary") is already shipped — but **being a database isn't the same as
  being the memory primitive an agent reaches for.** Today an agent must
  design its own schema via generic `db.create`, so the "zero schema design"
  claim isn't yet true. The engine track makes it true without an
  incompatible rebuild: keep `SK-MCP-002`'s tool contract and `db.create`'s
  generalist path (GLOBAL-036's dual front door), add memory shapes
  alongside. Renames are a hidden tax on early adopters; additive is the
  right shape pre-PMF.
- **Consequence in code:** New `apps/api/src/db-create/presets/agent-memory-v1.ts`
  (E-01) and a `{ preset }` field on `db.create`. New `nlqdb_remember`
  (E-02) and `nlqdb_recall` (E-05) MCP tools alongside the three existing
  ones. Per-agent scope via row-level RLS (E-03, `app.agent_id` GUC —
  SK-PIVOT-009), not query-rewriting. `expires_at` TTL with a
  scheduled sweep (E-04). pgvector index on `facts.content` + hybrid fusion
  in the compile layer (E-05, infra-gated). `/agents` CreateForm passes
  `preset="agent_memory_v1"` (E-06). Workload-analyzer + migration
  orchestrator gain a memory rule (E-07, Phase 3).
- **Alternatives rejected:** **Rename `nlqdb_query` to memory verbs** —
  breaks SK-MCP-002 and every integrated host for cosmetic gain. · **Replace
  the generalist `db.create` path with the memory preset** — destroys the
  P1/P3/P4 surfaces the dual-front-door (GLOBAL-036) is committed to. ·
  **Skip the engine track and let agents build their own memory schema via
  generic `db.create`** — what we have today; the "zero schema design"
  wedge claim is then false. · **One mega-PR for the whole track** —
  unreviewable, contradicts the daily-loop sizing rule.

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

- **Decision:** E-03 per-agent scoping (and E-04's TTL read-visibility) is
  enforced by an **additive row-level RLS policy** on the `agent_memory_v1`
  tables — `agent_isolation`, keyed on `current_setting('app.agent_id', true)`
  (E-04 adds the `expires_at` clause) and ANDed with the existing schema-wide
  `tenant_isolation` — with the exec wrappers setting
  `set_config('app.agent_id', …, true)` per request alongside `app.tenant_id`.
  The `/v1/ask` read path is **not** rewritten to inject a `WHERE agent_id`
  predicate. `agent_id` defaults to the tenant principal id (today's
  behaviour); an optional explicit `agent_id` request field narrows to a
  sub-tenant agent (additive, backward-compatible).
- **Core value:** Bullet-proof, Simple
- **Why:** The read path executes free-form LLM-emitted SQL via
  `neonSql.unsafe(sql)` (`ask/build-deps.ts`) — there is **no** typed-plan
  compiler or AST step on the query path to inject a predicate into. Rewriting
  arbitrary LLM SQL to force a scope predicate (CTEs, JOINs, aliases) is
  fragile, and on a security boundary a parser gap is a cross-agent data
  breach. RLS is what the provisioner already uses for tenant isolation
  (`tenant_isolation`, `neon-provision.ts`): engine-enforced, filters every
  read/write regardless of SQL shape, extends to agent scope with one policy +
  one GUC (also the single scope source for the eventual ClickHouse engine).
- **Consequence in code:** `neon-provision.ts` emits an `agent_isolation`
  policy per memory table on the preset path; `buildExec`/`buildMemoryExec`
  set `app.agent_id`; the handler resolves `agent_id` from the principal (+
  optional field). `sql-validate.ts` stays a generic destructive-verb
  guardrail — **not** the scope gate. **Supersedes** the "compile-layer scope
  predicate, dual-gated by `sql-validate`" mechanism in SK-PIVOT-006 / the
  E-03 worksheet. Ships with two-principal invariant tests + second review
  (Neon-gated).
- **Alternatives rejected:** **AST `WHERE`-injection into LLM SQL** — fragile;
  a parser miss is a breach (the original E-03 plan, falsified here). ·
  **`sql-validate.ts` refuses queries lacking the predicate** — it can reject
  but not *inject*, so can't be the primary gate. · **Per-agent schema/DB** —
  defeats one shared memory DB per tenant + the zero-schema-design wedge.

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
