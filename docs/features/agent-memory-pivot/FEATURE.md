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
memory — delivered as a sequence of small, reversible, daily-loop-sized
slices rather than a relaunch. **Two tracks ship in parallel:** messaging
(WS-01..WS-13 — how users discover the wedge) and **engine** (E-01..E-07 —
the memory-shaped primitives that make the wedge claims durable).
**Status:** in progress (Phase 2 distribution) — backlog ready; WS-01 shipped (2026-06-19, run 19 — Zep/Letta/LangMem anchored in `docs/competitors.md §4`), 1 of 20 slices.
**Owners (code):** `apps/web/src/pages/agents/**`, `apps/web/src/data/{competitors,solve,showcase-examples}.ts`, `apps/api/src/db-create/presets/**` (engine track), `packages/mcp/src/server.ts`, `apps/api/src/db-create/neon-provision.ts` + `ask/build-deps.ts` (agent-scope RLS, SK-PIVOT-009), `apps/docs/src/content/docs/mcp.mdx`, `README.md`.
**Cross-refs:** `docs/research/deepseek-moat-framing.md` (the thesis) · `docs/competitors.md §4` (agent-memory landscape) · `docs/research/personas.md §P2` · GLOBAL-036 (canonical text in `docs/decisions/GLOBAL-036-lead-positioning-analytical-agent-memory.md`; index in `docs/decisions.md`).

## Touchpoints — read this feature doc before editing

- `apps/web/src/pages/agents/**` — the dedicated `/agents` front door (new)
- `apps/web/src/data/competitors.ts` — memory-competitor `/vs` pages
- `apps/web/src/data/solve.ts` — agent-memory solve pages
- `apps/web/src/data/showcase-examples.ts` — home carousel slides
- `packages/mcp/src/server.ts`, `apps/docs/src/content/docs/mcp.mdx` — MCP framing
- `docs/features/agent-memory-pivot/worksheets/**` — the backlog

> **The backlog lives in [`worksheets/`](worksheets/).** Cold daily-loop
> agents start at [`worksheets/INDEX.md`](worksheets/INDEX.md): pick the
> lowest-numbered unchecked worksheet whose prerequisites are met, do **one
> slice = one small PR = one measured delta**, tick it, append one
> distribution artifact. The **engine track** has its own
> [`worksheets/engine/INDEX.md`](worksheets/engine/INDEX.md) (E-01..E-07);
> the two tracks interleave (rule of thumb: pick `WS-*` when the worst
> number is funnel/distribution, `E-*` when it is engine quality / agent
> on-ramp / "wedge claims true"). The complete "every surface a user lands
> on, current copy → target copy" inventory is
> [`worksheets/messaging-surface-map.md`](worksheets/messaging-surface-map.md).

## What changes where (answers "how does each area change?")

| Area | Change | Owned by |
|---|---|---|
| **Docs decisions** | New **GLOBAL-036** (lead positioning, dual front door). **GLOBAL-019** + `architecture.md §0` wording corrected to FSL-1.1→Apache in this PR (the license is already FSL-1.1-ALv2; this only syncs the stale description). This feature's `SK-PIVOT-*` carry the tactical calls. | GLOBAL-036 |
| **Scorecard / daily loop** | A **Pivot — agent-memory wedge** section in `docs/scorecard.md` carries **one row per worksheet** (13 WS + 7 E = 20 rows), ticked ⬜→✅ with the PR link on merge. The loop's normal *measure first → pick the worst number → smallest lever* flow surfaces the pivot through that table — **no `.claude/commands/daily.md` changes**. The weekly focus number stays founder-set. | this PR (`scorecard.md`) |
| **Architecture** | `architecture.md §0` "Open source … Apache-2.0" corrected to FSL-1.1 in this PR. `§2.1` gains the `/agents` route (a path on `nlqdb.com`, **no new domain**). `§0.1` already uses `nlqdb_query("memory", …)` — kept. | this PR (§0); WS-07 (§2.1 route) |
| **Phase plan** | Phase 2 already targets "1 agent product publicly uses nlqdb as memory" — the wedge content is folded into Phase 2 distribution. The **self-host container** (`ghcr.io/nlqdb/api`) is pulled forward from Phase 3 so the self-host claim is true before `/agents` leads with it. | WS-11 |
| **Home page & product/APIs** | Home reweights to agent-memory-primary with a demoted "also works for…" fold; new `/agents` landing; Mem0+Zep+Letta+LangMem matrix; sharpened solve pages; **MCP tool + package descriptions carry the agent-memory framing**; on-brand demo + OG images. Headline/README/llms.txt swap is **founder-gated, sequenced last**. | WS-01…WS-09, WS-12, WS-13 |
| **Engine / actual architecture** | Canonical `agent_memory_v1` preset (`facts`/`episodes`/`entities`/`entity_facts`) as a `db.create` path. **Additive** MCP tools `nlqdb_remember` + `nlqdb_recall` (`nlqdb_query` unchanged — SK-MCP-002). Per-agent scope via additive row-level RLS (`app.agent_id` GUC; SK-PIVOT-009) — security-critical, not query-rewriting. TTL + cron sweep (Mem0/Zep parity). pgvector hybrid recall. Preset on-ramp on the **authed** create surface (`MEMORY_PRESET`-gated; **not** the anon `/agents` CreateForm — SK-PIVOT-010). Workload-analyzer routes large memory DBs to ClickHouse (Phase 3). | E-01…E-07 |

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

- **Decision:** The `agent_memory_v1` preset on-ramp (E-06) targets the
  **authenticated** create surface (`POST /v1/databases { preset }` from the
  chat left-rail / `/app/new` for a signed-in user), gated behind
  `MEMORY_PRESET`. The anonymous `/agents` page does **not** render
  `<CreateForm preset>`; it keeps its WS-07 "try this query" CTA → `/app/new`
  (run 36). The original E-06 plan — render
  `<CreateForm preset="agent_memory_v1">` on the public `/agents` page so an
  anonymous visitor lands directly on the preset path — is infeasible and
  dropped.
- **Core value:** Bullet-proof, Honest, Simple
- **Why:** The preset path is authenticated-only across **three** independent
  boundaries: (1) `POST /v1/databases` is `requireSession` and rejects
  `preset` unless `MEMORY_PRESET=1` (`apps/api/src/index.ts:2357,2390`);
  (2) the companion `POST /v1/memory/remember` write verb rejects `anon`
  (`auth_required`) and `pk_live` (`forbidden`, read-only) — only a
  user-session key writes memory (`index.ts:1426-1433`); (3) `CreateForm` is
  deliberately anon-only by contract — it always sends `credentials:"omit"` +
  an anon bearer so the device-cap → sign-in handoff works (SK-ANON-008), and
  never carries a session. So an anon `/agents` visitor cannot reach the
  preset path, and reworking CreateForm to do so would break the anon-first
  contract. The memory wedge is authed by design — "the wedge feeds the
  waitlist, it does not open the product" (pivot hard rule) — so the on-ramp
  belongs where a principal exists.
- **Consequence in code:** E-06 is resized from "low · 1 run · anon
  CreateForm" to "authed create surface · `MEMORY_PRESET`-gated · needs the
  flag enabled in prod first." The anon `/agents` CTA stays as shipped (run
  36). The result-view MCP host-config snippet (E-06 step 3) still applies,
  but on the authed surface. The E-06 worksheet + engine INDEX are corrected;
  **no code shipped this run** — the flag is dark in prod, so any preset UI
  would return `preset_disabled` 400 for every visitor.
- **Alternatives rejected:** **Rework CreateForm to send the session cookie
  when present** — breaks SK-ANON-008 (a signed-in hero submit would skip the
  device cap, and the anon→sign-in handoff regresses). · **Add an anonymous
  preset-create endpoint** — opens the product to anon memory DBs, violating
  the pivot's waitlist-feed rule and adding GLOBAL-027 gate + anon-cap surface
  for a still-dark flag. · **Ship the `/agents` preset UI now against the dark
  flag** — every visitor hits `preset_disabled` 400; ships a broken on-ramp.

### SK-PIVOT-005 — The self-host / anti-VC angle is messaged under FSL-1.1 honestly, and the container is pulled forward to make it true

- **Decision:** The open/free wedge is stated truthfully under **FSL-1.1**
  ("source-available, self-hostable for non-competing use, bring your own LLM
  key at 0% markup, no per-call fees, no pricing page") — **not** as
  "Apache-2.0, `docker compose up`" which is false today. The self-host
  container (`ghcr.io/nlqdb/api`) is pulled forward from Phase 3 so the
  self-host claim is shippable before `/agents` leads with it.
- **Core value:** Free, Open source, Honest latency
- **Why:** The "Free" moat is real leverage with the self-hosted-agent crowd,
  but the literal "Apache-2.0 + `docker compose up`" pitch over-claims: the
  license is FSL-1.1 and no image has shipped. Leading on an unshipped claim
  burns trust.
- **Consequence in code & docs:** `GLOBAL-019` + `architecture.md §0` wording
  corrected to "FSL-1.1-ALv2 → Apache-2.0" (a factual sync). `/agents`,
  `README`, and the manifesto state the self-host angle in FSL-accurate terms
  (WS-10). Pulling the container forward (WS-11) is multi-run, founder/infra-gated.
- **Alternatives rejected:** Relicense to Apache-2.0 now — reverses a
  deliberate FSL choice (a money/legal bet the founder declined). · Claim
  self-host before the image ships — over-claim.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL;
index in [`docs/decisions.md`](../../decisions.md)).

- **GLOBAL-036** — Lead positioning: analytical memory for AI agents (dual front door).
  - *In this feature:* the canonical positioning decision; every worksheet implements a slice of it.
- **GLOBAL-019** — Free + Open Source core.
  - *In this feature:* the anti-VC angle leans on it; its stale "Apache-2.0 today" wording (and `architecture.md §0`) is corrected to FSL-1.1→Apache in this PR. The FSL-accurate self-host *marketing copy* is WS-10.
- **GLOBAL-024** — Demand-signal telemetry on every "not yet" path.
  - *In this feature:* every new wedge CTA (matrix "try this", `/agents` waitlist) emits the typed event; the waitlist is the conversion, not the gated product.
- **GLOBAL-025** — North-star KPIs (advance ≥ 1, degrade 0).
- **GLOBAL-027** — Pre-alpha gate.
  - *In this feature:* messaging ships; the product stays gated; the wedge feeds the waitlist; thresholds are **not** re-escalated.
- **GLOBAL-033** — Resolution defaults.
- **GLOBAL-034** — Analytics stack.

## Contribution to north-star

Advances **onboarding** (a sharper, single-story wedge lifts landing →
waitlist conversion — the funnel lane the scorecard currently calls the worst
number) and **UX** (a clearer category story). It does **not** touch
**engine quality** or **performance** — every slice is copy/data/page work
behind the unchanged pre-alpha gate, so the BIRD/Spider lanes and the
latency budgets are unaffected by construction. The headline reposition is
gated precisely so an irreversible brand change cannot degrade the generalist
funnel before the wedge content proves itself.

## Open questions / known unknowns

- **`/agents` vs `/memory` slug** — defaulting to `/agents` (matches the P2
  persona name and the MCP-directory audience). Revisit if keyword research
  favours `/memory`.
- **Capability-matrix freshness** — competitors ship fast; a stale `✓/—` is
  worse than none. WS-06 sets a "verified-on" date on the matrix; the daily
  loop treats a date > 60 days old as an alert (mirrors the engine-row rule).
- **Self-host container scope** — pulling `ghcr.io/nlqdb/api` forward (WS-11)
  may exceed one daily run and touches infra; the worksheet flags the
  founder/infra gate rather than assuming a copy-only diff.
- **Headline-reposition trigger** — what evidence trips WS-13 (the gated
  swap)? Proposed default: founder call at a weekly session once the
  `/agents` page + matrix + ≥ 2 memory-competitor pages are live and the
  funnel `Pivot:` line shows non-zero wedge-sourced waitlist rows.
