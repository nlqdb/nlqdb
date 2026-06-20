# Scorecard

Regenerated daily by [`/daily`](../.claude/commands/daily.md) step 1 from live
sources (D1, KV, CF GraphQL, `eval-baseline.ts`). One table; soft 5 KB cap
**relaxed while the agent-memory pivot is in flight** (GLOBAL-036) — the
20-row Pivot section mirrors [`agent-memory-pivot/worksheets/INDEX.md`](features/agent-memory-pivot/worksheets/INDEX.md)
so every WS-* / E-* status is visible at a glance; the section collapses
back to a one-line summary once the pivot completes. Published distribution
URLs land here when a queue entry ships.

**Weekly focus number:** *(none set — founder picks at the weekly session;
until then the daily lever targets the worst number below)*

**Worst number today:** real strangers reaching a first answer = **0**
(funnel/distribution lane) — gated by the engine (GLOBAL-027 valve), so the
engine-side worst, **Spider 0.1852 vs 0.75**, owns it. **The Gemini free-tier
key was restored 2026-06-17** (fresh AI Studio key, mirrored to GHA + Worker)
and the full canonical Spider eval re-ran on the healed chain: raw EX
**0.1704 → 0.1852**, `no_sql` **36 → 9**, and `gemini:http_4xx`/`auth_denied`
is gone (`SK-LLM-039`). The 27 newly-answered questions mostly mismatch (hard
benchmark), so the engine bottleneck is now **SQL reasoning** (mismatches), not
provider availability. The run-15 `SK-QUAL-014` classifier buckets the 236 BIRD
mismatches: the mass is aggregation/DISTINCT **grain** + subquery **shape**,
much of it value/literal/column grounding. **BIRD re-run 2026-06-19** on current
main (first canonical since T20–T22 merged): raw EX 0.522 → **0.520** (260/500),
`no_sql` 3 → 1 — **statistically flat** (McNemar p=0.50, b=38/c=37, no
regression). The directive levers (T13–T16/T22) have **saturated on BIRD**.
**2026-06-19 (run 18): the `SK-QUAL-014` literal axis falsifies value-retrieval
as the top lever** — of the 238 BIRD mismatches, `literal_diff` is the largest
tag (90) but `literal_case_only` is 6 and **`literal_only` is 0**: no mismatch
is recoverable by fixing string literals alone (each co-occurs with a structural
error). So value-sampling (§4 #2a) flips ~0 rows standalone; the path to the
gate floor is the §4 **reasoning** levers (#3 self-consistency, #1 retrieval
few-shot), not retrieval. Value-retrieval is demoted + privacy-gated.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel — bot-filtered, 2026-06-15** | | walkers = `flow-004-walker` source / `nlqdb-flow004-*` emails |
| 1 | Visits, 7d (CF Web Analytics) | 94 visits / 147 pageloads | was 114/175 (06-13); walker traffic aged out of the 7d window |
| 2 | Waitlist rows, real | 1 of 69 | 68 walker/test/probe; the 1 is the founder → ~0 genuine strangers |
| 3 | Registered users, real strangers | 0 | 7 total = 3 founder + 4 test/dev accounts |
| 4 | Invite-valve crossings (KV `wl:invite-cap`) | 9/wk (06-13, carried) | cap 200/wk — no exhaustion risk; mostly walker-triggered; not re-pulled this run |
| 5 | Anon DBs with a recorded first answer | **101 of 101** | instrument fix (runs 1–3) holding; +8 since 06-13. Genuine-stranger subset still ~0 (rows #2/#3) — the real worst-number |
| | **Engine — BIRD 2026-06-19 · Spider 2026-06-17 (both fresh, < 7d)** | | `apps/api/src/gate/eval-baseline.ts` |
| 6 | BIRD raw EX | 0.520 | target 0.65; was 0.522 (06-12). Canonical re-run on current main (T20–T22): 260/500, `no_sql` 3 → 1. **Flat within variance** — McNemar b=38/c=37, p=0.50, no regression. Directive levers saturated ⇒ retrieval levers (§4 #2a) next |
| 7 | Spider raw EX | 0.1852 | target 0.75; was 0.1704 (06-12). Gemini free-tier key restored 06-17 → `no_sql` 36 → 9, `gemini:http_4xx` cleared (`SK-LLM-039`); residual 9 capacity-only. Bottleneck now SQL reasoning, not availability |
| 8 | persona-bench | — | not yet built |
| 9 | free-vs-frontier delta | null | agentic lane not yet run (`SK-QUAL-004`, target ≤ 25 pp) |
| | **Ops — 7d, CF Workers analytics** | | wall-time, all routes (not `/ask`-only) |
| 10 | nlqdb-api requests / errors | 2,268 / 0 (0.00%) | mcp 284 req, events-worker 91 req, both 0 err |
| 11 | nlqdb-api latency p50 / p95 | 666 ms / 7.05 s (06-13) | p95 dominated by LLM-bound asks; `/ask`-only split needs Grafana `metrics:read` (agent has write-only key) |
| 12 | $ spend | ~$0 | free tiers across CF / Neon / LLM chain |
| | **Pivot — agent-memory wedge** (GLOBAL-036) | 8 / 20 + 3 memory /vs pages | tick ⬜→✅ with PR link on merge; mirrors `docs/features/agent-memory-pivot/worksheets/INDEX.md` |
| | *Messaging track — WS-\** | 7 / 13 (WS-07 🟡 1/3, WS-09 🟡 1/2) | pick when worst number is funnel / distribution |
| WS-01 | competitors.md anchor (Zep / Letta / LangMem) | ✅ | run 19 — §4 + threat matrix; unblocks WS-02 |
| WS-02 | memory `/vs` pages (one per run) | ✅ 3/3 | run 20 — **Zep ✅** (`/vs/zep`); run 21 — **Letta ✅** (`/vs/letta`); run 22 — **LangMem ✅** (`/vs/langmem`) — WS-02 closed |
| WS-03 | solve pages — sharpen + sibling | ✅ 2/2 | run 23 — **sharpen ✅**; run 25 — **analytical sibling ✅** (`analytical-queries-over-agent-memory`, the read-side report-over-memory wedge) |
| WS-04 | MCP tool + package + docs framing | ✅ | run 24 — three tool descriptions + `package.json` desc + `mcp.mdx` intro now lead with "analytical memory" (copy only; SK-PIVOT-003) |
| WS-05 | carousel analytics-over-memory slides | ✅ | run 26 — 2 analytics-over-memory slides (`GROUP BY category` + top-N `ORDER BY … LIMIT 5`), MCP surface; data-only `showcase-examples.ts` |
| WS-06 | Mem0 \| Zep \| Letta \| nlqdb capability matrix | ✅ | run 27 — **data ✅** (`agentMemoryMatrix.ts`, 9 honest rows + test); run 28 — **render ✅** (`AgentMemoryMatrix.astro`, four-up glyph grid, nlqdb accent column, no `<img>`) |
| WS-07 | `/agents` landing | 🟡 1/3 | run 30 — **skeleton + hero ✅** (`pages/agents/index.astro`, agent-memory hero + AEO answer + retrieval-vs-analytics split, own SEO/canonical, in sitemap); matrix+moat (run 2), CTA+demand-signal (run 3) |
| WS-08 | on-brand OG / social images | ⬜ | low · ~2 runs · WS-07 |
| WS-09 | "database, not a vector store" blog + live demo | 🟡 1/2 | run 30 — **blog draft ✅** (launch post in `distribution-queue.md`: Replit incident → recall≠analytics → typed-plan boundary → measured BIRD 0.52 / Spider 0.1852 + `tools/eval/` link + WS-06 matrix); live `/agents` demo deferred (run 1, collides with WS-07 #430) |
| WS-10 | FSL self-host messaging (GLOBAL-019 / arch §0 doc-fix shipped) | ✅ | run 28 — pricing self-host band + README "Models & plans" self-host line (FSL-accurate; no turnkey-image claim per WS-11 note) |
| WS-11 | pull `ghcr.io/nlqdb/api` self-host container forward | ⬜ | high · multi · WS-10 · infra-gated |
| WS-12 | home reweight + demote P1/P3/P4 to "also works for…" | ⬜ | med · ~2 runs · WS-06, WS-07 |
| WS-13 | headline reposition (hero / README / llms.txt / JSON-LD) | ⬜ | high · ~2 runs · WS-07, WS-12 · 🔒 **FOUNDER-GATED** |
| | *Engine track — E-\** | 1 / 7 | pick when worst number is engine quality / agent on-ramp |
| E-01 | `agent_memory_v1` schema preset for `db.create` | ✅ | run 29 module + run 30 wiring (SK-HDC-020): `db.create { preset: "agent_memory_v1" }` provisions the 4 tables deterministically, no LLM; gated behind `MEMORY_PRESET`. One follow-on: quality-eval ablation row (Neon-branch gated) |
| E-02 | additive MCP tool `nlqdb_remember` (no rename) | ⬜ | med · 1 run · E-01 |
| E-03 | per-agent / end-user / thread compile-layer scoping | ⬜ | **high · security-critical** · ~2 runs · E-01 |
| E-04 | TTL + cron sweep (`expires_at`) | ⬜ | low · 1 run · E-01 |
| E-05 | hybrid recall — pgvector + `nlqdb_recall` | ⬜ | high · multi · E-01 · infra-gated |
| E-06 | `/agents` CreateForm uses the preset | ⬜ | low · 1 run · E-01 + WS-07 |
| E-07 | workload-analyzer rule: memory DBs → ClickHouse (Phase 3) | ⬜ | med · multi · E-01 + Phase-3 multi-engine |

## Deltas (recent runs)

- 2026-06-20 (run 30) — **WS-07 run 1/3: shipped the `/agents` skeleton + hero**
  (`apps/web/src/pages/agents/index.astro`). WS-07 ⬜ → **🟡 1/3** ("/agents
  skeleton live" boolean flipped). Engine lane blocked (BIRD 06-19 + Spider
  06-17 both < 7 d; §5 forbids a back-to-back eval dispatch) and the engine
  track's in-progress slice E-01 is in flight on open PR #429 — so the
  in-bounds lever is funnel/distribution, and per the pivot INDEX pickup rule
  WS-07 is the lowest-numbered ⬜ messaging worksheet with its prereq (WS-06 ✅,
  closed run 28) met; it touches only `apps/web/src/pages/agents/**` +
  `sitemap.xml.ts` (no collision with #429). The new route is the second front
  door (GLOBAL-036): an agent-memory-led hero ("Memory your agent can query."),
  an AEO direct-answer block ("What is analytical agent memory?"), and a
  retrieval-vs-analytics split (vector store returns top-k similar chunks;
  nlqdb runs the `GROUP BY` because the memory *is* a database). On-brand
  (acid-lime on near-black, JetBrains Mono, hard-shadow accent column, no
  `<img>`); honest pgvector-deferred scope line; cites the manifesto
  "not a vector store" anchor; links to `/vs`. Own `title`/`description`/
  `canonical`; the `SoftwareApplication` JSON-LD is emitted by `Base.astro`
  from the agent-memory `description` (no duplicate block — P5). Added
  `/agents` to `sitemap.xml.ts` `STATIC_ROUTES` for crawler discovery.
  **Sitewide lead strings (`Hero.astro`, README, `llms.txt`) untouched** (the
  WS-13 gate); the WS-06 matrix + typed-plan-trust-boundary moat + FSL band are
  run 2, the waitlist CTA + GLOBAL-024 demand-signal event are run 3. Gates:
  astro-check **0/0/0** (74 files, +1), web **126** tests, biome clean. KPI:
  **onboarding / UX** (GLOBAL-025) — a dedicated agent-builder on-ramp the
  HN/Reddit/MCP-directory audience can link to; **none degraded** (additive
  route, no code path / engine / chain / scorer / eval touched; BIRD 06-19 +
  Spider 06-17 untouched; performance N/A — static markup). Artifact: a
  "Show HN: analytical memory for AI agents" draft pointing at `/agents`
  appended to the distribution queue. Next pivot lever is WS-07 run 2 (embed
  the matrix + moat).
- 2026-06-20 (run 30) — **E-01 run 2/2: wired the `agent_memory_v1` preset into
  the create request path — E-01 closed** (engine track **0 → 1/7**; Pivot
  **7 → 8/20**; E-01 🟡 1/2 → **✅**). Lever choice: the worst number is engine
  (Spider 0.1852), but BIRD 06-19 + Spider 06-17 are both < 7 d so §5 forbids a
  back-to-back eval dispatch; the in-bounds engine lever is the pivot **engine
  track**, and E-01 was the lowest-numbered in-progress slice (🟡, prereqs met),
  so run 1 (#428, the module) → run 2 (this, the wiring). **SK-HDC-020:**
  `DbCreateArgs.preset?: MemoryPreset`; the orchestrator branches on it to skip
  `classifyEngine`/`inferSchema`/`compileDdl` (no LLM, no token cost, zero
  schema-design friction) and source `engine` (pinned `postgres`), the typed
  `plan` (new `agentMemoryV1Plan()` projection — metadata only: RLS table list,
  recent-tables MRU, FK summary, a version-keyed `schema_hash`), and the `ddl`
  (`agentMemoryV1Ddl`) from the preset, then **shares steps 4–7**
  (validate → provision → MRU → embed → mint) with the inferred path so
  **SK-HDC-003 defense-in-depth is unchanged** (the hand-authored DDL still
  passes `validateCompiledDdl` + the provisioner). `POST /v1/databases` accepts
  `{ preset }` gated behind the **`MEMORY_PRESET`** flag (clean rollback;
  `preset_disabled` / `invalid_preset` / `preset_engine_conflict` rejections;
  no goal required). A contract test pins the projection's tables/columns to
  `AGENT_MEMORY_V1_COLUMNS` so it can't drift from the executable DDL.
  **Additive + opt-in** — the generic goal-string create path is untouched
  (dual front door, GLOBAL-036). Gates: orchestrate (38) + preset-contract (13)
  tests green, **824 API tests** green, typecheck + biome clean; FEATURE.md
  net-shrunk (D4) by externalizing SK-HDC-013's body. One follow-on tracked:
  the quality-eval preset-path ablation row (Neon-branch gated). KPI:
  **onboarding** (GLOBAL-025 — an agent gets a working memory DB with zero
  schema design); **none degraded** (additive, flag-gated, no engine/chain/
  scorer/eval touched; BIRD 06-19 + Spider 06-17 untouched; performance: the
  preset path is *faster* than inferred create — it skips two LLM calls).
  Artifact: a "give your AI agent a real memory database in one call" dev.to /
  Show-HN draft appended to the distribution queue. Next engine lever is **E-02**
  (`nlqdb_remember` MCP tool, prereq E-01 now ✅).
- 2026-06-20 (run 30) — **WS-09 run 2/2: drafted the launch post "Why agent
  memory should be a database, not a vector store"** (WS-09 ⬜ → **🟡 1/2**;
  blog-draft box ✅, live `/agents` demo deferred). Engine lane blocked (BIRD
  06-19 + Spider 06-17 both < 7 d; §5 forbids a back-to-back eval dispatch) and
  the engine track's in-progress slice (E-01) + the lowest open messaging
  worksheet (WS-07 `/agents`) are **both in flight** on open PRs (#429, #430) —
  so per the pivot INDEX pickup rule the in-bounds, non-colliding lever is
  WS-09's **run 2** (the post touches only `distribution-queue.md`); run 1 (the
  `<nlq-data>` demo) collides with the WS-07 page on #430 and is deferred until
  it merges. The post walks the **web-verified** Replit July-2025 prod-DB-wipe
  postmortem (P2: [Fortune](https://fortune.com/2025/07/23/ai-coding-tool-replit-wiped-database-called-it-a-catastrophic-failure/),
  [AI Incident DB #1152](https://incidentdatabase.ai/cite/1152/)) → why vector
  recall can't `GROUP BY` → the typed-plan trust boundary (LLM emits JSON, never
  SQL; compiler + `libpg_query` re-parse + diff preview) → **measured**
  BIRD 0.52 / Spider 0.1852 *with the sub-target gap shown* (from
  `eval-baseline.ts`, not a frontier cherry-pick) → open `tools/eval/` harness;
  embeds the WS-06 matrix and corrects the framing doc's over-claims (FSL-1.1
  not Apache-2.0; self-host honestly ◐). Number moved: **WS-09 ⬜ → 🟡 1/2**
  (launch-post box ✅); the messaging closed count holds at 7/13 and the pivot
  at 8/20 — WS-09 closes (and the count ticks) at run 1 when the live demo
  ships. KPI: **onboarding / UX**
  (GLOBAL-025) — the wedge's centrepiece distribution artifact; **none
  degraded** — draft-only edit to `distribution-queue.md` + worksheet/INDEX/
  scorecard ticks, no code path / engine / chain / scorer / eval touched;
  BIRD 06-19 + Spider 06-17 untouched; performance N/A. Artifact: the post
  itself (this entry).
- 2026-06-20 (run 29) — **E-01 run 1/2: shipped the `agent_memory_v1` schema
  preset module** (engine track 0 → **🟡 1/2**). New
  `apps/api/src/db-create/presets/agent-memory-v1.ts`: `agentMemoryV1Ddl(schemaName)`
  emits the four canonical tables (`facts` / `episodes` / `entities` /
  `entity_facts`) as deterministic, schema-qualified **plain DDL** — not a
  `SchemaPlan` (the shape needs multi-column UNIQUE, a composite-PK link table,
  `ON DELETE CASCADE`, `TEXT[]` + GIN, beyond the LLM-inferred grammar;
  SK-PIVOT-006/007), authored to pass the same `sql-validate-ddl` validator the
  LLM path uses (SK-HDC-006; the test asserts `{ ok: true }`). `embedding
  VECTOR` deferred to E-05; `AGENT_MEMORY_V1_COLUMNS` pins the contract
  (SK-PIVOT-007). **Additive + unreferenced** (rollback = delete the file);
  `{ preset }` input, `MEMORY_PRESET` flag, classifier-skip, and `versionTag →
  schema_hash` are run 2. Detail in worksheet E-01. Gates: 8 new tests green,
  typecheck + biome clean. KPI: **onboarding** (GLOBAL-025); none degraded — no
  request path / chain / scorer / eval touched.
- 2026-06-20 (run 28) — **WS-06 run 2/2: shipped the capability-matrix render
  component — WS-06 closed** (`apps/web/src/components/AgentMemoryMatrix.astro`).
  Pivot **6 → 7/20**; messaging track **6 → 7/13** (on top of WS-10, also run 28);
  WS-06 🟡 1/2 → **✅**. Engine
  lane still blocked (BIRD 06-19 + Spider 06-17 both < 7 d; §5 forbids a
  back-to-back eval dispatch), so the in-bounds lever is funnel/distribution; per
  the pivot INDEX pickup rule WS-06 was the lowest-numbered in-progress worksheet
  (🟡, prereq WS-01 ✅) and run 1 (#425) shipped its data, so run 2 is the render.
  Renders the run-27 `AGENT_MEMORY_MATRIX` (9 honest rows, Mem0 · Zep · Letta ·
  nlqdb) as a **four-up glyph grid** in the brand vocabulary (acid-lime accent on
  dark, JetBrains Mono, `✓/◐/—` shared with `/vs/<slug>`): nlqdb is the
  accent-railed, faintly-tinted column so the all-✓ wedge reads as one bright
  line; capability notes sit as muted sub-lines (keeps the glyph columns tight);
  legend + `MATRIX_VERIFIED_ON` footer. **Live text, no `<img>`** (SK-PIVOT-004) —
  the shape survives copy-paste and is liftable by AI search. Optional `heading`
  prop for the two reuse sites (`/agents` WS-07, blog WS-09). **Additive +
  unreferenced** until WS-07 wires it onto a page (rollback = delete the file);
  astro-check still type-checks it. **This closes WS-06 → unblocks WS-07**
  (`/agents` landing, prereq now met). Gates: web **126** tests (data invariants
  unchanged), astro-check **0/0/0** (73 files), biome clean on the new component.
  KPI: **onboarding / UX** (GLOBAL-025) — the wedge's most persuasive
  comprehension asset is now a renderable surface; **none degraded** (additive
  component, no code path / engine / chain / scorer touched; BIRD 06-19 + Spider
  06-17 untouched; performance N/A — static markup). Artifact: an X/Bluesky
  "one bright column" thread appended to the distribution queue (teaser for the
  run-27 Show HN matrix post). Next pivot lever is WS-07 (`/agents` landing).
- 2026-06-20 (run 28) — **WS-10: FSL self-host messaging shipped** (WS-10 ⬜ →
  **✅**). Engine lane blocked (BIRD 06-19 + Spider 06-17 both < 7 d; §5 forbids
  a back-to-back eval dispatch), so the in-bounds lever is funnel/distribution.
  **Copy only** (SK-PIVOT-005): added a self-host band to `/pricing` (mirrors the
  BYOLLM callout, zero new CSS) and a "Self-host the source" line to the README
  "Models & plans" section — both stated truthfully under **FSL-1.1-ALv2**
  (source-available, self-hostable for non-competing use, BYO key 0% markup, no
  per-call fees, auto-converts to Apache 2.0 after 2 yr). Honors the WS-11 note:
  **no turnkey `docker compose up`/running-image claim** until the container
  ships. Done-when box 2 ("no remaining 'Apache-2.0 today' claim about nlqdb")
  was already clean — README license + manifesto are FSL-accurate and the
  `competitors.ts` "Apache-2.0" mentions are factual statements about
  *competitors* (Letta/Wren). KPI: **onboarding / UX** (GLOBAL-025) — an honest
  self-host on-ramp for the self-hosted-agent crowd; **none degraded** (copy on
  existing surfaces — no code path, engine, chain, or scorer touched; BIRD 06-19
  + Spider 06-17 untouched; performance N/A). Artifact: a dev.to/r/selfhosted
  "what FSL-1.1 means for self-hosting nlqdb" note appended to the distribution
  queue.
- 2026-06-20 (run 27) — **WS-06 run 1/2: shipped the agent-memory capability
  matrix data** (`apps/web/src/data/agentMemoryMatrix.ts`). WS-06 ⬜ → **🟡 1/2**
  (data ✅, render component pending — run 2). Engine lane blocked (BIRD 06-19 +
  Spider 06-17 both < 7 d; §5 forbids a back-to-back eval dispatch); WS-03 (#423)
  and WS-05 (#424) merged ahead of this run, so per the pivot INDEX pickup rule
  WS-06 is the lowest-numbered ⬜ with its prereq (WS-01 ✅) met — it adds a
  brand-new file. New typed structure per **SK-PIVOT-001** (a four-column matrix,
  *not* a hacked single-`them` `/vs` template): `MatrixRow { capability; mem0;
  zep; letta; nlqdb; note? }` reusing `ComparisonClaim`, 9 honest rows +
  `MATRIX_VERIFIED_ON = 2026-06-19`. Rows ordered so the table's shape is the
  argument: recall is table stakes (all four ✓), the analytical wedge (top-N,
  GROUP BY/JOIN/HAVING, per-group aggregation, time-window, schema design, diff
  preview) is nlqdb-only. **Honesty correction vs the aspirational framing doc**
  (P2 / AEO): the self-host row is sourced from WS-01's web-verified
  `competitors.md §4` — Mem0 / Letta / LangMem are OSI-licensed (✓), Zep
  self-hosts only the Graphiti engine (◐), and nlqdb is FSL source-available, not
  yet OSI (◐, GLOBAL-019) — *not* the framing doc's "nlqdb ✓ / others ❌".
  `agentMemoryMatrix.test.ts` locks the invariants (every cell a valid claim, ≥5
  nlqdb-only wedge rows, recall is table stakes, verifiedOn < 60 d). Gates: web
  **122 → 126** tests, astro-check 0/0/0, biome lint clean. KPI: **onboarding /
  UX** (GLOBAL-025) — the matrix is the wedge's most persuasive comprehension
  asset (renders in run 2 on `/agents` + the blog); **none degraded** (additive,
  unreferenced file — no code path, engine, chain, or scorer touched; BIRD 06-19
  + Spider 06-17 untouched; performance N/A). Pivot counters unchanged at
  **5/20** + **5/13** (WS-06 is a half-step; the worksheet ticks ✅ only at run 2
  render). Artifact: a "comparison table" Show-HN/Reddit draft appended to the
  distribution queue (seeds the WS-09 HN post).
- 2026-06-20 (run 26) — **WS-05: analytics-over-agent-memory carousel slides**
  (Pivot messaging track 4 → **5/13**; Pivot 4 → **5/20**). Engine lane blocked
  (BIRD 06-19 + Spider 06-17 both < 7 d; §5 forbids a back-to-back eval
  dispatch), so the in-bounds lever is funnel/distribution. WS-03 closed in the
  prior run (run 25), so per the pivot INDEX pickup rule WS-05 is the
  lowest-numbered ⬜ with prereqs (none) met — it touches only
  `apps/web/src/data/showcase-examples.ts`. Added two `read` slides on the home
  carousel against an `agent_memory`-style table:
  `read-agent-memory-by-category` (`GROUP BY category … ORDER BY facts DESC`) and
  `read-agent-memory-top-recalled` (`GROUP BY content … ORDER BY recalls DESC
  LIMIT 5`), both MCP surface (`db_agents`). The wedge — *the math runs in
  Postgres, not as arithmetic in the model's head* — now rotates through the
  home's headline visual alongside the existing recall slide. **Data-only**,
  additive, reuses the existing typewriter mechanism; brand/animation untouched.
  `@nlqdb/web` 122 tests · astro-check 0/0/0 · biome clean. KPI: onboarding
  / UX (carousel comprehension for the agent-builder reader); engine + perf
  untouched (BIRD 06-19 / Spider 06-17 unchanged). Artifact: an X/Bluesky
  "your agent's memory should be able to GROUP BY" thread appended to the
  distribution queue. Next pivot lever is WS-06 (capability matrix).
- 2026-06-20 (run 25) — **WS-03 run 2/2: shipped the analytical sibling solve page
  `/solve/analytical-queries-over-agent-memory` — WS-03 closed** (Pivot messaging
  track 3 → **4/13**; Pivot 3 → **4/20**; solve pages 5 → **6**). Engine lane
  blocked (BIRD 06-19 + Spider 06-17 both < 7 d; §5 forbids a back-to-back eval
  dispatch), so the in-bounds lever is funnel/distribution; per the pivot INDEX
  pickup rule WS-03 was the lowest-numbered in-progress worksheet (🟡 1/2) with its
  prereq (none) met, and run 1 (the sharpen) shipped the write-side page, so run 2
  is the read-side sibling. Added one `SolveEntry` (`apps/web/src/data/solve.ts`,
  persona P2) — slug `analytical-queries-over-agent-memory`, `searchTitle` the NL
  query "How do I run reports over what my AI agent remembered?". The wedge is the
  **read side**: an agent that already logs memory needs *reports* over it
  (counts / top-N / averages per group); a vector store returns top-k similar rows
  with no query planner, so the rollup becomes the LLM doing arithmetic over search
  hits — nlqdb runs the actual `GROUP BY` in Postgres and shows the SQL. `demoGoal`
  = "count of facts the agent logged per category this month, highest first";
  cross-links the write-side `give-ai-agent-persistent-memory`. `whatItDoesnt` kept
  honest (no native vector search → Mem0/pgvector; no prebuilt charting). Real tool
  names only. Sitemap + `llms.txt` pick up the slug automatically; wired into
  `verify-flows.sh` SOLVE_SLUGS + `flow-002.ts` SLUG_DEMO_GOAL (also fixed the
  run-1 demoGoal drift in that mirror). Gates: web 122 tests, astro-check 0/0/0,
  stranger-test typecheck, lint all green. KPI: **onboarding** (GLOBAL-025) — a new
  AEO/decision-moment on-ramp for the P2 "analytics over agent memory" search
  intent; **none degraded** (additive content on the existing template — no code
  path, engine, chain, or scorer touched; BIRD 06-19 + Spider 06-17 untouched;
  performance N/A). Artifact: an r/AI_Agents "reporting over agent memory"
  helpful-answer draft appended to the distribution queue. **WS-03 closes**; next
  pivot lever is WS-05 (carousel) — the lowest-numbered ⬜ with prereqs met.
- 2026-06-19/20 (runs 23–24) — agent-memory messaging wave (both closed, additive copy; no engine/chain/scorer touched; BIRD 06-19 + Spider 06-17 untouched): **WS-03 run 1/2** (run 23) sharpened `/solve/give-ai-agent-persistent-memory` to the retrieval≠analytics wedge + fixed phantom MCP tool names (real three only, SK-PIVOT-002); **WS-04** (run 24) reframed the MCP surface — three tool `description`s/`title`s + `package.json` + `mcp.mdx` lead with "analytical memory" (copy only, SK-PIVOT-003; SK-MCP-002 contract + 33 tests intact). Messaging track → 3/13, pivot → 3/20. Per-slice detail in the WS worksheets; drafts queued in `distribution-queue.md`.
- 2026-06-19/21 (runs 19–22) — agent-memory wedge launch wave (all closed, additive content; no engine/chain/scorer touched): **WS-01** anchored the Zep / Letta / LangMem cluster in `docs/competitors.md §4` (run 19, pivot 0 → 1/20); **WS-02** shipped the three memory `/vs` pages — `/vs/zep` (run 20), `/vs/letta` (run 21), `/vs/langmem` (run 22) — each one `Competitor` entry keyed on the retrieval-vs-analytics wedge (`GROUP BY`/`JOIN`/`HAVING` over memory), facts web-verified 06-19, real tool names only. WS-02 closed → messaging track 2/13, pivot 2/20. Per-slice detail in the WS worksheets + `competitors.ts` history; comparison drafts queued in `distribution-queue.md`.
- 2026-06-19 (runs 17–18) — canonical BIRD re-run + literal-grounding axis,
  detailed in `progress/quality-score-verification-log.md`: the first 500-q BIRD
  re-run since T20–T22 (run 17) came back statistically flat (EX 0.522 → 0.520,
  McNemar p=0.50, `no_sql` 3 → 1) — the prompt-directive levers have saturated.
  The `SK-QUAL-014` classifier then gained a literal-grounding axis (run 18)
  which **falsified value-retrieval as the top lever** (`literal_only` = 0; every
  literal error co-occurs with a structural one), demoting it below the reasoning
  levers. No engine/chain code changed; no eval dispatched.
- 2026-06-16/18 (runs 11–16) — engine-instrument + deferred-lever wave, all
  detailed in `progress/quality-score-verification-log.md`: execution-guided
  PG-error repair (run 11, SK-ASK-022; `db_unreachable → rows`) · **Gemini
  free-tier key restored + Spider re-run** (run 12; raw EX 0.1704 → **0.1852**,
  `no_sql` 36 → 9) · join-bridge pruner recall (run 13, SK-LLM-037 rev / T21) ·
  HAVING planner directive (run 14, SK-LLM-040 / T22) · mismatch error-class
  classifier (run 15, SK-QUAL-014; `fewer_tables` 105 → 35) · column-coverage
  harness (run 16, SK-QUAL-015; 59.8% name-recall + 27.4% key re-admit, 12.8%
  value-only floor). Net read by run 16: value-retrieval ranks ahead of
  column-pruning — later falsified standalone by run 18.
- 2026-06-15/16 (runs 7–10) — provider-resilience wave: pin-to-2.0 falsified
  (run 7) → park a denied provider on the first 401/403 (run 9, SK-LLM-039)
  with a 30-min cooldown (run 10; dead-key round-trips 10 → 1) ·
  deterministic seed-row salvage (run 8, SK-HDC-019; 0 → 3).
- 2026-06-13/15 (runs 1–6) — day-one scorecard (metrics 0 → 12); #5 instrument
  fix (`last_queried_at` 0 → 93); tail transient retry (SK-LLM-038; BIRD EX
  0.522 → 0.528 best-case). Full history:
  `progress/quality-score-verification-log.md`.
