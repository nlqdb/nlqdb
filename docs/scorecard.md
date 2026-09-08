# Scorecard — current state

Point-in-time tracker, regenerated each [`/daily`](../.claude/commands/daily.md)
run. Current state only — no changelog (≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md`.

**Goal ([`GLOBAL-042`](decisions/GLOBAL-042-dogfood-iteration-loop.md)):** iteration 001 — [rateme12 on nlqdb](history/dogfood-iterations/001-rateme12.md); its §6.1 readiness table is the engine work queue, KPI 1 below is the measure.

**Q1–Q5 resolved 2026-09-05 → [`GLOBAL-041`](decisions/GLOBAL-041-autonomous-dba.md):**
Phase 2 exits on Phase A alone; acquisition paused; BIRD/Spider = regression
alarm only; premium tier stays. Retired rows dropped below.

**Weekly focus (2026-09-04 →, founder-set with `GLOBAL-041`):** **Phase A
widen-on-write — first-insert inference rate** (KPI 1, floor ≥ 95 % on the
Phase A dogfood workload: `/daily`'s own writes through `@nlqdb/sdk`, first
200 unseen-field inserts in a 14-day window — dogfood DB not yet created,
window not open). Build order: `GLOBAL-041`.

**Worst number today (run 200, 2026-09-08) — WEEKLY-FOCUS KPI 1 (first-insert inference rate) reads `null` at N=0: the live instrument (run 196) has no numerator because the extend path is not yet wired into the orchestrator (build-order step 1). Run 200 is rule-7-barred from a 6th engine build, so this run pulls the UX-flow lever: re-verify the E2E customer journeys (row #15).**
The weekly focus (2026-09-04, `GLOBAL-041` Phase A) is **KPI 1** — the numerator (`asks_extend_ok`) stays 0 until the extend path absorbs a write, so the rate is blind and cannot move until step-1 routing lands (a 6th engine build, forbidden this run). Step 0: **open PRs = 0** — clean slate; branch even with `main@2a6dacb` (#1108).
**Why this lever:** rule 7 bars a 6th consecutive engine build (runs 195–199); the option "measure the engine lever's KPI-1 yield" reads `null` at N=0 (path unwired), so the productive choice is lever #2 — **real UX-flow quality**, measured by the E2E suites' pass component (row #15). That row had decayed to **0.286** (sdk 0.571 / examples 0.143 / mcp 0.429 / opencheck 0) — meaning we no longer *knew* the SDK→API and MCP→API customer journeys still worked after the run 197–199 engine merges to `@nlqdb/llm` / `@nlqdb/db` / `apps/api`. Re-dispatching the three hermetic suites is agent-runnable (`workflow_dispatch`, pulled runs 182/193) and re-verifies those journeys against the exact merges, not a clock refresh. BIRD/Spider dark (async multi-window, `main` moved); distribution paused (`GLOBAL-041`).
**Lever (this run):** re-dispatched `e2e-sdk` + `e2e-examples` + `e2e-mcp` on `main@2a6dacb` — all **✅ PASS** ([sdk #41](https://github.com/nlqdb/nlqdb/actions/runs/34240215865), [examples #19](https://github.com/nlqdb/nlqdb/actions/runs/34240219429), [mcp #42](https://github.com/nlqdb/nlqdb/actions/runs/34240222183)), freshness 1.0 each. Opencheck stays dark (costs money, rule 4). **Number moved:** row #15 E2E freshness **0.286 → 0.75** (= (1+1+1+0)/4), a `GLOBAL-025` UX/onboarding-pillar input; the run 197–199 engine merges are confirmed non-regressive on the real customer paths. Details in "Last change".
**Anti-rut (rule 7):** engine build-lever ran runs 195–199 (5 pulls) → run 200 was barred from a 6th and pulled UX-flow instead, breaking the rut. Next window may resume the engine build order (step-1 extend routing wire-in) from `GLOBAL-041` Phase A.
**P2 UX-flow green** (FLOW-005 re-walked live 2026-09-08 **6/6 PASS**; E2E row #15 0.75). BIRD/Spider dark.
**Top `blocked-by-human` bullet:** Show HN launch sequence (⏱ ~30 min, **idle 87 days since 06-13**),
condition-gated on `GLOBAL-041` Phase A. #2 Anthropic connector directory (money-gated, 07-21). Queue **depth 4**, head age 87 d.
**Dark (rule 8, reported not pulled):** dogfood criterion 3 (silent-wrong-answer, E-09/GLOBAL-037); criterion 4 (query-shape lever within ±5 pp noise); engine **#8 BIRD 0.5382** (44 d) / **#9 Spider 0.2222** (**51 d** stale, async multi-window resume); rows **#2/#4/#5/#16** stranger-dependent (N = 0 until launch); row **#15** opencheck lane only (free-lane saturation, remedy costs money ⇒ rule 4).

**Rule 6 — GREEN.** Branch even with `main@2a6dacb` (#1108, latest). **CI green on `main`** ([run 3891, success](https://github.com/nlqdb/nlqdb/actions/runs/34181049738)). Deploy workflows: **deploy-api + deploy-mcp `action_required`** on the run-199 head — 0 jobs executed, i.e. a manual environment-approval gate (founder territory, documented standing for deploy-mcp), **not a broken build**; deploy-web green (09-05, no web change since). Run 199 was additive and unwired into the hot path, so prod serving the last-approved build (run 198) is functionally current — rule 6 selects no agent-fixable lever. This run's diff is **docs-only** (scorecard), so typecheck/test are unaffected; `bun run check` on the scorecard is the gate.
Diff (docs-only, zero code): `docs/scorecard.md` — regenerated for run 200 (E2E freshness delta + header). No content drain (acquisition paused, `GLOBAL-041`). **Open PRs: 0** at step 0.

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
| | **Engine — `GLOBAL-041` KPIs first** (headline) then the interface KPI | | `GLOBAL-041` Phase A/B build order |
| E1 | **KPI 1 — first-insert inference rate** | **live instrument (run 196, `SK-SCHEMA-010`)** — `engine.firstInsertInferenceRate` = SUM(`asks_extend_ok`)/SUM(`asks_extend_ok`+`asks_extend_failed`); **null at N=0** today (numerator 0 until the extend path absorbs a write). **Path build (run 199): extend prompt + `extendSchema` router op + validated-plan builder — step 2 exec half; run 198: `WidenPlanSchema` contract — step 2 parse half; run 197: widen-DDL compiler + allow-list — steps 3–4;** extend routing wire-in (1), transaction/rewrite (5–6), trace parity + dogfood + E2E (7–9) remain | Phase A exit floor **≥ 0.95**; live on `/app/admin` |
| E2 | KPI 2 — evolution-without-user-action rate | **unmeasured — build the instrument** (Phase B) | detected shape changes absorbed vs error / fresh DB |
| E3 | KPI 3 — optimizer yield | **unmeasured — build the instrument** (Phase B) | proposals applied / active DB / 30 d + p95 delta |
| | **Engine — interface KPI (regression alarm only, `GLOBAL-041`/`SK-QUAL-002`)** — BIRD 07-26 · Spider 07-19 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.5382** (268/500, 07-26 canonical on `d961475`, [run 30212657876](https://github.com/nlqdb/nlqdb/actions/runs/30212657876)) — **33 d old, staleness trigger fired**, but **dark (rule 8)**: resume is async multi-window and `main` moved since the 07-27 checkpoint. #1041 (planner re-head) now merged ⇒ a fresh BIRD/Spider re-measure is a valid next-run engine lever | regression alarm only (`SK-QUAL-002`, `GLOBAL-041`) — no target, no floor |
| 9 | Spider raw EX | **0.2222** (30/135, 07-19 canonical on `04fa3d0`, **40 d old**). 07-27 re-dispatch exited **partial** (`SK-QUAL-013` budget-stop) | regression alarm only — no target. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004)) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67 % → agentic 69.33 %, 150-q smoke, 07-06, `SK-QUAL-022`) | diagnostic only (`SK-QUAL-004`); no floor |
| | **Ops** — 7d, CF Workers analytics | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | **08-14 authed-`/v1/ask` OUTAGE (`SK-LLM-046`):** the premium go-live's AI-Gateway auth toggle 401'd every gateway lane (`llm_failed` on authed `/v1/ask`, ~1.5 h). Fixed by **#992**; **#993** direct-provider fallback + **#1001** free-chain fallback harden the SPOF. No live re-pull (no CF-analytics container access) | row carries the incident; the 07-27 "2,185/0" reading is stale. Detection gap = a candidate next lever |
| 13 | nlqdb-api wall-time p50 / p95 | **p50 16.4 ms / p95 1.48 s** (07-27, carried) | mcp-server p50 691.3 ms / p95 1.30 s. `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers. **Premium meter live 08-14** but $0 while no paying customer; premium chain routes free-tier / BYOLLM lanes at $0 |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.286 → 0.75 (run 200's lever)** — decayed to 0.286 (sdk 0.571 / examples 0.143 / mcp 0.429, last successes 09-05/09-02/09-04); re-dispatched all three on `main@2a6dacb` this run: **sdk ✅ ([run 41](https://github.com/nlqdb/nlqdb/actions/runs/34240215865)) + examples ✅ ([run 19](https://github.com/nlqdb/nlqdb/actions/runs/34240219429)) + mcp ✅ ([run 42](https://github.com/nlqdb/nlqdb/actions/runs/34240222183))**, freshness 1.0 each; opencheck **0** (07-17, dark — costs money, rule 4). Score = mean(pass×freshness) over 4 = (1+1+1+0)/4. Re-verifies SDK→API + MCP→API journeys against the run 197–199 engine merges | Never dispatch opencheck alongside another lane consumer. Triage: `e2e-coverage/opencheck-operations.md`. Re-dispatch is a lever candidate (workflow_dispatch, agent-runnable) — pulled runs 182, 193, 200 |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 exit gate = `GLOBAL-041` Phase A | **KPI 1 blind (null at N=0)** — extend path **step 2 (both halves)+3+4 built** (run 199: extend prompt + `extendSchema` router op + validated-plan builder; run 198: `WidenPlanSchema` contract; run 197: widen-DDL compiler + allow-list); extend routing wire-in (1), transaction/rewrite (5–6), trace+dogfood+E2E (7–9) remain; dogfood DB not created, 0/200 inserts, window opens at build-order step 8 | ≥ 95 % first-insert inference on the dogfood workload; nothing else gates Phase 2 |
| 17 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** — swept run 166; docs-only diff. GSC still shows the `http://` variant of `/solve/count-consecutive-days-streak-in-sql/` indexed (25 impr, pos 15.6) → splits signal with the https canonical; the redirect exists but Google indexed http — the fix is a zone Redirect Rule (console click, founder territory, standing blind spot) | target 0. Standing blind spots: external inbound links to bare paths, `www.`/`http://` host un-redirected (zone Redirect Rule ⇒ console) |
| | **Product-readiness** — client-blocking gaps | | |
| 18 | Live-surface claim integrity | **0 ✓** (resolved 07-29): `#826` published `@nlqdb/sdk@0.2.2` + `@nlqdb/mcp@0.1.1`; a clean-dir install resolves `dist/` entrypoints | target 0 ✓ |
| 19 | Hosted-premium readiness (§6 build-before-signal) | **LIVE 08-14** — `premium.live=true` in prod (`premiumConfigured(env)`). schema ✅ · BYOLLM lanes ✅ · picker web ✅ + parity ✅ · CTA ✅ · **premium chain ✅ live** (#987 meter, #992 bring-back, #996 live-lane billing, #1001 free-chain fallback) · spend-cap UI ⬜ (Lago-parked) | paid plan **shipped**; §6 signal effectively tripped. Meter fires; $0 while no paying customer |
| 20 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **FLOW-005 re-walked live 2026-09-08 (run 200): 6/6 PASS** (curl-based MCP discovery + auth-wall against `mcp.nlqdb.com`, agent-runnable). **Playwright walker launch fixed run 194** — `browser.ts` now falls back to the prebuilt Chromium when the pinned revision is absent, so it launches in-container (was: download-attempt fail on the `chromium-1234` pin). Full walk still **CI-canonical** (`acquisition-health.yml`): the sandbox's proxy-stripped direct egress blackholes UDP/443 ⇒ cross-host nav intermittently `ERR_QUIC_PROTOCOL_ERROR` (~2/3 runs fail step 1), so no reliable container pass-count; carried **0 failed / 9 blocked** from 07-26. #999 (08-16) fixed the `/app/new/` 428 dead-end | target **0 `failed`** ✅; anon walks stop at the 428 `challenge_required` (Turnstile, `SK-ANON-012`) |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 21 | Channels live with attributable yield | **4 live** — organic search + dev.to + npm + GitHub. MCP official registry published 07-22; Glama crawl-listed; Smithery/PulseMCP 0. First-touch attribution live since 07-19; `source_json` non-null **0**, for want of strangers, not instrument | → ≥ 5 live. Growth comes only from not-yet-live channels (R-05 registries, human-norm venues) |
| | **Human queue** — the one non-automatable actor | **depth 4**; head is the Show HN launch, oldest bullet **87 days** (now gated on `GLOBAL-041` Phase A); #2 Anthropic connector directory (money-gated, 07-21); #3 PulseMCP + mcp.directory submits (09-01); #4 nlqdb-memory → cc-marketplace (09-04, paused agent-memory track) | [`blocked-by-human.md`](blocked-by-human.md). Open PRs: **0** at step 0 |

## Shipped distribution

**41 canonical `/solve` pages** + **40 `/blog` posts** + **31 `/vs` pages** live under `nlqdb.com/`
(`SK-SOLVE-001` / `SK-BLOG-001` / `SK-CMP-001`). The registries are `apps/web/src/data/{solve,blog,competitors}.ts`.

- **This run (200):** no content drain (acquisition paused, `GLOBAL-041`). **UX-flow** lever (rule-7-barred from a 6th engine build): re-dispatched the three hermetic E2E suites on `main` — sdk/examples/mcp all ✅ — row #15 freshness **0.286 → 0.75**, re-verifying the SDK→API + MCP→API customer journeys against the run 197–199 engine merges. Docs-only diff (scorecard).
- **Run 199:** extend prompt (`SCHEMA_EXTEND_SYSTEM` in `@nlqdb/llm`) + `extendSchema` router op (rides the `schema_infer` tier) + validated-plan builder (`apps/api/src/db-create/extend-schema.ts`) — `GLOBAL-041` Phase A step 2 (exec half).
- **Run 198:** `WidenPlanSchema`/`AddColumnOpSchema` typed widen-plan contract + SK-HDC-003 layer-1 validator in `@nlqdb/db` — `GLOBAL-041` Phase A step 2 (parse half).
- **Run 197:** widen-DDL compiler `db-create/compile-write-ddl.ts` + allow-list `AT_AddColumn` — `GLOBAL-041` Phase A steps 3–4 (engine lever).
- **Run 196:** drained one dev.to variant — `most-active-user-is-your-test-suite` →
  [dev.to](https://dev.to/omer_hochman/your-most-active-user-is-your-test-suite-4bbb)
  (**8 variants remain**). Weekly-focus engine lever (`SK-SCHEMA-010` KPI-1 instrument). Runs ≤ 195: `git log`.

## Last change

**2026-09-08 (run 200)** — **UX-FLOW LEVER: re-verified the E2E customer journeys — row #15 E2E freshness 0.286 → 0.75.**
Step 0: open PRs = 0, branch even with `main@2a6dacb` (#1108); CI green on `main`; deploy-api/mcp `action_required` (manual approval gate, 0 jobs ran — founder territory, not a broken build; run 199 was
additive/unwired so prod is functionally current). **Lever choice:** rule 7 bars a 6th consecutive engine build (runs 195–199 were 5 engine pulls). Its alternative — "measure the engine lever's KPI-1 yield" —
reads `null` at N=0 because the extend path is not yet wired into the orchestrator (build-order step 1), so it is not a productive lever this run. So this run pulls lever #2, **real UX-flow quality**: the E2E
suites' pass component (row #15) had decayed to **0.286** (sdk 0.571 / examples 0.143 / mcp 0.429 / opencheck 0), meaning we no longer *knew* the real customer journeys survived the run 197–199 merges to
`@nlqdb/llm` / `@nlqdb/db` / `apps/api`. **Change:** re-dispatched `e2e-sdk` + `e2e-examples` + `e2e-mcp` (`workflow_dispatch`) on `main@2a6dacb` — all three **✅ PASS** (runs 41 / 19 / 42), freshness 1.0 each;
opencheck left dark (costs money, rule 4; never co-dispatched). Also re-walked FLOW-005 live (curl MCP discovery + auth-wall against `mcp.nlqdb.com`) — **6/6 PASS**. **Number moved:** row #15 **0.286 → 0.75**
(= (1+1+1+0)/4), a named UX-flow metric; the run 197–199 engine merges are confirmed non-regressive on the SDK→API + MCP→API paths. **KPI (GLOBAL-025 — UX/onboarding pillar):** advanced; none degrade — this
run's diff is docs-only (scorecard), so `typecheck`/`test` are untouched; `bun run check` exit 0 on the changed file. **Anti-rut:** the engine build rut (195–199) is broken; the next window may resume the
extend-routing wire-in (Phase A step 1). **§6.1 readiness row:** none (this run verifies R2/R3-adjacent journeys rather than building a capability).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
