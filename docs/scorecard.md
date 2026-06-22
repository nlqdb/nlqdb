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
engine-side worst, **Spider 0.1852 vs 0.75**, owns it. The bottleneck is **SQL
reasoning** (mismatches), not provider availability (Gemini key healed 06-17,
`SK-LLM-039`) and not value/literal grounding (`SK-QUAL-014` run 18:
`literal_only` = 0 — no mismatch fixable by literals alone). BIRD re-run 06-19
is **flat** (0.522 → 0.520, McNemar p=0.50) ⇒ directive levers (T13–T22)
**saturated**; the path to the gate floor is the §4 **reasoning** levers.
**#3 self-consistency** is now **fully dispatchable**: runner merged (#447,
`SK-QUAL-017`) + the `self_consistency`/`sc_temperature` smoke-job
`workflow_dispatch` inputs (run 42, baseline-safe vehicle — no-emit, never
overwrites the canonical baseline). **#1 DAIL-SQL retrieval** — selector +
masking + the **curated pool (#451, half (a))** + now the **T9-ablation wiring
`buildPlanSystem` (half (b), run 43)**: default off ⇒ static `PLAN_SYSTEM`
byte-for-byte, the eval `--retrieve-exemplars k` flag swaps in the retrieved
prefix (token-budget 0.935× of static — token-negative), so the next dispatch
A/Bs greedy-static vs greedy-retrieved. **#1 is now built end-to-end bar the
dispatch**; only the hot-path embedding index remains. The #3 EX delta is the
greedy-vs-SC smoke gap on the first N>=2 dispatch; both land the next canonical
dispatch (blocked today — both evals < 7 d, §5).

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
| 7 | Spider raw EX | 0.1852 | target 0.75; was 0.1704 (06-12). Gemini key restored 06-17 → `no_sql` 36 → 9 (`SK-LLM-039`). Run 33: external-knowledge injection (`SK-QUAL-016`). **Self-consistency `SK-QUAL-017` (§4 #3): vote core (34) + execution half (37) + temperature-sampling half (run 40) + **runner `--self-consistency N` / `--sc-temperature T` main-loop wiring (run 41)** — `samples>=2` branch in `runOneQuestion` (separate from `withExecRetry`): `samplePlans`→`voteOverSamples` over `executeRows`→score-the-winner; folds into checkpoint/budget-stop/`attempts`, `.scN` checkpoint variant. The lever is now end-to-end bar the CI `workflow_dispatch` input. EX delta next dispatch** |
| 8 | persona-bench | **v0: 12 q / 2 ICP schemas, 12/12 golds execute** | offline fixture shipped (`SK-QUAL-018`, run 43) — `saas_app` (P1) + `agent_memory` (P2); free-chain EX next dispatch (runner-wiring staged) |
| 9 | free-vs-frontier delta | null | agentic lane not yet run (`SK-QUAL-004`, target ≤ 25 pp) |
| | **Ops — 7d, CF Workers analytics** | | wall-time, all routes (not `/ask`-only) |
| 10 | nlqdb-api requests / errors | 2,268 / 0 (0.00%) | mcp 284 req, events-worker 91 req, both 0 err |
| 11 | nlqdb-api latency p50 / p95 | 666 ms / 7.05 s (06-13) | p95 dominated by LLM-bound asks; `/ask`-only split needs Grafana `metrics:read` (agent has write-only key) |
| 12 | $ spend | ~$0 | free tiers across CF / Neon / LLM chain |
| | **Pivot — agent-memory wedge** (GLOBAL-036) | 13 / 20 + 3 memory /vs pages | tick ⬜→✅ with PR link on merge; mirrors `docs/features/agent-memory-pivot/worksheets/INDEX.md` |
| | *Messaging track — WS-\** | 11 / 13 (WS-07 ✅ 3/3, WS-09 ✅ 2/2, WS-12 ✅ 2/2) | pick when worst number is funnel / distribution |
| WS-01 | competitors.md anchor (Zep / Letta / LangMem) | ✅ | run 19 — §4 + threat matrix; unblocks WS-02 |
| WS-02 | memory `/vs` pages (one per run) | ✅ 3/3 | run 20 — **Zep ✅** (`/vs/zep`); run 21 — **Letta ✅** (`/vs/letta`); run 22 — **LangMem ✅** (`/vs/langmem`) — WS-02 closed |
| WS-03 | solve pages — sharpen + sibling | ✅ 2/2 | run 23 — **sharpen ✅**; run 25 — **analytical sibling ✅** (`analytical-queries-over-agent-memory`, the read-side report-over-memory wedge) |
| WS-04 | MCP tool + package + docs framing | ✅ | run 24 — three tool descriptions + `package.json` desc + `mcp.mdx` intro now lead with "analytical memory" (copy only; SK-PIVOT-003) |
| WS-05 | carousel analytics-over-memory slides | ✅ | run 26 — 2 analytics-over-memory slides (`GROUP BY category` + top-N `ORDER BY … LIMIT 5`), MCP surface; data-only `showcase-examples.ts` |
| WS-06 | Mem0 \| Zep \| Letta \| nlqdb capability matrix | ✅ | run 27 — **data ✅** (`agentMemoryMatrix.ts`, 9 honest rows + test); run 28 — **render ✅** (`AgentMemoryMatrix.astro`, four-up glyph grid, nlqdb accent column, no `<img>`) |
| WS-07 | `/agents` landing | ✅ 3/3 | run 30 — **skeleton + hero ✅**; run 31 — **matrix + moat ✅** (WS-06 matrix + typed-plan trust-boundary pipeline + FSL/BYO-key band); run 35 — **CTA + demand-signal ✅** (memory-shaped "try this query" → `agents.try_query_clicked` GLOBAL-024 → `/app/new`; Topnav `Agents` link; P2-keyed `/vs` cross-link). WS-07 closed → **unblocks E-06** |
| WS-08 | on-brand OG / social images | ✅ | run 42 — `scripts/og/gen-og.mjs` SVG→PNG generator + 5 committed `public/og/*.png` cards (`/agents` + the 4 P2 memory `/vs`); `ogImage` wired; generator stays out of `astro build` (SK-PIVOT-012) |
| WS-09 | "database, not a vector store" blog + live demo | ✅ 2/2 | run 30 — **blog draft ✅** (launch post in `distribution-queue.md`); run 41 — **live `/agents` demo ✅** — gate-honest fixture round-trip (`agent_memory` rows → English goal → compiled `GROUP BY` SQL → result table, server-rendered for AEO/no-JS per SK-PIVOT-004; "Run this query" button → `agents.demo_run_clicked` GLOBAL-024 signal; no open `/v1/ask`). WS-07 page existing cleared the #430 collision |
| WS-10 | FSL self-host messaging (GLOBAL-019 / arch §0 doc-fix shipped) | ✅ | run 28 — pricing self-host band + README "Models & plans" self-host line (FSL-accurate; no turnkey-image claim per WS-11 note) |
| WS-11 | pull `ghcr.io/nlqdb/api` self-host container forward | ⬜ | high · multi · WS-10 · infra-gated |
| WS-12 | home reweight + demote P1/P3/P4 to "also works for…" | ✅ 2/2 | run 43 band; run 44 `AlsoWorksFor` fold before CodePanel + Replaces (composition-only, nothing deleted, hero untouched) |
| WS-13 | headline reposition (hero / README / llms.txt / JSON-LD) | ⬜ | high · ~2 runs · WS-07, WS-12 · 🔒 **FOUNDER-GATED** |
| | *Engine track — E-\** | 2 / 7 | pick when worst number is engine quality / agent on-ramp |
| E-01 | `agent_memory_v1` schema preset for `db.create` | ✅ | run 29 module + run 30 wiring (SK-HDC-020): `db.create { preset: "agent_memory_v1" }` provisions the 4 tables deterministically, no LLM; gated behind `MEMORY_PRESET`. One follow-on: quality-eval ablation row (Neon-branch gated) |
| E-02 | additive MCP tool `nlqdb_remember` (no rename) | ✅ | run 31 (SK-PIVOT-008): server-built deterministic parameterised INSERT via `POST /v1/memory/remember` (never `/v1/run` — trust boundary), `wrong_preset` guard, SDK `remember()`, `nlqdb_remember` tool. Follow-ons: e2e Neon smoke (infra) + CLI `nlq remember` (Go) |
| E-03 | per-agent / end-user / thread scoping — **RLS, not query-rewriting** (SK-PIVOT-009, mechanism corrected run 32) | ⬜ | **high · security-critical** · ~2 runs · E-01 · Neon-gated |
| E-04 | TTL + cron sweep (`expires_at`) | ⬜ | low · 1 run · E-01 |
| E-05 | hybrid recall — pgvector + `nlqdb_recall` | ⬜ | high · multi · E-01 · infra-gated |
| E-06 | preset on-ramp — **authed** create surface (`MEMORY_PRESET`-gated) | ⬜ redirected | run 37 (SK-PIVOT-010): anon `/agents` CreateForm path infeasible (3 auth boundaries); blocked on `MEMORY_PRESET=1` in prod (dark) |
| E-07 | workload-analyzer rule: memory DBs → ClickHouse (Phase 3) | ⬜ | med · multi · E-01 + Phase-3 multi-engine |

## Deltas (recent runs)

- 2026-06-21 (run 44) — **Distribution: WS-12 closed — P1/P3/P4 personas
  demoted into an "also works for…" fold → home reweight complete (band run 43
  + fold run 44).** Worst number is engine (Spider 0.1852, BIRD 0.520), but the
  engine lane is dispatch-gated (both evals < 7 d, §5 forbids a back-to-back
  canonical dispatch; the §4 reasoning levers are offline-complete and a clean
  greedy-vs-SC smoke is a multi-day quota campaign, not one run) **and the one
  open PR (#457) owns the engine-lane slice** (persona-bench runner-wiring,
  `SK-QUAL-018` follow-on). So the clean non-colliding slice is the named next
  half of WS-12. New `AlsoWorksFor.astro` — a quiet divider (muted kicker +
  heading + lede, **no accent, no CTA, no JS**) inserted before `CodePanel` +
  `Replaces` in `index.astro`, so the general-purpose persona framing reads as a
  secondary fold below the agent-memory band. Composition-only; **nothing
  deleted**, hero wordmark/lede untouched (gated to WS-13). **Δ:** WS-12 🟡 1/2 →
  ✅ 2/2; messaging 10 → 11/13, pivot 12 → 13/20. **KPI:** onboarding (UX) —
  agent-builder-first home hierarchy; **none degraded** — web-only + additive,
  zero engine/chain/scorer/perf touch, BIRD 06-19 + Spider 06-17 untouched.
  astro check 0 err, 128 web tests green, biome clean, build renders the fold
  into `dist/index.html`. Artifact: "We demoted three of our four personas on
  purpose" build-in-public note queued.
- 2026-06-21 (run 43) — three slices, all merged (full detail in worksheets +
  verification log): **(a) Engine: persona-bench v0** (`SK-QUAL-018`, #456) —
  metric #8 created → `tools/eval/.../persona-bench.ts`, `saas_app` (P1) +
  `agent_memory` (P2) inline DDL+seed, 12 NL→gold-SQL pairs, gold time-stable
  (literal dates), **12/12 golds execute non-empty**; data half only ⇒ baselines
  untouched, `@nlqdb/eval` 246 → 254. **(b) Distribution: WS-12 band**
  (`AgentMemoryBand.astro` after `<Hero />`, wedge statement + WS-06 matrix
  teaser + `/agents` CTA firing `home.agents_cta_clicked`) → WS-12 🟡 1/2. **(c)
  Engine: §4 #1 DAIL-SQL retrieval T9-ablation wiring** (`SK-LLM-041` half b,
  #455) — `buildPlanSystem(goal, schema, k)` returns static `PLAN_SYSTEM`
  byte-for-byte at `k<=0` (every prod call), swaps in `k` retrieved exemplars at
  `k>0`; eval `--retrieve-exemplars k` flag; token budget 0.935× static
  (token-negative); `@nlqdb/llm` 203 → 207. #1 built end-to-end bar dispatch.
  KPI engine quality / onboarding; none degraded; BIRD 06-19 + Spider 06-17
  untouched.
- 2026-06-21 (run 42) — **three slices** (all merged; full detail in the
  verification log + worksheets): **(a) §4 #1 curated plan-exemplar pool**
  (`SK-LLM-041` half (a), `plan-exemplar-pool.ts`) — 10 hand-authored
  `{question, schema, SQL}` rows, one per `SK-QUAL-014` structural bucket;
  offline **precision@1 = 10/10**, similarity lift **+0.592** (0.833 vs 0.240,
  3.46×); staged (no prod import) ⇒ baselines untouched, EX delta next dispatch;
  `@nlqdb/llm` 198 → 203. **(b) WS-08** on-brand OG/social cards (`gen-og.mjs`
  SVG→PNG, 5 cards, generator out of `astro build`; SK-PIVOT-012) → messaging
  9 → 10/13, pivot 11 → 12/20. **(c) §4 #3 self-consistency dispatch vehicle**
  (`SK-QUAL-017`) — `self_consistency`/`sc_temperature` smoke inputs (no-emit,
  baseline-safe, allowed any time); lever now fully dispatchable, EX delta =
  greedy-vs-SC smoke gap on first N≥2 dispatch. KPI engine quality / onboarding;
  none degraded.
- 2026-06-21 (runs 40–41) — engine + distribution wave (full per-slice detail in
  the verification log + worksheets): **§4 #1** the schema-aware selector
  `selectExemplarsForSchema` (`SK-LLM-041` T23 — closed the gap where run 39's
  `maskWithSchema` had no consumer; a cross-domain twin ranks top from raw rows;
  `@nlqdb/llm` 16 → 20 few-shot cases); **§4 #3** self-consistency
  `temperature`-sampling half (run 40, `PlanRequest.temperature`, default greedy
  so `SK-LLM-024` is byte-identical) then the runner `--self-consistency N` /
  `--sc-temperature T` main-loop wiring (run 41, `SK-QUAL-017`; a `samples>=2`
  branch separate from `withExecRetry`, eval 19 → 21 then 241 → 244); and
  **WS-09 closed** — the gate-honest server-rendered live demo on `/agents`
  (rows → English goal → compiled `GROUP BY` SQL → result table; `agents.demo_run_clicked`
  GLOBAL-024 signal) → messaging 8 → 9/13, pivot 10 → 11/20. All offline /
  additive; BIRD 06-19 + Spider 06-17 untouched. KPI engine quality / onboarding;
  none degraded.
- 2026-06-21 (runs 37–39) — engine + agent-memory staging wave (all offline,
  BIRD 06-19 + Spider 06-17 untouched, no prod import; full detail in the
  verification log + worksheets): **run 39** E-04 TTL-sweep core (`SK-PIVOT-011`,
  pure `expire.ts::buildExpirySweep`+`orchestrateSweep`, `facts`-only `DELETE`,
  per-DB isolation; apps/api memory 18→25) **and** §4 #1 few-shot *pool-curation
  mask* (`SK-LLM-041`, `maskSchemaIdentifiers`/`maskWithSchema`; `@nlqdb/llm`
  186→191); **run 38** §4 #1 retrieval core (`SK-LLM-041`, `few-shot-select.ts`
  value-mask + Jaccard + top-k; 175→186); **run 37** §4 #3 self-consistency
  execution half (`SK-QUAL-017`, `executeRows`+`voteOverSamples`; 239 eval) +
  the SK-PIVOT-010 finding (E-06 anon on-ramp infeasible across 3 auth
  boundaries → authed surface). KPI engine quality / onboarding; none degraded.
- 2026-06-20 (runs 35–36) — **WS-07 closed** (`/agents` CTA + `agents.try_query_clicked` GLOBAL-024 signal → messaging 8/13, pivot 10/20) **and engine: self-consistency vote core** (`SK-QUAL-017` §4 #3 — `majorityVote` + `fingerprintRows`, deterministic ties → earliest). KPI onboarding / engine quality; none degraded.
- 2026-06-20 (runs 33–34) — **Engine: Spider external-knowledge injection** (`SK-QUAL-016`, the dropped `<name>.md` doc rides `evidence`; 13/135 `local###` handicap closed) **and** a fail-loud memory-write TTL fix (`validateRememberInput` now rejects a TTL on non-`facts` kinds, GLOBAL-012). KPI engine quality; none degraded.
- 2026-06-20 (run 32) — **Two slices:** (a) finding `SK-PIVOT-009` — E-03 compile-layer scoping infeasible (`/v1/ask` runs free-form SQL via `neonSql.unsafe`, no AST) → redirected to RLS on `app.agent_id`; (b) **E-02 parity closed: CLI `nlq remember`** (SK-CLI-018, HTTP/SDK/MCP → 4/4). No engine/chain/scorer touched.
- 2026-06-20 (runs 26–31) — agent-memory pivot + engine-staging wave (all closed,
  additive; BIRD 06-19 + Spider 06-17 untouched): **E-01** preset (`agent_memory_v1`
  DDL + create-path wiring, SK-HDC-020/PIVOT-006/007) + **E-02** `nlqdb_remember`
  write primitive (#432, SK-PIVOT-008) → engine 2/7; **WS-05/06/07/09/10** the
  pivot messaging surfaces (carousel slides, the Mem0·Zep·Letta·nlqdb matrix,
  `/agents` skeleton+hero+matrix, launch-post draft, FSL self-host copy) → pivot
  9/20, messaging 7/13; **§4 #2c date-normalisation directive FALSIFIED standalone**
  (#434, parked like #2a). Per-slice detail in the WS/E worksheets + verification log.
- 2026-06-20 (run 25) — **WS-03 closed: analytical sibling solve page
  `/solve/analytical-queries-over-agent-memory`** (messaging 4/13, pivot 4/20) —
  the read-side wedge: reports over agent memory a vector store can't run.
  Additive `SolveEntry`; baselines untouched. KPI onboarding.
- 2026-06-19/20 (runs 23–24) — agent-memory messaging wave (both closed, additive copy; no engine/chain/scorer touched; BIRD 06-19 + Spider 06-17 untouched): **WS-03 run 1/2** (run 23) sharpened `/solve/give-ai-agent-persistent-memory` to the retrieval≠analytics wedge + fixed phantom MCP tool names (real three only, SK-PIVOT-002); **WS-04** (run 24) reframed the MCP surface — three tool `description`s/`title`s + `package.json` + `mcp.mdx` lead with "analytical memory" (copy only, SK-PIVOT-003; SK-MCP-002 contract + 33 tests intact). Messaging track → 3/13, pivot → 3/20. Per-slice detail in the WS worksheets; drafts queued in `distribution-queue.md`.
- 2026-06-19/21 (runs 19–22) — agent-memory wedge launch wave (all closed, additive content; no engine/chain/scorer touched): **WS-01** anchored the Zep / Letta / LangMem cluster in `docs/competitors.md §4` (run 19, pivot 0 → 1/20); **WS-02** shipped the three memory `/vs` pages — `/vs/zep` (run 20), `/vs/letta` (run 21), `/vs/langmem` (run 22) — each one `Competitor` entry keyed on the retrieval-vs-analytics wedge (`GROUP BY`/`JOIN`/`HAVING` over memory), facts web-verified 06-19, real tool names only. WS-02 closed → messaging track 2/13, pivot 2/20. Per-slice detail in the WS worksheets + `competitors.ts` history; comparison drafts queued in `distribution-queue.md`.
- 2026-06-19 (runs 17–18) — canonical BIRD re-run flat (EX 0.522 → 0.520,
  McNemar p=0.50) ⇒ directive levers saturated; `SK-QUAL-014` then **falsified
  value-retrieval as the top lever** (`literal_only` = 0), demoting it below the
  reasoning levers. No engine change. Detail in the verification log.
- 2026-06-13/18 (runs 1–16) — day-one scorecard + engine-instrument /
  provider-resilience / deferred-lever waves (Gemini key heal + Spider re-run
  to 0.1852, join-bridge pruner T21, HAVING directive T22, `SK-QUAL-014/015`
  classifiers, `SK-LLM-038/039`, `SK-HDC-019`). Full per-run detail:
  `progress/quality-score-verification-log.md`.
