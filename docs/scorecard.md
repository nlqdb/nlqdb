# Scorecard — current state

Point-in-time tracker, regenerated each [`/daily`](../.claude/commands/daily.md)
run. Current state only — no changelog (≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md`.

**Weekly focus number (2026-07-28 →, founder-set, advisor session):**
**The [`SK-PIVOT-016`](features/agent-memory-pivot/decisions/SK-PIVOT-016-dogfood-launch-gate.md)
dogfood gate — criteria green: 0/5 → 5/5.**
Founder directive 2026-07-28 (advisor session): the operating focus is the **dogfood
gate** — nlqdb's own agents running a real memory workload through the public MCP
surface. Execution track:
[`agent-memory-pivot/worksheets/dogfood/INDEX.md`](features/agent-memory-pivot/worksheets/dogfood/INDEX.md)
(`D-01..D-07`), which carries the per-criterion owner. Every criterion is agent-movable;
only the founder may loosen one, and the gate is condition-gated — never dated.
**Prior focus (superseded 2026-07-28):** acquisition — channels live with attributable
yield → ≥ 5 (row #22, now 4), [`GLOBAL-038`](decisions/GLOBAL-038-gtm-pmf-instrumentation.md).
Acquisition levers stay pullable when no dogfood lever is — premium-chain work now **live**
(row #20, meter firing 08-14), so that lane is done, not one-rank-below.
**Weekly focus (`/weekly` 2026-08-22 — keeps the founder's 07-28 gate frame, re-points the
agent-movable number):** = **memory-quality eval free-chain EX 59.26 % → ≥ 70 %, driven by the
temporal axis (2/7).** Why re-point: the 08-15 pick — criterion 1, real MCP asks 12 → ≥ 100 —
proved **dark** (rule 8): it moves only on real external agents using the MCP surface, which needs
launch, which is gated on the whole gate — circular and stranger-gated, so no daily run moved it in
a week (the loop fell back to yieldless distribution breadth, checks 2/4 in `weekly-review.md`). The
memory-eval temporal axis is the **only gate-advancing lever a daily run can honestly move**: it is
the measurable proxy for gate-criteria 3 (silent-wrong-answer) + 4 (temporal), it runs **offline**
(no strangers), and its GLOBAL-037-compatible path — a separate wrong-answer judgement + declaring
categorical domains in DDL (`CHECK`/enum) so value-linking is legitimate *schema* egress — needs no
founder widening of `GLOBAL-037` (unlike raw value-sampling on the planning lane, which does).

**Worst number today (run 184, 2026-08-24) — NULL RUN:** the **weekly-focus `SK-PIVOT-016` dogfood
gate** (**2/5**) remains the worst *reported* number, but it stays **dark for lever-choice** (rule 8) —
its only agent-movable, GLOBAL-037-unblocked criterion is **criterion 1 (real MCP asks 12 → ≥100)**,
grind-only and not honestly container-movable without fabricating asks. **No P1/P2/engine lever cleared
the step-2 bar this run** — so, per rule 2, this run ships only the step-1 scorecard refresh (a valid
null outcome; busywork is not). Compact waiver (full detail in "Last change"): **P1 distribution
exhausted** — run 183 fixed the last snippet-fixable page-1 pages; remaining GSC "Strengthen next"
winners (`running-total…` pos 37.9, `find-rows-with-no-match…` pos 19.9) verified content-complete +
authority-gated; canonical/JSON-LD/utm all present. **P2 UX-flow green** — FLOW-005 re-run 6/6 (row #21).
**Engine (weekly focus) sequenced after #1041** — memory-eval temporal is design-heavy + async-measured
and overlaps #1041's planner re-head (`zai-glm-4.7`→Qwen; the old head is 404-dead in prod), so a
re-measure on current `main` would score soon-obsolete dead-head state. BIRD/Spider dark.
**Weekly-focus gate (don't overwrite the /weekly-set target mid-week):** dogfood **2/5**; memory-eval
free-chain EX **59.26 %** (target ≥ 70 %, temporal 2/7 — 26 d stale, refresh gated on #1041 per above).
**Top `blocked-by-human` bullet:** fire the Show HN launch sequence (⏱ ~30 min,
**idle 72 days since 06-13**), still condition-gated on the `SK-PIVOT-016` gate (now **2/5**).
#2 = Anthropic **connector directory** (money-gated, since 07-21). #3 = Supabase OAuth app +
prod secrets (⏱ ~15 min, since 08-13; paste path works meanwhile). Queue **depth 3**, head age
72 d is the real cycle time.
**Dark (rule 8, reported not pulled):** dogfood gate (criterion 1 grind-only; criteria 3/4
E-09/GLOBAL-037-blocked); engine **#8 BIRD 0.5382** (29 d) / **#9 Spider 0.2222**
(**36 d** stale — resume deferred: async multi-window, `main` moved since the 07-27 checkpoint);
rows **#2/#4/#5/#16** stranger-dependent (N = 0 until launch); row **#15** opencheck lane only
(free-lane saturation, remedy costs money ⇒ rule 4).

**Rule 6 — GREEN.** Branch based on `main@5b36e83` (latest; main moved only by docs-only PRs #1043/#1044
since run 183). Health re-measured live this run: **`typecheck` exit 0** (all packages), **`bun run
check` exit 0** (CI gate; 53 pre-existing script-`console.log` warnings, none in this diff), **`bun run
test` 1381 pass / 20 skip (exit 0)**. **All four deploys green on latest code `main`**: deploy-api
(`ac0534a`), deploy-docs / deploy-mcp (`098953c`), deploy-events-worker (`715c944`) — all success
(docs-only PRs are path-filtered out of the deploys). This run's diff: **this scorecard only** (null
run). **Open PRs: 1** at step 0 — **#1041** (engine/LLM planner-head re-head, touches `packages/llm/**`,
`tools/eval/src/lanes.ts`, `apps/api/src/llm-router.ts`, `docs/features/llm-router/**`,
`quality-score-source-of-truth.md`, `docs/architecture.md`). No file overlap with this run (scorecard
only).

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel, bot-filtered** (RUM + GSC **re-pulled live 08-24** (`rum-pull.ts` 7d SAMPLED; `gsc-pull.ts` 28d — barely moves day-to-day). Users/DBs carried from 07-27 remote-D1 — no container access to remote D1 this run, no channel newly live) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF RUM) | **308 pl / 295 vis** raw, **real-browser floor 63 pl / 51 vis** (re-pulled live 08-24; 245 synthetic cut). Of the floor, **`rateme12.com/` (18 pl) is RUM referrer-spam noise** (unrelated domain) ⇒ genuine nlqdb floor ≈ 45 pl. Real nlqdb landings: `app.nlqdb.com/` (7), `nlqdb.com/` (7), `nlqdb.com/security/hall-of-fame/` (3), plus 1 pl each across 8 `/solve` pages incl. both run-183 optimized (`count-rows-per-day`, `pivot-rows-into-columns`) | cut rule: `bot=1` or `userAgentBrowser ∈ {Unknown, ChromeHeadless}` or CF-classified bot ⇒ real-browser is a floor. Read at **7d**, SAMPLED (interval up to 2) — treat sub-interval buckets as noise |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev — live remote-D1 07-27; no channel newly live to produce a signal. **Dark** (rule 8) — moves only on launch |
| 3 | DBs total | **254** (07-27 live remote-D1) + **1 dogfood** (`db_agent_memory_v1_3a8a72`, internal) | stranger subset ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not measurable** (`SK-ONBOARD-007`). The **dogfood workload** (run 176): **100 % (10/10)** through the public MCP surface (= gate criterion 2) | target ≥ 95 %. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12; founder-owned) | share with ≥ 2 asks |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **112** content pages (`/solve` **41** + `/vs` 31 + `/blog` 40; unchanged this run — no new page, distribution on-page exhausted for a single run). Unpublished blog drafts **0** (queue drained) | leading input to rows #1–#3; `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **40** (no `/blog` publish — null run skips step 3; queue empty). **GSC re-pulled live 08-24** (28d): **7 clicks / 662 impr / pos 24.5** (950 impr across 141 pages). Run-183 CTR fixes holding (SEO-lagging, still 0 clicks as expected): `count-rows-per-day` **pos 8.6, 56 impr**; `pivot-rows-into-columns` **pos 12.8, 21 impr**. **No new snippet lever this run** — "Strengthen next" winnable pages are authority-gated: `running-total…` (106 impr, pos 37.9, page-4) + `find-rows-with-no-match…` (52 impr, pos 19.9, page-2) both verified content-complete; `/integrations/` (pos 8.8, 16 impr) already has hand-written non-truncated meta. **Referral yield (RUM 08-24):** 6 pl / 3 referrers (google 5, bing 1); real nlqdb referral landings = `www.google.com`→`hall-of-fame` + `→/solve/store-query-chatbot-conversation-history/` (bing→rateme12.com is spam noise) | `gsc-pull.ts` + `rum-pull.ts`. Page-1 zero-click pages are a CTR lever (snippet, agent-movable); page-2+ ranks are authority/launch-gated |
| | **Engine** — BIRD 07-26 · Spider 07-19 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.5382** (268/500, 07-26 canonical on `d961475`, [run 30212657876](https://github.com/nlqdb/nlqdb/actions/runs/30212657876)) — **29 d old, staleness trigger fired**, but **dark (rule 8)**: resume is async multi-window and `main` moved since the 07-27 checkpoint; also gated on #1041's planner re-head landing first | target 0.65 / **Phase 2 floor 0.60** — gap 6.2 pp. Offline levers exhausted |
| 9 | Spider raw EX | **0.2222** (30/135, 07-19 canonical on `04fa3d0`, **36 d old**). 07-27 re-dispatch exited **partial** (`SK-QUAL-013` budget-stop) | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004)) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67 % → agentic 69.33 %, 150-q smoke, 07-06, `SK-QUAL-022`) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69 < the 0.80 floor (row #16) |
| | **Ops** — 7d, CF Workers analytics | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | **08-14 authed-`/v1/ask` OUTAGE recorded (`SK-LLM-046`):** the premium go-live's AI-Gateway authenticated toggle 401'd every gateway-routed lane, returning `llm_failed` on every authed `/v1/ask` for **~1.5 h**. Fixed by **#992**; **#993** added direct-provider fallback (hardens the gateway SPOF); **#1001** free-chain fallback on premium-lane failure. No live re-pull this run (no CF-analytics container access) — the "2,185 / 0 (07-27)" reading is superseded by this incident | zero-error claim was stale; row now carries the incident. Detection gap → see "Last change" (next non-null lever candidate) |
| 13 | nlqdb-api wall-time p50 / p95 | **p50 16.4 ms / p95 1.48 s** (07-27, carried — no live re-pull) | mcp-server p50 691.3 ms / p95 1.30 s. `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers. **Premium meter live 08-14** but $0 while no paying customer; premium chain routes free-tier / BYOLLM lanes at $0 to nlqdb |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **~0.5** (this run's lever) — re-dispatched the 3 hermetic suites on `main@098953c`: **sdk ✅ + examples ✅ green today (freshness ~1.0)**; **mcp was RED** (stale contract post-#1035 `nlqdb_read`) → **fixed** `p2_agent_tools.test.ts` (4/4 local), green on the PR trigger ⇒ ~0.75 on merge. opencheck still stale (07-17, dark — costs money, rule 4) | Never dispatch opencheck alongside another lane consumer. Triage: `e2e-coverage/opencheck-operations.md`. Re-dispatch is a lever candidate (workflow_dispatch, agent-runnable) — pulled this run |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.5382); agentic-frontier ≥ 0.80 (0.693); TTFV p50 ≤ 60 s (awaits strangers); first-10 ≥ 95 % (stranger N=0); destructive-op retry (N≈0); MCP in 3+ hosts (0); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **≈12** (unchanged — not this run's lever). Lane-3 meta — reported not pulled | target ↓ 0 |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** — swept run 166; docs-only diff. GSC still shows the `http://` variant of `/solve/count-consecutive-days-streak-in-sql/` indexed (25 impr, pos 15.6) → splits signal with the https canonical; the redirect exists but Google indexed http — the fix is a zone Redirect Rule (console click, founder territory, standing blind spot) | target 0. Standing blind spots: external inbound links to bare paths, `www.`/`http://` host un-redirected (zone Redirect Rule ⇒ console) |
| | **Product-readiness** — client-blocking gaps | | |
| 19 | Live-surface claim integrity | **0 ✓** (resolved 07-29): `#826` published `@nlqdb/sdk@0.2.2` + `@nlqdb/mcp@0.1.1`; a clean-dir install resolves `dist/` entrypoints | target 0 ✓ |
| 20 | Hosted-premium readiness (§6 build-before-signal) | **LIVE 08-14** — `premium.live=true` in prod (`premiumConfigured(env)`). schema ✅ · BYOLLM lanes ✅ · picker web ✅ + parity ✅ · CTA ✅ · **premium chain ✅ live** (#987 meter, #992 bring-back, #996 live-lane billing, #1001 free-chain fallback) · spend-cap UI ⬜ (Lago-parked) | paid plan **shipped**; §6 signal effectively tripped. Meter fires; $0 while no paying customer |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **FLOW-005 re-walked live this run: 6/6 PASS** (curl-based MCP discovery + auth-wall, agent-runnable) — RFC 9728/8414 discovery green, unauth `initialize`/`tools/list` both 401 with matching `resource_metadata` challenge. Playwright walks still **not container-runnable** (Chromium pin mismatch, CI-only via `acquisition-health.yml`); those carried **0 failed / 9 blocked** from 07-26. #999 (08-16) fixed the `/app/new/` 428 dead-end | target **0 `failed`** ✅; anon walks stop at the 428 `challenge_required` (Turnstile, `SK-ANON-012`) |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 22 | Channels live with attributable yield | **4 live** — organic search + dev.to + npm + GitHub. MCP official registry published 07-22; Glama crawl-listed; Smithery/PulseMCP 0. First-touch attribution live since 07-19; `source_json` non-null **0**, for want of strangers, not instrument | **weekly focus (superseded): → ≥ 5 live.** Growth comes only from not-yet-live channels (R-05 registries, human-norm venues) |
| | **Human queue** — the one non-automatable actor | **depth 3**; head is the Show HN launch, oldest bullet **72 days** (`SK-PIVOT-016` gate **2/5**); #2 Anthropic connector directory (money-gated, 07-21); #3 Supabase OAuth app + secrets (08-13) | [`blocked-by-human.md`](blocked-by-human.md). Open PRs: **1** at step 0 (#1041, engine/LLM), oldest open-PR age **2 d** |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/27 + 12 memory `/vs` pages | mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; rest Neon/infra-gated |
| | Dogfood track D-* (`SK-PIVOT-016` gate, **weekly focus**) | **3/7** (D-01 ✅, D-03 ✅, D-04 🟡, **D-06 🟡**) — gate **2/5** (criterion 2 green from D-04's 100 % first-10; **criterion 5 green on #978's deploy** — the public `/agents` `ag-dog` dashboard is live). Remaining: criterion 1 (12 → ≥100 real MCP asks, grind); criterion 3 (silent-wrong-answer axis, E-09-blocked); criterion 4 (temporal, E-09/GLOBAL-037-blocked). D-06 run 2 (staleness-CI red + demand-signal) + D-04 `NLQDB_MEMORY_DB` var still open | mirrors [`dogfood/INDEX.md`](features/agent-memory-pivot/worksheets/dogfood/INDEX.md) |
| | Memory-quality eval (`SK-QUAL-023`) | **27-q free-chain EX 59.26 % (16/27)** — run 30413719690 (2026-07-29). Temporal 2/7 (synthetic 2/3, ops 0/4) — the weak axis gating criterion 4, E-09/GLOBAL-037-blocked | 27 gold-verified questions, 5 axes; free-only, no baseline |

## Shipped distribution

**41 canonical `/solve` pages** + **40 `/blog` posts** + **31 `/vs` pages** live under `nlqdb.com/`
(`SK-SOLVE-001` / `SK-BLOG-001` / `SK-CMP-001`). The registries are `apps/web/src/data/{solve,blog,competitors}.ts`.

- **This run (184):** **null run** — no new page, no publish (step 3 skipped). Step-1 refresh only.
- **Run 183:** CTR lever — hand-written `metaTitle`/`metaDescription` for the two page-1 zero-click
  `/solve` pages (`count-rows-per-day` pos 8.6, `pivot-rows-into-columns` pos 12.8).
- **Run 182:** re-dispatched the hermetic E2E suites (row #15) — caught + fixed `e2e-mcp` red on `main`.

## Last change

**2026-08-24 (run 184)** — **NULL RUN. No P1/P2/engine lever cleared the step-2 bar; ships only the
step-1 scorecard refresh (rule 2 valid null outcome). Finding recorded in place of a delta.**

**Finding (why no lever was pullable — the step-2 waiver):**
- **P1 acquisition/distribution — genuinely exhausted for a single run.** Fresh GSC (28d, live):
  7 clicks / 662 impr / pos 24.5. Run 183 already fixed the only two page-1 zero-click *snippet-fixable*
  pages; their CTR is SEO-lagging (still 0 clicks, expected — snippets change first, clicks weeks
  later). The GSC "Strengthen next" winnable list is now **authority-gated, not snippet-gated**:
  `running-total…` (106 impr, pos 37.9), `find-rows-with-no-match…` (52 impr, pos 19.9) — both read this
  run and verified **content-complete** (rich painContext + 6 FAQs + 3 sources), so no agent-movable
  content lever; page-2/page-4 depth means CTR-meta wouldn't convert. `/integrations/` (pos 8.8, 16
  impr) already carries hand-written, non-truncated meta. Canonical (self-referential https),
  FAQ/HowTo/Breadcrumb JSON-LD, and npm/README/MCP utm-attribution are all present and test-guarded.
  New channels are founder/`/reach`-gated.
- **P2 UX-flow — green.** FLOW-005 walker re-run live: **6/6 PASS** (row #21). Known stranger-path
  dead-ends already fixed (#1037/#1036/#1029). Playwright walks are CI-only from a container.
- **Engine (weekly focus) — best sequenced after #1041.** The memory-eval temporal-axis lever is a
  design-heavy engine change (DDL categorical domains + separate wrong-answer judgement), async-measured
  via a `quality-eval-memory` dispatch, and overlaps the engine lane owned by open PR **#1041** (which
  re-heads the strict-$0 planner from the 404-dead `zai-glm-4.7` to Qwen3.6-27B). Re-measuring memory-eval
  on current `main` would score the dead-head fallback state #1041 replaces. Honest sequence: #1041
  merges → re-measure. BIRD/Spider dark (29 d / 36 d, same #1041 dependency).

**Step-1 measurements refreshed (live this run):**
- **Main health GREEN** — `typecheck` 0, `bun run check` 0, `bun run test` 1381 pass / 20 skip (exit 0);
  all four `deploy-*` workflows green on their latest code SHAs. No red-main lever (rule 6).
- **RUM (row #1)** — 308 pl / 295 vis raw; real-browser floor 63/51 (245 synthetic cut); genuine nlqdb
  floor ≈ 45 (18-pl `rateme12.com` is referrer-spam noise).
- **GSC (row #7)** — 7 clicks / 662 impr / pos 24.5 (28d).
- **FLOW-005 (row #21)** — 6/6 PASS.
- **Open PRs** — 1 (#1041, engine/LLM), oldest 2 d. No overlap with this run (scorecard only).
- Step 3 skipped (null run): no `/blog` publish (queue empty), no dev.to drain.

**Anti-rut (rule 7):** recent daily levers — CTR (183), UX-flow (182), distribution-page (181/180/179),
null (178). Last run was a real lever, not a null → the four-nulls proposal rule does not fire.

**KPI (GLOBAL-025):** no code change ⇒ advances no pillar and **degrades none** (scorecard-only diff).
This is a measurement run, not a build.

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
