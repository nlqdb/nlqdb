# Scorecard — current state

Point-in-time tracker, regenerated each [`/daily`](../.claude/commands/daily.md)
run. Current state only — no changelog (≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md`.

**Goal ([`GLOBAL-042`](decisions/GLOBAL-042-dogfood-iteration-loop.md)):** iteration 001 — [rateme12 on nlqdb](history/dogfood-iterations/001-rateme12.md); its §6.1 readiness table is the engine work queue, KPI 1 below is the measure.

**Q1–Q5 resolved 2026-09-05 → [`GLOBAL-041`](decisions/GLOBAL-041-autonomous-dba.md):**
Phase 2 exits on Phase A alone; acquisition paused; BIRD/Spider = regression
alarm only; premium tier stays. Retired rows dropped below.

**Weekly focus (2026-09-27 →, `/weekly`; keeps the founder's 2026-09-04
KPI-1/Phase-A frame):** **`/daily` runs whose own outputs (run log,
scorecard deltas, blocked items) land in the dogfood DB through a CI job —
today 0/day, target every run** (the `GLOBAL-041` workload that opens the
formal Phase A sample, 0/200; never a generated stream — `GLOBAL-041`
rejects a synthetic workload). Why: the preview walk is saturated at 10/10
(three independent CI runs on `de56f37`), so more routing work cannot move
KPI 1; nothing commits writes, so the formal KPI stays unread.

**Worst number today (run 236, 2026-10-08) — the formal KPI-1 sample is still flat: 2 HIT / 1 MISS, 3/200 on day 12/14.** Run 235's merge wrote 2 records, both `seen_fields` (out of sample; [37721711321](https://github.com/nlqdb/nlqdb/actions/runs/37721711321)). The window cannot reach 200 in 2 days; resetting it is `/weekly`'s call.
**This run's lever (run 236) — rateme12 §5a step 3, the one data module (`GLOBAL-042`, iteration 001). Build steps 2/10 → 3/10; §4 journey actions with a `data.ts` entry 0/8 → 8/8.** `apps/rateme12/src/data.ts` exports one function per journey action, each returning `not_connected` until §5b; rows stay `Record<string, unknown>`, so no shape is pre-modelled. The app's `tsconfig.json` clears the base `@nlqdb/*` path alias: an undeclared SDK import that typechecked before now fails `bun run typecheck` (probed both ways). Review finding: bun links the workspace `packages/sdk` for any `@nlqdb/sdk` pin, aliases included, so §5b step 6 must first make the pin resolve to the registry (brief §5a step 3). **Next lever:** §5a step 4 (journeys, look-and-feel; adds the Worker `main`).
**Dogfood workload (KPI-1 instrument):** on each merge, `dogfood-write.yml` writes to three tables in `db_agent_memory_v1_3a8a72` at the CI boundary: the run record (`daily_runs`), each changed scorecard row (`scorecard_deltas`) and each new blocked-by-human bullet (`blocked_items`). Its step summary is the per-write KPI-1 verdict. **Verdicts so far: run 225 MISS (`commit_error:schema_mismatch`), run 226 HIT and run 230 HIT (`landed_widened`); every other write through run 235 was `seen_fields` (out of sample).** Window start 2026-09-27. The session still never holds the prod key.
**Top `blocked-by-human` bullet (still #1):** Fire the **Show HN launch** (117 d), gated on the formal Phase A exit (≥ 190/200 over the dogfood window): **2 HIT / 1 MISS**, so the gate stays red. Queue **depth 5**, head age 117 d.
**Dark (rule 8, reported not pulled):** engine **#8 BIRD 0.5382** (62 d) / **#9 Spider 0.2222** (69 d, async multi-window resume); rows **#2/#4/#5** stranger-dependent (N=0 until launch); row **#15** opencheck lane (remedy costs money ⇒ rule 4).
**Anti-rut (rule 7):** runs 230–233 were Phase A engine levers; runs 234–236 are iteration-build steps (scaffold → inventory → data module).
**Rule 6 — GREEN (code + deploy).** **Every workflow's latest run on `main` is GREEN** (`659c3c6`: CI, Security, Release npm, Dogfood write, docs→memory; `02531c5`: Canary, Deploy API/web/MCP/docs/elements/events-worker/coming-soon/rateme12). Run 236 (2026-10-08): step 0 found 0 open PRs, drafts included. Thursday: no `/weekly`.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel, bot-filtered** (RUM + GSC **live-pulled 09-02** this run; Users/DBs carried from 07-27 remote-D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF RUM) | **live 09-19** (09-12→09-19, unsampled — counts exact): raw 459 pl / 266 vis; real-browser floor **112 pl / 99 vis** (synthetic cut 347 pl / 167 vis = stranger-walker + CF-bot); real nlqdb landings `/blog/ephemeral-staging-persistent-registry/` (10 pl), `/`, `/blog/http-200-error-in-body/`, `/solve/find-top-n-rows-per-group/`; `rateme12.com/` 12 pl = parked-domain noise (GLOBAL-039). Referral: 3 pl / 3 refs (yandex, bing, www.bing) | cut rule: `bot=1` / `userAgentBrowser ∈ {Unknown, ChromeHeadless}` / CF-bot ⇒ real-browser is a floor |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev — live remote-D1 07-27; no channel newly live to produce a signal. **Dark** (rule 8) — moves only on launch |
| 3 | DBs total | **254** (07-27 live remote-D1) + **1 dogfood** (`db_agent_memory_v1_3a8a72`, internal) | stranger subset ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not measurable** (`SK-ONBOARD-007`). The **dogfood workload** (run 176): **100 % (10/10)** through the public MCP surface (= gate criterion 2) | target ≥ 95 %. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12; founder-owned) | share with ≥ 2 asks |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **112** content pages (`/solve` **41** + `/vs` 31 + `/blog` 40; unchanged this run — CTR lever, not a new page). Unpublished blog drafts **0** (queue drained) | leading input to rows #1–#3; `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **40**. **GSC live 09-17** (28d 08-20→09-17): **967 impr / 30 query rows, 8 clicks** (pos 21.0). CTR lane exhausted: page-1 zero-click pages already carry hand-written SERP meta; the rest is position/authority-gated (launch-gated). Paused lane (`GLOBAL-041`) | `gsc-pull.ts` + `rum-pull.ts` |
| | **Engine — `GLOBAL-041` KPIs first** (headline) then the interface KPI | | `GLOBAL-041` Phase A/B build order |
| E1 | **KPI 1 — first-insert inference rate** | **Live walk = 100 % (10/10), run 224** on deployed `de56f37` ([36212596504](https://github.com/nlqdb/nlqdb/actions/runs/36212596504) 5/5, [36212675584](https://github.com/nlqdb/nlqdb/actions/runs/36212675584) 5/5), both strict walks (a HIT needs the goal-named table). The strict walks were 7/10 on `091912f` (run 222, 17/20 counting the two pre-check walks); the `auth-shaped` → `entities` miss is closed by run 223's first-plan `newTable` hint. Preview-only over 5 fixed shapes. **Formal sample (`GLOBAL-041`): 2 HIT / 1 MISS (67 %), 3/200, day 12/14** — run 225 missed `commit_error:schema_mismatch`; run 226's fix HIT `landed_widened` on its own merge; run 230's first `scorecard_deltas` insert HIT. **Agent-side harness, column-honest: 27/27 over 9 shapes × 3 (run 230)**; production-length `dogfood-delta-real` 3/3. Only a write carrying an unseen table or field enters the sample. Executor + confirm proven live (run 214). | Phase A exit **≥ 190/200** real first-inserts in the dogfood window; proxy via `e2e-kpi1-live.yml` (dispatch); agent-side via the route-ask matrix + `RUN_EXTEND_KPI` |
| E2 | KPI 2 — evolution-without-user-action rate | **unmeasured — build the instrument** (Phase B) | detected shape changes absorbed vs error / fresh DB |
| E3 | KPI 3 — optimizer yield | **unmeasured — build the instrument** (Phase B) | proposals applied / active DB / 30 d + p95 delta |
| | **Engine — interface KPI (regression alarm only, `GLOBAL-041`/`SK-QUAL-002`)** — BIRD 07-26 · Spider 07-19 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.5382** (268/500, 07-26 canonical on `d961475`, [run 30212657876](https://github.com/nlqdb/nlqdb/actions/runs/30212657876)) — **33 d old, staleness trigger fired**, but **dark (rule 8)**: resume is async multi-window and `main` moved since the 07-27 checkpoint. #1041 (planner re-head) now merged ⇒ a fresh BIRD/Spider re-measure is a valid next-run engine lever | regression alarm only (`SK-QUAL-002`, `GLOBAL-041`) — no target, no floor |
| 9 | Spider raw EX | **0.2222** (30/135, 07-19 canonical on `04fa3d0`, **40 d old**). 07-27 re-dispatch exited **partial** (`SK-QUAL-013` budget-stop) | regression alarm only — no target. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004)) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67 % → agentic 69.33 %, 150-q smoke, 07-06, `SK-QUAL-022`) | diagnostic only (`SK-QUAL-004`); no floor |
| | **Ops** — 7d, CF Workers analytics | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | **Last incident 08-14** (`SK-LLM-046`, authed `/v1/ask` 401s ~1.5 h; fixed #992, hardened #993/#1001). No live re-pull (no CF-analytics container access) | the 07-27 "2,185/0" reading is stale |
| 13 | nlqdb-api wall-time p50 / p95 | **p50 16.4 ms / p95 1.48 s** (07-27, carried) | mcp-server p50 691.3 ms / p95 1.30 s. `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers. **Premium meter live 08-14** but $0 while no paying customer; premium chain routes free-tier / BYOLLM lanes at $0 |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.00 today** — sdk/examples/mcp last success **09-08** (30 d ago ⇒ freshness 0: [sdk #41](https://github.com/nlqdb/nlqdb/actions/runs/34240215865) / [examples #19](https://github.com/nlqdb/nlqdb/actions/runs/34240219429) / [mcp #42](https://github.com/nlqdb/nlqdb/actions/runs/34240222183)); opencheck **0** (07-17, dark — costs money, rule 4). Worst number today; not a DBA lever (step-2 lever order), so re-dispatch is only a candidate when no KPI-1 lever is pullable | Never dispatch opencheck alongside another lane consumer. Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 exit gate = `GLOBAL-041` Phase A | **Gate RED — formal sample 2 HIT / 1 MISS, 3/200 (window opened 2026-09-27, day 12/14; every seen-shape write is out of sample, and runs 231–233 wrote only seen shapes).** The proxy walk reads 100 % (10/10, run 224). The sample must reach ≥ 190/200. | ≥ 95 % first-insert inference on the dogfood workload; nothing else gates Phase 2 |
| 17 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** — swept run 166; docs-only diff. GSC still shows the `http://` variant of `/solve/count-consecutive-days-streak-in-sql/` indexed (25 impr, pos 15.6) → splits signal with the https canonical; the redirect exists but Google indexed http — the fix is a zone Redirect Rule (console click, founder territory, standing blind spot) | target 0. Standing blind spots: external inbound links to bare paths, `www.`/`http://` host un-redirected (zone Redirect Rule ⇒ console) |
| | **Product-readiness** — client-blocking gaps | | |
| 18 | Live-surface claim integrity | **1** (found run 232): `docs.nlqdb.com/sdk` and `SK-SDK-012` advertise `runSql({ dryRun })` / `nlq run --dry-run`, but neither the SDK, `/v1/run` nor the CLI implements it. The `SK-SDK-013` guard checks method names only, so it passes. Package entrypoints stay ✓ (#826, 07-29) | target 0 |
| 19 | Hosted-premium readiness (§6 build-before-signal) | **LIVE 08-14** — `premium.live=true` in prod (`premiumConfigured(env)`). schema ✅ · BYOLLM lanes ✅ · picker web ✅ + parity ✅ · CTA ✅ · **premium chain ✅ live** (#987 meter, #992 bring-back, #996 live-lane billing, #1001 free-chain fallback) · spend-cap UI ⬜ (Lago-parked) | paid plan **shipped**; §6 signal effectively tripped. Meter fires; $0 while no paying customer |
| 20 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **FLOW-005 re-walked live 2026-09-08 (run 200): 6/6 PASS** (curl-based MCP discovery + auth-wall against `mcp.nlqdb.com`, agent-runnable). **Playwright walker launch fixed run 194** — `browser.ts` now falls back to the prebuilt Chromium when the pinned revision is absent, so it launches in-container (was: download-attempt fail on the `chromium-1234` pin). Full walk still **CI-canonical** (`acquisition-health.yml`): the sandbox's proxy-stripped direct egress blackholes UDP/443 ⇒ cross-host nav intermittently `ERR_QUIC_PROTOCOL_ERROR` (~2/3 runs fail step 1), so no reliable container pass-count; carried **0 failed / 9 blocked** from 07-26. #999 (08-16) fixed the `/app/new/` 428 dead-end | target **0 `failed`** ✅; anon walks stop at the 428 `challenge_required` (Turnstile, `SK-ANON-012`) |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 21 | Channels live with attributable yield | **4 live** — organic search + dev.to + npm + GitHub. MCP official registry published 07-22; Glama crawl-listed; Smithery/PulseMCP 0. First-touch attribution live since 07-19; `source_json` non-null **0**, for want of strangers, not instrument | → ≥ 5 live. Growth comes only from not-yet-live channels (R-05 registries, human-norm venues) |
| | **Dogfood iteration** — [`GLOBAL-042`](decisions/GLOBAL-042-dogfood-iteration-loop.md) | | brief: [`001-rateme12.md`](history/dogfood-iterations/001-rateme12.md) |
| 22 | Iteration 001 build steps (§5, 10 steps) | **3/10** (run 236: §5a step 3, `data.ts` 8/8 journey actions, typecheck wired; run 235: §4 inventory 8/8 rows, §2 quarantine done). `rateme12.nlqdb.com` live (scaffold, 200). §6.1 readiness **4/4 green** | 10/10, then retro + cleanup. §5b (the KPI-1 writes) starts after §5a step 5 |
| | **Human queue** — the one non-automatable actor | **depth 5**; head = **Show HN launch** (117 d, gated on the Phase A exit ≥ 190/200 — formal sample 2 HIT / 1 MISS, preview walk 10/10 — founder can confirm the live rate from `/app/admin`); #2 email-router deploy+walk (PR #1134, human-only Worker deploy, since 09-18, 20 d); #3 Anthropic connector (money-gated, 07-21); #4 PulseMCP + mcp.directory (09-01); #5 nlqdb-memory → cc-marketplace (09-04). | [`blocked-by-human.md`](blocked-by-human.md). Open PRs at step 0: **0** (no drafts); after this run **1** (run 236) |

## Shipped distribution

**41 canonical `/solve` pages** + **40 `/blog` posts** + **31 `/vs` pages** live under `nlqdb.com/`
(`SK-SOLVE-001` / `SK-BLOG-001` / `SK-CMP-001`). The registries are `apps/web/src/data/{solve,blog,competitors}.ts`.

- **This run (236):** no distribution change; the lane is paused (`GLOBAL-041`). Earlier runs: `git log`.

## Last change

**2026-10-08 (run 236)** — **rateme12 iteration 001: §5 steps 2/10 → 3/10; `data.ts` journey actions 0/8 → 8/8.** One data module returning the honest `not_connected` state, plus `tsconfig.json` + a `typecheck` script that rejects an undeclared `@nlqdb/*` import. **GLOBAL-025 onboarding** advanced: every §4 journey now has the seam its route will call. No KPI degrades: the new code is unreachable from any deployed surface (no Worker `main` yet), and the rest of the diff is docs.

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
