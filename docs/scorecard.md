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
| 6 | BIRD raw EX | 0.520 | target 0.65; was 0.522 (06-12). Canonical re-run on current main (T20–T22): 260/500, `no_sql` 3 → 1. **Flat within variance** — McNemar b=38/c=37, p=0.50, no regression. Directive levers saturated; literal/value (§4 #2a) + date-encoding (§4 #2c) levers both falsified standalone offline (run 31) ⇒ reasoning levers (§4 #3/#1) next |
| 7 | Spider raw EX | 0.1852 | target 0.75; was 0.1704 (06-12). Gemini key restored 06-17 → `no_sql` 36 → 9 (`SK-LLM-039`). Run 33: external-knowledge injection (`SK-QUAL-016`, 13/135 dropped docs). **Run 34: self-consistency vote core shipped (`SK-QUAL-017`)** — the §4 #3 reasoning lever for the residual SQL-reasoning bottleneck; sampling+dispatch is the follow-on, EX delta next dispatch |
| 8 | persona-bench | — | not yet built |
| 9 | free-vs-frontier delta | null | agentic lane not yet run (`SK-QUAL-004`, target ≤ 25 pp) |
| | **Ops — 7d, CF Workers analytics** | | wall-time, all routes (not `/ask`-only) |
| 10 | nlqdb-api requests / errors | 2,268 / 0 (0.00%) | mcp 284 req, events-worker 91 req, both 0 err |
| 11 | nlqdb-api latency p50 / p95 | 666 ms / 7.05 s (06-13) | p95 dominated by LLM-bound asks; `/ask`-only split needs Grafana `metrics:read` (agent has write-only key) |
| 12 | $ spend | ~$0 | free tiers across CF / Neon / LLM chain |
| | **Pivot — agent-memory wedge** (GLOBAL-036) | 9 / 20 + 3 memory /vs pages | tick ⬜→✅ with PR link on merge; mirrors `docs/features/agent-memory-pivot/worksheets/INDEX.md` |
| | *Messaging track — WS-\** | 7 / 13 (WS-07 🟡 2/3, WS-09 🟡 1/2) | pick when worst number is funnel / distribution |
| WS-01 | competitors.md anchor (Zep / Letta / LangMem) | ✅ | run 19 — §4 + threat matrix; unblocks WS-02 |
| WS-02 | memory `/vs` pages (one per run) | ✅ 3/3 | run 20 — **Zep ✅** (`/vs/zep`); run 21 — **Letta ✅** (`/vs/letta`); run 22 — **LangMem ✅** (`/vs/langmem`) — WS-02 closed |
| WS-03 | solve pages — sharpen + sibling | ✅ 2/2 | run 23 — **sharpen ✅**; run 25 — **analytical sibling ✅** (`analytical-queries-over-agent-memory`, the read-side report-over-memory wedge) |
| WS-04 | MCP tool + package + docs framing | ✅ | run 24 — three tool descriptions + `package.json` desc + `mcp.mdx` intro now lead with "analytical memory" (copy only; SK-PIVOT-003) |
| WS-05 | carousel analytics-over-memory slides | ✅ | run 26 — 2 analytics-over-memory slides (`GROUP BY category` + top-N `ORDER BY … LIMIT 5`), MCP surface; data-only `showcase-examples.ts` |
| WS-06 | Mem0 \| Zep \| Letta \| nlqdb capability matrix | ✅ | run 27 — **data ✅** (`agentMemoryMatrix.ts`, 9 honest rows + test); run 28 — **render ✅** (`AgentMemoryMatrix.astro`, four-up glyph grid, nlqdb accent column, no `<img>`) |
| WS-07 | `/agents` landing | 🟡 2/3 | run 30 — **skeleton + hero ✅**; run 31 — **matrix + moat ✅** (WS-06 matrix embedded + typed-plan trust-boundary pipeline + FSL/BYO-key band, `pages/agents/index.astro`); CTA + demand-signal (run 3) |
| WS-08 | on-brand OG / social images | ⬜ | low · ~2 runs · WS-07 |
| WS-09 | "database, not a vector store" blog + live demo | 🟡 1/2 | run 30 — **blog draft ✅** (launch post in `distribution-queue.md`: Replit incident → recall≠analytics → typed-plan boundary → measured BIRD 0.52 / Spider 0.1852 + `tools/eval/` link + WS-06 matrix); live `/agents` demo deferred (run 1, collides with WS-07 #430) |
| WS-10 | FSL self-host messaging (GLOBAL-019 / arch §0 doc-fix shipped) | ✅ | run 28 — pricing self-host band + README "Models & plans" self-host line (FSL-accurate; no turnkey-image claim per WS-11 note) |
| WS-11 | pull `ghcr.io/nlqdb/api` self-host container forward | ⬜ | high · multi · WS-10 · infra-gated |
| WS-12 | home reweight + demote P1/P3/P4 to "also works for…" | ⬜ | med · ~2 runs · WS-06, WS-07 |
| WS-13 | headline reposition (hero / README / llms.txt / JSON-LD) | ⬜ | high · ~2 runs · WS-07, WS-12 · 🔒 **FOUNDER-GATED** |
| | *Engine track — E-\** | 2 / 7 | pick when worst number is engine quality / agent on-ramp |
| E-01 | `agent_memory_v1` schema preset for `db.create` | ✅ | run 29 module + run 30 wiring (SK-HDC-020): `db.create { preset: "agent_memory_v1" }` provisions the 4 tables deterministically, no LLM; gated behind `MEMORY_PRESET`. One follow-on: quality-eval ablation row (Neon-branch gated) |
| E-02 | additive MCP tool `nlqdb_remember` (no rename) | ✅ | run 31 (SK-PIVOT-008): server-built deterministic parameterised INSERT via `POST /v1/memory/remember` (never `/v1/run` — trust boundary), `wrong_preset` guard, SDK `remember()`, `nlqdb_remember` tool. Follow-ons: e2e Neon smoke (infra) + CLI `nlq remember` (Go) |
| E-03 | per-agent / end-user / thread scoping — **RLS, not query-rewriting** (SK-PIVOT-009, mechanism corrected run 32) | ⬜ | **high · security-critical** · ~2 runs · E-01 · Neon-gated |
| E-04 | TTL + cron sweep (`expires_at`) | ⬜ | low · 1 run · E-01 |
| E-05 | hybrid recall — pgvector + `nlqdb_recall` | ⬜ | high · multi · E-01 · infra-gated |
| E-06 | `/agents` CreateForm uses the preset | ⬜ | low · 1 run · E-01 + WS-07 |
| E-07 | workload-analyzer rule: memory DBs → ClickHouse (Phase 3) | ⬜ | med · multi · E-01 + Phase-3 multi-engine |

## Deltas (recent runs)

- 2026-06-20 (run 35) — **Engine: self-consistency vote core shipped
  (`SK-QUAL-017`) — the §4 #3 reasoning lever, top free-chain lever after the
  directives saturated.** Worst number is engine (Spider 0.1852); BIRD 06-19 +
  Spider 06-17 both < 7 d so §5 forbids a dispatch and #438 owns the messaging
  lane, leaving the named reasoning lever's deterministic core as the
  non-colliding engine slice. Pure `majorityVote` + `fingerprintRows`
  (`tools/eval/`) cluster N executed plans by their **result set** (the answer,
  not the SQL string), returning the modal cluster's SQL + agreement; ties →
  earliest cluster (stable run-to-run). Staged ahead of the sampling/dispatch
  half (default-greedy `SK-LLM-024` baseline untouched; runner
  `--self-consistency N`), the SK-QUAL-014/015 prove-the-primitive pattern.
  **Δ:** §4 #3 backlog → vote-core shipped+proven (12 unit cases); EX delta next
  canonical dispatch. KPI: **engine quality**; none degraded — no prod
  chain/scorer/runner change, baselines untouched, perf N/A; 232 eval tests
  green (was 220). Artifact: "Why we vote on the answer, not the SQL" queued.
- 2026-06-20 (run 34) — **Engine (memory write-path): fail-loud TTL gap +
  phantom-column footgun in the E-04 lever, both fixed.** Worst number is engine
  (Spider 0.1852) but BIRD 06-19 + Spider 06-17 are < 7 d (§5: no back-to-back
  dispatch), messaging is blocked behind WS-07 (#438), and the E-track's other
  slices are Neon/infra-gated — leaving the clean non-colliding lever: a
  correctness gap on the memory **write** path. `validateRememberInput` parsed
  `ttlSeconds` for every `kind` but only `facts` carries `expires_at`, so a TTL
  on an episode/entity was **silently dropped** (GLOBAL-012 violation — the
  agent believes it set an expiry that never existed); now rejected with a
  one-sentence reason. The **E-04 worksheet** compounded it (told a future
  implementer to sweep `episodes.expires_at`, absent from the shipped E-01 DDL)
  — corrected to facts-only sweep + facts-only RLS TTL clause before the
  Neon-gated slice is built against a phantom column. **Δ:** `remember.test.ts`
  16 → 18; a corrected backlog lever (run-32 pattern). KPI: **engine quality** /
  **onboarding**; **none degraded** — additive validation, no
  engine/chain/scorer/eval touched, BIRD 06-19 + Spider 06-17 untouched, perf
  N/A. Artifact: "How nlqdb expires agent memory (and why only facts get a TTL)"
  queued.
- 2026-06-20 (run 33) — **Engine: Spider external-knowledge injection shipped
  (`SK-QUAL-016`) — fixes a measured handicap on the worst number.** Worst
  number is engine (Spider 0.1852); BIRD 06-19 + Spider 06-17 both < 7 d so §5
  forbids a back-to-back dispatch, and both open PRs own a lane (#435 E-03 RLS
  docs, #436 `nlq remember` CLI) — the clean non-colliding engine lever is the
  Spider loader (`tools/eval/`, untouched by either). The loader parsed
  `external_knowledge` but **dropped the doc body**, so Spider questions got no
  provided context while BIRD injects `evidence`. Measured offline: **13/135
  `local###` (9.6%)** carry a dropped doc (haversine, RFM, music-length,
  f1-overtake, …) across 8 DBs — the docs *are* the answer, so these are
  unanswerable, not hard. `loadExternalKnowledge` now injects the `<name>.md`
  body through `evidence` → `enrichedGoal` (cache-authoritative, fail-soft,
  traversal-gated). **Δ:** 13/135 addressable handicap closed; EX delta measured
  by the next canonical Spider dispatch (`SK-QUAL-002`). KPI: **engine quality**;
  none degraded — no runner/scorer/chain change, BIRD 06-19 + Spider 06-17
  untouched, perf N/A; 29 spider2-lite tests green (was 24).
- 2026-06-20 (run 32) — **Engine-track finding (SK-PIVOT-009): E-03's documented
  compile-layer scoping mechanism is infeasible — the `/v1/ask` path executes
  free-form LLM SQL via `neonSql.unsafe(sql)` with no AST step to inject a
  `WHERE agent_id` into, so a SQL-rewriter on a security boundary = breach
  risk. Redirected E-03 (and E-04's read-filter) to row-level RLS keyed on an
  `app.agent_id` GUC — the pattern the provisioner already uses for
  `tenant_isolation`. Corrected E-03/E-04 worksheets + engine INDEX + FEATURE.md.
  **Δ:** a finding prunes a security-critical backlog lever before the
  breach-prone design ships; docs-only, no code/engine/chain/scorer touched,
  BIRD 06-19 + Spider 06-17 untouched. Artifact: the "scoping is RLS, not
  query-rewriting" note (queue).**
- 2026-06-20 (run 32) — **E-02 GLOBAL-003 parity closed: shipped CLI `nlq
  remember`** (SK-CLI-018; engine holds 2/7 — completes the memory-write verb's
  surface parity HTTP/SDK/MCP → **+CLI**, 3/4 → **4/4**). Non-colliding engine
  slice while #435 owned the E-03 RLS finding. `nlq remember [--db] [--kind] <text>`
  wraps `POST /v1/memory/remember`; `wrong_preset` rejects non-memory DBs;
  admitted as a third data verb under GLOBAL-017's explicit-justification clause
  (mirrors the SK-PIVOT-008 third endpoint). Gates green (Go build/vet/test/fmt).
  KPI: **onboarding / engine quality**; none degraded (additive, BIRD 06-19 +
  Spider 06-17 untouched). Artifact: "Give your AI agent memory from the
  terminal" queued.
- 2026-06-20 (run 31) — three closed slices (all additive; BIRD 06-19 + Spider
  06-17 untouched): **E-02** `nlqdb_remember` write primitive shipped → E-02
  closed (engine 1 → **2/7**; pivot 8 → **9/20**; #432, SK-PIVOT-008 —
  server-built parameterised INSERT via `POST /v1/memory/remember`, never
  `/v1/run`; SDK `remember()` + tool, CLI fast-follow); **WS-07 run 2/3**
  embedded the matrix + trust-boundary moat + FSL band on `/agents` (#433,
  WS-07 🟡 1/3 → **2/3**, markup-only); **§4 #2c date-normalisation directive
  FALSIFIED standalone** (#434, offline classifier — `date_literal_only` 0
  standalone, parked like #2a; reasoning levers #3/#1 next). Per-slice detail
  in the WS/E worksheets + `progress/quality-score-verification-log.md`.
- 2026-06-20 (run 30) — three closed slices (additive; BIRD 06-19 + Spider
  06-17 untouched): **E-01 run 2/2** wired the `agent_memory_v1` preset into the
  create request path → E-01 closed (engine **0 → 1/7**; pivot **7 → 8/20**;
  SK-HDC-020 — `DbCreateArgs.preset` skips classify/infer/compile, shares the
  validate→provision→mint tail so SK-HDC-003 holds, `POST /v1/databases
  { preset }` behind `MEMORY_PRESET`); **WS-07 run 1/3** shipped the `/agents`
  skeleton + hero (markup-only, WS-13 lead strings untouched); **WS-09 run 2/2**
  drafted the "database, not a vector store" launch post (WS-09 🟡 1/2,
  Replit-wipe → recall≠analytics → typed-plan boundary → measured BIRD 0.52 /
  Spider 0.1852 + `tools/eval/` link). Per-slice detail in the WS/E worksheets.
- 2026-06-20 (runs 26–29) — agent-memory pivot wave (all closed/merged,
  additive; no engine/chain/scorer touched; BIRD 06-19 + Spider 06-17 untouched).
  Engine lane blocked all four (both evals < 7 d, §5), so each picked the
  lowest-numbered in-bounds pivot slice: **WS-05** (run 26) two analytics-over-memory
  home-carousel `read` slides (`GROUP BY`/top-N over an `agent_memory` table;
  data-only `showcase-examples.ts`); **WS-06** (runs 27+28) the Mem0·Zep·Letta·nlqdb
  capability matrix — data `agentMemoryMatrix.ts` (9 honest rows, SK-PIVOT-001,
  self-host row honesty-corrected vs the framing doc) then the `AgentMemoryMatrix.astro`
  four-up glyph render (live text, no `<img>`, SK-PIVOT-004) → WS-06 ✅, unblocks
  WS-07; **WS-10** (run 28) FSL-1.1 self-host copy on `/pricing` + README
  (SK-PIVOT-005, no turnkey-image claim); **E-01** (run 29) the `agent_memory_v1`
  preset DDL module (`agent-memory-v1.ts`, plain DDL through `sql-validate-ddl`,
  SK-PIVOT-006/007). Counters reached pivot 9/20, messaging 7/13, engine 1/2.
  Per-slice detail in the WS/E worksheets; drafts queued in `distribution-queue.md`.
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
