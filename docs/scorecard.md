# Scorecard — current state

Point-in-time tracker, regenerated each [`/daily`](../.claude/commands/daily.md)
run. Current state only — no changelog (≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md`.

**Weekly focus (2026-09-04 →, founder-set with `GLOBAL-041`):** **Phase A
widen-on-write — first-insert inference rate** (KPI 1: share of writes that
reference an unseen table/field and land with no user action; instrument =
two non-saturating counters on the `/v1/ask` write path, floor ≥ 95 % at
Phase A exit). Build order: [`pivot-autonomous-dba.md` §4](pivot-autonomous-dba.md).
The prior focus (agent-memory dogfood gate) is retired with the archived
prior bet; funnel / ops / E2E rows below stand.

**Worst number today (run 196, 2026-09-05) — WEEKLY-FOCUS INSTRUMENT SHIPPED: KPI 1 (first-insert inference rate) read `unmeasured — build the instrument` (the `/daily` step-1 lever candidate #1); this run built it.**
The weekly focus (2026-09-04, `GLOBAL-041` Phase A) is **KPI 1** — its instrument did not exist, so no run could show widen-on-write moving it. Step 0: **open PRs = 0** — clean slate; branch even with `main@0ded779`.
**Why this lever:** engine KPIs are lever priority #1 (founder-set 2026-09-04) and step 1 names a *missing KPI instrument* as candidate #1. BIRD/Spider dark (async multi-window, `main` moved); UX-flow rows #21/#15 green; fast distribution levers exhausted (CTR lane dead, fresh 09-04 GSC). Building KPI 1's instrument is the one lever that turns the weekly focus from blind to live.
**Lever (this run):** shipped the `SK-SCHEMA-010` two-counter instrument (`asks_extend_ok`/`asks_extend_failed`, migration 0035, `SK-GTM-011` shape). The orchestrator flags an extend-needed **write** (a write plan referencing an unobserved table — Defense A pre-flight or Defense B exec `42P01`/`3F000`) via `OrchestrateOutcome.extendNeeded`; `bumpAskCounters` folds the two deltas into the existing ask-completion UPDATE; `computeGtmMetrics` surfaces `engine.firstInsertInferenceRate` and the admin dashboard renders it. **Number moved:** KPI 1 (rows E1) **unmeasured → live** (rate null at N=0; numerator 0 until Phase A `kind=extend`, denominator now counts widen-on-write demand). Details in "Last change".
**P2 UX-flow green** (FLOW-005 6/6, carried run 184). BIRD/Spider dark.
**Top `blocked-by-human` bullet:** Show HN launch sequence (⏱ ~30 min, **idle 84 days since 06-13**),
condition-gated on `GLOBAL-041` Phase A. #2 Anthropic connector directory (money-gated, 07-21). Queue **depth 2+**, head age 84 d.
**Dark (rule 8, reported not pulled):** dogfood criterion 3 (silent-wrong-answer, E-09/GLOBAL-037); criterion 4 (query-shape lever within ±5 pp noise); engine **#8 BIRD 0.5382** (41 d) / **#9 Spider 0.2222** (**48 d** stale, async multi-window resume); rows **#2/#4/#5/#16** stranger-dependent (N = 0 until launch); row **#15** opencheck lane (free-lane saturation, remedy costs money ⇒ rule 4).

**Rule 6 — GREEN.** Branch based on `main@0ded779` (latest; #1097/#1098 GLOBAL-041 pivot merged). Health
re-measured live: **`typecheck` 0** (workspace, post-`bun install`), **`bun run check` exit 0** (biome; 53 pre-existing warnings, 0 errors), **`bun run test` exit 0** (baseline, pre-change).
Diff: migration 0035 + `extendNeeded` on the two write schema-mismatch returns + the `bumpAskCounters` fold + `gtm-metrics.ts` `engine` block + admin dashboard tile + `SK-SCHEMA-010` docs + tests, scorecard, and the dev.to queue-line drain. **Open PRs: 0** at step 0.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel, bot-filtered** (RUM + GSC **live-pulled 09-02** this run; Users/DBs carried from 07-27 remote-D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF RUM) | **live 09-04** (08-28→09-04, sampled interval ≤10 — counts are CF-scaled estimates): raw 490 pl / 290 vis; real-browser floor **60 pl / 60 vis** (genuine ≈40 after the `rateme12.com` spam cut of 20 — GLOBAL-039 residual http noise); real nlqdb landings `/solve/analyze-agent-tool-call-logs/`, `/solve/`, `docs.nlqdb.com/`, `/solve/safely-give-ai-agent-database-access/`. Referral: google 10 → `/manifesto/` | cut rule: `bot=1` / `userAgentBrowser ∈ {Unknown, ChromeHeadless}` / CF-bot ⇒ real-browser is a floor. Sampled window (7d default) — treat sub-interval buckets as noise |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev — live remote-D1 07-27; no channel newly live to produce a signal. **Dark** (rule 8) — moves only on launch |
| 3 | DBs total | **254** (07-27 live remote-D1) + **1 dogfood** (`db_agent_memory_v1_3a8a72`, internal) | stranger subset ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not measurable** (`SK-ONBOARD-007`). The **dogfood workload** (run 176): **100 % (10/10)** through the public MCP surface (= gate criterion 2) | target ≥ 95 %. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12; founder-owned) | share with ≥ 2 asks |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **112** content pages (`/solve` **41** + `/vs` 31 + `/blog` 40; unchanged this run — CTR lever, not a new page). Unpublished blog drafts **0** (queue drained) | leading input to rows #1–#3; `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **40** (dev.to drip throttled this run — 1/day guard, 10 variants remain). **GSC live 09-04** (28d 08-04→08-31): top pages **~1443 impr / 160 rows**, ~4 clicks visible (hall-of-fame 3, terms 1). **CTR lane exhausted (fresh-confirmed):** page-1 zero-click pages carry hand-written SERP meta — `count-rows-per-day…` (pos 7.1 / 56 impr, metaed run 183) + `count-consecutive-days` (pos 11.1 / 52 impr) — snippet no longer the lever; position/authority-gated. "Strengthen next" leader `/solve/` index is pos 34.8 / 92 impr = page 4 (content/authority-gated, not snippet). Referral (live 09-04): google 10. Wedge pages 6/6 indexed | `gsc-pull.ts` + `rum-pull.ts`. Page-1 zero-click CTR pool metaed-out; page-2+ authority/launch-gated |
| | **Engine — `GLOBAL-041` KPIs first** (headline) then the interface KPI | | `pivot-autonomous-dba.md` §4 build order |
| E1 | **KPI 1 — first-insert inference rate** | **live instrument (run 196, `SK-SCHEMA-010`)** — `engine.firstInsertInferenceRate` = SUM(`asks_extend_ok`)/SUM(`asks_extend_ok`+`asks_extend_failed`); **null at N=0** today (no extend-needed write recorded yet). Numerator 0 until Phase A `kind=extend` lands; denominator = writes to an unobserved table (widen-on-write demand). Was `unmeasured — build the instrument` | Phase A exit floor **≥ 0.95**; live on `/app/admin` |
| E2 | KPI 2 — evolution-without-user-action rate | **unmeasured — build the instrument** (Phase B) | detected shape changes absorbed vs error / fresh DB |
| E3 | KPI 3 — optimizer yield | **unmeasured — build the instrument** (Phase B) | proposals applied / active DB / 30 d + p95 delta |
| | **Engine — interface KPI** — BIRD 07-26 · Spider 07-19 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.5382** (268/500, 07-26 canonical on `d961475`, [run 30212657876](https://github.com/nlqdb/nlqdb/actions/runs/30212657876)) — **33 d old, staleness trigger fired**, but **dark (rule 8)**: resume is async multi-window and `main` moved since the 07-27 checkpoint. #1041 (planner re-head) now merged ⇒ a fresh BIRD/Spider re-measure is a valid next-run engine lever | target 0.65 / **Phase 2 floor 0.60** — gap 6.2 pp. Offline levers exhausted |
| 9 | Spider raw EX | **0.2222** (30/135, 07-19 canonical on `04fa3d0`, **40 d old**). 07-27 re-dispatch exited **partial** (`SK-QUAL-013` budget-stop) | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004)) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67 % → agentic 69.33 %, 150-q smoke, 07-06, `SK-QUAL-022`) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69 < the 0.80 floor (row #16) |
| | **Ops** — 7d, CF Workers analytics | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | **08-14 authed-`/v1/ask` OUTAGE (`SK-LLM-046`):** the premium go-live's AI-Gateway auth toggle 401'd every gateway lane (`llm_failed` on authed `/v1/ask`, ~1.5 h). Fixed by **#992**; **#993** direct-provider fallback + **#1001** free-chain fallback harden the SPOF. No live re-pull (no CF-analytics container access) | row carries the incident; the 07-27 "2,185/0" reading is stale. Detection gap = a candidate next lever |
| 13 | nlqdb-api wall-time p50 / p95 | **p50 16.4 ms / p95 1.48 s** (07-27, carried) | mcp-server p50 691.3 ms / p95 1.30 s. `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers. **Premium meter live 08-14** but $0 while no paying customer; premium chain routes free-tier / BYOLLM lanes at $0 |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.14 → 0.64 (this run's lever)** — sdk + examples had decayed to freshness 0 (last success 08-22, 11 d); re-dispatched both on `main@1fbd3e4` this run: **sdk ✅ ([run 33578892318](https://github.com/nlqdb/nlqdb/actions/runs/33578892318)) + examples ✅ ([run 33578894339](https://github.com/nlqdb/nlqdb/actions/runs/33578894339))**, freshness 1.0 each; **mcp ✅ 0.57** (last success 08-30, PR trigger); opencheck **0** (07-17, dark — costs money, rule 4). Score = mean(pass×freshness) over 4 = (1+1+0.57+0)/4 | Never dispatch opencheck alongside another lane consumer. Triage: `e2e-coverage/opencheck-operations.md`. Re-dispatch is a lever candidate (workflow_dispatch, agent-runnable) — pulled runs 182, 193 |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.5382); agentic-frontier ≥ 0.80 (0.693); TTFV p50 ≤ 60 s (awaits strangers); first-10 ≥ 95 % (stranger N=0); destructive-op retry (N≈0); MCP in 3+ hosts (0); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **≈11** (was ≈12 — this run resolved the `gtm-metrics` SK-GTM-008 ask-counter gap by shipping `SK-GTM-011`) | target ↓ 0 |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** — swept run 166; docs-only diff. GSC still shows the `http://` variant of `/solve/count-consecutive-days-streak-in-sql/` indexed (25 impr, pos 15.6) → splits signal with the https canonical; the redirect exists but Google indexed http — the fix is a zone Redirect Rule (console click, founder territory, standing blind spot) | target 0. Standing blind spots: external inbound links to bare paths, `www.`/`http://` host un-redirected (zone Redirect Rule ⇒ console) |
| | **Product-readiness** — client-blocking gaps | | |
| 19 | Live-surface claim integrity | **0 ✓** (resolved 07-29): `#826` published `@nlqdb/sdk@0.2.2` + `@nlqdb/mcp@0.1.1`; a clean-dir install resolves `dist/` entrypoints | target 0 ✓ |
| 20 | Hosted-premium readiness (§6 build-before-signal) | **LIVE 08-14** — `premium.live=true` in prod (`premiumConfigured(env)`). schema ✅ · BYOLLM lanes ✅ · picker web ✅ + parity ✅ · CTA ✅ · **premium chain ✅ live** (#987 meter, #992 bring-back, #996 live-lane billing, #1001 free-chain fallback) · spend-cap UI ⬜ (Lago-parked) | paid plan **shipped**; §6 signal effectively tripped. Meter fires; $0 while no paying customer |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **FLOW-005 re-walked live run 184: 6/6 PASS** (curl-based MCP discovery + auth-wall, agent-runnable). **Playwright walker launch fixed run 194** — `browser.ts` now falls back to the prebuilt Chromium when the pinned revision is absent, so it launches in-container (was: download-attempt fail on the `chromium-1234` pin). Full walk still **CI-canonical** (`acquisition-health.yml`): the sandbox's proxy-stripped direct egress blackholes UDP/443 ⇒ cross-host nav intermittently `ERR_QUIC_PROTOCOL_ERROR` (~2/3 runs fail step 1), so no reliable container pass-count; carried **0 failed / 9 blocked** from 07-26. #999 (08-16) fixed the `/app/new/` 428 dead-end | target **0 `failed`** ✅; anon walks stop at the 428 `challenge_required` (Turnstile, `SK-ANON-012`) |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 22 | Channels live with attributable yield | **4 live** — organic search + dev.to + npm + GitHub. MCP official registry published 07-22; Glama crawl-listed; Smithery/PulseMCP 0. First-touch attribution live since 07-19; `source_json` non-null **0**, for want of strangers, not instrument | → ≥ 5 live. Growth comes only from not-yet-live channels (R-05 registries, human-norm venues) |
| | **Human queue** — the one non-automatable actor | **depth 2+**; head is the Show HN launch, oldest bullet **82 days** (now gated on `GLOBAL-041` Phase A); #2 Anthropic connector directory (money-gated, 07-21); registry-submit payloads parked by `/reach` | [`blocked-by-human.md`](blocked-by-human.md). Open PRs: **0** at step 0 |

## Shipped distribution

**41 canonical `/solve` pages** + **40 `/blog` posts** + **31 `/vs` pages** live under `nlqdb.com/`
(`SK-SOLVE-001` / `SK-BLOG-001` / `SK-CMP-001`). The registries are `apps/web/src/data/{solve,blog,competitors}.ts`.

- **This run (196):** drained one dev.to variant — `most-active-user-is-your-test-suite` →
  [dev.to](https://dev.to/omer_hochman/your-most-active-user-is-your-test-suite-4bbb)
  (**8 variants remain**). No new `/blog` page (blog-draft queue empty). Weekly-focus engine lever (`SK-SCHEMA-010` KPI-1 instrument).
- **Run 195:** drained one dev.to variant — `five-fallback-models-one-provider` →
  [dev.to](https://dev.to/omer_hochman/your-five-fallback-models-are-one-point-of-failure-24jb)
  (9 remained). Weekly-focus instrument lever (`SK-GTM-011` per-surface ask counter).
- **Run 194:** drained `decided-questions-rot-in-your-decision-log` →
  [dev.to](https://dev.to/omer_hochman/an-open-question-thats-already-decided-is-worse-than-one-thats-still-open-3619)
  (10 remained). Lane-2 UX-flow instrument lever (row #21 walker launch fix).
- **Run 193:** drained `emit-metrics-where-the-distinction-is-certain` →
  [dev.to](https://dev.to/omer_hochman/your-metric-is-only-as-honest-as-the-layer-you-emit-it-from-54ma)
  (11 remained). Lane-2 UX-flow (E2E freshness) lever run.

## Last change

**2026-09-05 (run 196)** — **WEEKLY-FOCUS INSTRUMENT SHIPPED: `GLOBAL-041` KPI 1 (first-insert inference rate) read `unmeasured — build the instrument`; this run built it (`SK-SCHEMA-010`).**
Step 0: open PRs = 0, branch even with `main@0ded779`. **Lever choice:** engine KPIs are lever priority #1 (founder-set 2026-09-04) and step 1 names a *missing KPI instrument* as candidate #1 — KPI 1 is the
weekly focus and had no instrument, so no run could show widen-on-write moving it. BIRD/Spider dark (async multi-window resume, `main` moved); UX-flow rows #21/#15 green; fast distribution levers exhausted
(CTR lane dead, fresh 09-04 GSC). **Change (the `SK-GTM-011` counter shape, reused for the engine):** migration 0035 adds non-saturating `databases.asks_extend_ok` + `asks_extend_failed`. The orchestrator flags
an ask as extend-needed (`OrchestrateOutcome.extendNeeded`) when a **write** plan references an **unobserved table** — caught pre-flight (`checkSchemaTables`, Defense A) or at exec (`42P01`/`3F000`, Defense B);
set only for the write case so read schema-mismatch envelopes stay byte-identical. `index.ts` `bumpAskCounters` folds the two deltas (extend_ok on an absorbed write, extend_failed on a rejected one) into the
same fire-and-forget ask-completion UPDATE, stranger-walker-excluded. `computeGtmMetrics` sums both into an `engine` block and computes `firstInsertInferenceRate = extendOk/(extendOk+extendFailed)` (null at N=0);
`/app/admin` renders a KPI-1 tile. The numerator stays 0 until Phase A's `kind=extend` routing lands (`pivot-autonomous-dba.md` §4 steps 1-6) — the rate then climbs off its honest floor with no further
instrument change. **Verified:** `first10.test.ts` proves the extend counters split by outcome and never saturate; `orchestrate.test.ts` proves a write-to-unseen-table sets `extendNeeded` while a read stays
byte-identical; `admin-metrics.test.ts` proves `SUM` + rate (6/(6+4)=0.6) and the empty-state null. **Number moved:** KPI 1 (row E1) **unmeasured → live** — a named direct input to the weekly-focus number.
**KPI (GLOBAL-025 — engine-quality pillar = the three `GLOBAL-041` KPIs):** the headline engine KPI the weekly focus tracks is now measurable where it was blind. No KPI degrades — `typecheck` 0, `check` 0
(53 pre-existing warnings), full `test` green (api 145 in the touched files; web 588); the counters are telemetry, never load-bearing.

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
