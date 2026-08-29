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
**Weekly focus (`/weekly` 2026-08-29 — keeps the founder's 07-28 gate frame, converts the proven
proxy into gate movement):** = **dogfood gate `SK-PIVOT-016` 2/5 → ≥ 3/5, by landing the run-186/187
declared-categorical-vocabulary lever in the production per-goal-pack schema layer so criterion 4
(temporal) flips.** Why re-point: the 08-22 pick — memory-quality free-chain EX 59.26 % → ≥ 70 % — is
**MET at 79.49 %** (runs 185–188), and run 188 proved the offline eval is **noise-dominated at ±5 pp**,
so climbing it further is volume without gate-yield (`weekly-review.md` check 2). The eval work already
**found and proved** the GLOBAL-037-legal lever the dogfood
[`INDEX.md`](features/agent-memory-pivot/worksheets/dogfood/INDEX.md) criterion-4 row still calls "no
compliant agent-movable lever" (now **stale**): declared categorical vocabulary took the eval temporal
axis **2/11 → 8/11**. The only thing between that proven lever and a gate flip is landing it in the
production pack-schema layer — a real feature, agent-movable, GLOBAL-037-compliant (no founder
widening). The gate sat **frozen at 2/5 all week** while the proxy climbed 43 → 79 %; this re-point
makes the daily loop move the number the proxy exists to serve.

**Worst number today (run 189, 2026-08-29) — LANE-1 CTR LEVER PULLED (row #7): weekly focus MET, so diversify off engine.**
The weekly-focus number (memory-quality free-chain EX ≥ 70 %) is **comfortably MET at 79.49 %**, and runs **185–188 all
pulled the memory-quality engine lever** (188 net-zero/reverted, and it *proved the free-chain is noise-dominated at
±5 pp for small trims* — so the run-188 refined trim would land inside the noise floor). Rule 7 (anti-rut) + a met target
⇒ pull a **different lane**, highest first. Lane 1 (acquisition/distribution) has a real pullable lever, so it wins over
lane 2/3.
**Fresh GSC (28d, 2026-07-30 → 08-27):** **9 clicks / 827 impr / pos 23.1** (up from carried 7 / 675 / 25.1). Swept every
page-1 / page-1-adjacent `/solve` page for a snippet defect: all strict page-1 pages (`count-rows-per-day` pos 7.8,
`expire-old-agent-memory` pos 8.8) **already carry hand-written meta** (runs 183 + wedge work). The **one untouched
page-1-adjacent page with a genuine defect** is **`count-consecutive-days-streak-in-sql`** (**pos 10.8, 36 impr, 0 clicks**
— best-positioned untouched page): the auto-title keeps the `How do I…? — nlqdb` framing (59 ≤ 60, so the ` — nlqdb` brand
suffix is never stripped, spending ~8 chars on brand not a keyword) and the auto-description **clamps mid-value-prop** at
`…nlqdb compiles the…`. **Lever:** hand-wrote `metaTitle` (55 ch — `Count consecutive-day streaks in SQL — gaps and
islands`, front-loads intent + the searched pattern name) + `metaDescription` (150 ch — completes the value prop). Before →
after is a concrete change on the row-#7 CTR input; the **click delta realizes in a future GSC window** (the deferred
re-measure pattern run 183 established — that run's 2 pages are still pre-yield at 3–5 d).
**P2 UX-flow green** (FLOW-005 6/6, carried run 184). BIRD/Spider dark; memory-quality target MET, off-lever this run.
**Weekly-focus gate (don't overwrite the /weekly target mid-week):** dogfood **2/5**; memory-eval
free-chain EX **79.49 %** (current-main same-window baseline from run 188, target ≥ 70 % — **MET**, not this run's lever).
**Top `blocked-by-human` bullet:** Show HN launch sequence (⏱ ~30 min, **idle 77 days since 06-13**),
condition-gated on the `SK-PIVOT-016` gate (**2/5**). #2 Anthropic connector directory (money-gated,
07-21). Queue **depth 2**, head age 77 d (#3 Supabase OAuth bullet dropped by #1063 — paste path works).
**Dark (rule 8, reported not pulled):** dogfood gate (criterion 1 grind-only; criteria 3/4
E-09/GLOBAL-037-blocked); engine **#8 BIRD 0.5382** (33 d) / **#9 Spider 0.2222** (**40 d** stale, async
multi-window resume); rows **#2/#4/#5/#16** stranger-dependent (N = 0 until launch); row **#15** opencheck
(free-lane saturation, remedy costs money ⇒ rule 4).

**Rule 6 — GREEN.** Branch based on `main@89bfed4` (latest; #1060–#1063 merged since run 187). Health
re-measured live: **`typecheck` 0** (workspace, post-`bun install`), **`bun run check` exit 0** (858 files; 53 pre-existing
warnings on main, 0 errors) + biome clean on the changed file, **meta-length-integrity + solve data tests 22 pass / 0 fail**.
`deploy-web` + `deploy-api` latest `main` runs both **success**. Diff is one data file (`apps/web/src/data/solve.ts`, +meta on
one `/solve` entry) + this scorecard. **Open PRs: 0** at step 0.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel, bot-filtered** (RUM + GSC **carried from 08-25** — no `scripts/` pull this engine-lever run; Users/DBs carried from 07-27 remote-D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF RUM) | **live 08-29** (08-22→08-29): raw 368 pl / 333 vis; real-browser floor **97 pl / 90 vis** (genuine ≈52 after the `rateme12.com` spam cut of 38 — GLOBAL-039 residual http noise); real nlqdb landings led by `app.nlqdb.com/oauth/mcp-authorize/` (6), `nlqdb.com/` (5), `/auth/post-signin/` (4), `app.nlqdb.com/` (3), `/vs/vanna/` + `/agent-memory-benchmarks` (2 each). Referral: google 4 / accounts.google 4 | cut rule: `bot=1` / `userAgentBrowser ∈ {Unknown, ChromeHeadless}` / CF-bot ⇒ real-browser is a floor. 7d SAMPLED — sub-interval buckets are noise |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev — live remote-D1 07-27; no channel newly live to produce a signal. **Dark** (rule 8) — moves only on launch |
| 3 | DBs total | **254** (07-27 live remote-D1) + **1 dogfood** (`db_agent_memory_v1_3a8a72`, internal) | stranger subset ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not measurable** (`SK-ONBOARD-007`). The **dogfood workload** (run 176): **100 % (10/10)** through the public MCP surface (= gate criterion 2) | target ≥ 95 %. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12; founder-owned) | share with ≥ 2 asks |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **112** content pages (`/solve` **41** + `/vs` 31 + `/blog` 40; unchanged this run — CTR lever, not a new page). Unpublished blog drafts **0** (queue drained) | leading input to rows #1–#3; `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **40** + **dev.to variant drained this run** (`agent-memory-benchmarks-measure-recall-not-analysis` → [dev.to](https://dev.to/omer_hochman/we-read-the-agent-memory-benchmarks-almost-none-measure-analysis-4khi); **15 variants remain**). **GSC live 08-29** (28d 07-30→08-27): **9 clicks / 827 impr / pos 23.1** (↑ from 7/675/25.1). **This run's CTR lever:** hand-wrote SERP meta on `count-consecutive-days-streak-in-sql` (pos 10.8, 36 impr, 0 clk — auto-desc clamped mid-value-prop, auto-title kept `— nlqdb` brand suffix); all strict page-1 `/solve` pages already carry hand-written meta. GSC "Strengthen next" winners (`running-total…` pos 39.3 / 89 impr, `countif-sumif…` pos 22.6 / 68 impr) are page-3+ ⇒ position (authority-gated), not snippet. Referral (live 08-29): google 4 / accounts.google 4 | `gsc-pull.ts` + `rum-pull.ts`. Page-1 zero-click = CTR lever (agent-movable); page-2+ authority/launch-gated |
| | **Engine** — BIRD 07-26 · Spider 07-19 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.5382** (268/500, 07-26 canonical on `d961475`, [run 30212657876](https://github.com/nlqdb/nlqdb/actions/runs/30212657876)) — **33 d old, staleness trigger fired**, but **dark (rule 8)**: resume is async multi-window and `main` moved since the 07-27 checkpoint. #1041 (planner re-head) now merged ⇒ a fresh BIRD/Spider re-measure is a valid next-run engine lever | target 0.65 / **Phase 2 floor 0.60** — gap 6.2 pp. Offline levers exhausted |
| 9 | Spider raw EX | **0.2222** (30/135, 07-19 canonical on `04fa3d0`, **40 d old**). 07-27 re-dispatch exited **partial** (`SK-QUAL-013` budget-stop) | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004)) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67 % → agentic 69.33 %, 150-q smoke, 07-06, `SK-QUAL-022`) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69 < the 0.80 floor (row #16) |
| | **Ops** — 7d, CF Workers analytics | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | **08-14 authed-`/v1/ask` OUTAGE recorded (`SK-LLM-046`):** the premium go-live's AI-Gateway authenticated toggle 401'd every gateway-routed lane, returning `llm_failed` on every authed `/v1/ask` for **~1.5 h**. Fixed by **#992**; **#993** added direct-provider fallback (hardens the gateway SPOF); **#1001** free-chain fallback on premium-lane failure. No live re-pull this run (no CF-analytics container access) — the "2,185 / 0 (07-27)" reading is superseded by this incident | zero-error claim was stale; row now carries the incident. Detection gap → see "Last change" (next non-null lever candidate) |
| 13 | nlqdb-api wall-time p50 / p95 | **p50 16.4 ms / p95 1.48 s** (07-27, carried — no live re-pull) | mcp-server p50 691.3 ms / p95 1.30 s. `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers. **Premium meter live 08-14** but $0 while no paying customer; premium chain routes free-tier / BYOLLM lanes at $0 to nlqdb |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **~0.5** (run 182's lever, 08-23) — re-dispatched the 3 hermetic suites on `main@098953c`: **sdk ✅ + examples ✅ green at run 182 (freshness ~1.0 then, decaying since)**; **mcp was RED** (stale contract post-#1035 `nlqdb_read`) → **fixed** `p2_agent_tools.test.ts` (4/4 local), green on the PR trigger ⇒ ~0.75 on merge. opencheck still stale (07-17, dark — costs money, rule 4) | Never dispatch opencheck alongside another lane consumer. Triage: `e2e-coverage/opencheck-operations.md`. Re-dispatch is a lever candidate (workflow_dispatch, agent-runnable) — pulled run 182 |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.5382); agentic-frontier ≥ 0.80 (0.693); TTFV p50 ≤ 60 s (awaits strangers); first-10 ≥ 95 % (stranger N=0); destructive-op retry (N≈0); MCP in 3+ hosts (0); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **≈12** (unchanged — not this run's lever). Lane-3 meta — reported not pulled | target ↓ 0 |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** — swept run 166; docs-only diff. GSC still shows the `http://` variant of `/solve/count-consecutive-days-streak-in-sql/` indexed (25 impr, pos 15.6) → splits signal with the https canonical; the redirect exists but Google indexed http — the fix is a zone Redirect Rule (console click, founder territory, standing blind spot) | target 0. Standing blind spots: external inbound links to bare paths, `www.`/`http://` host un-redirected (zone Redirect Rule ⇒ console) |
| | **Product-readiness** — client-blocking gaps | | |
| 19 | Live-surface claim integrity | **0 ✓** (resolved 07-29): `#826` published `@nlqdb/sdk@0.2.2` + `@nlqdb/mcp@0.1.1`; a clean-dir install resolves `dist/` entrypoints | target 0 ✓ |
| 20 | Hosted-premium readiness (§6 build-before-signal) | **LIVE 08-14** — `premium.live=true` in prod (`premiumConfigured(env)`). schema ✅ · BYOLLM lanes ✅ · picker web ✅ + parity ✅ · CTA ✅ · **premium chain ✅ live** (#987 meter, #992 bring-back, #996 live-lane billing, #1001 free-chain fallback) · spend-cap UI ⬜ (Lago-parked) | paid plan **shipped**; §6 signal effectively tripped. Meter fires; $0 while no paying customer |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **FLOW-005 re-walked live run 184: 6/6 PASS** (curl-based MCP discovery + auth-wall, agent-runnable) — RFC 9728/8414 discovery green, unauth `initialize`/`tools/list` both 401 with matching `resource_metadata` challenge. Playwright walks still **not container-runnable** (Chromium pin mismatch, CI-only via `acquisition-health.yml`); those carried **0 failed / 9 blocked** from 07-26. #999 (08-16) fixed the `/app/new/` 428 dead-end | target **0 `failed`** ✅; anon walks stop at the 428 `challenge_required` (Turnstile, `SK-ANON-012`) |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 22 | Channels live with attributable yield | **4 live** — organic search + dev.to + npm + GitHub. MCP official registry published 07-22; Glama crawl-listed; Smithery/PulseMCP 0. First-touch attribution live since 07-19; `source_json` non-null **0**, for want of strangers, not instrument | **weekly focus (superseded): → ≥ 5 live.** Growth comes only from not-yet-live channels (R-05 registries, human-norm venues) |
| | **Human queue** — the one non-automatable actor | **depth 2**; head is the Show HN launch, oldest bullet **77 days** (`SK-PIVOT-016` gate **2/5**); #2 Anthropic connector directory (money-gated, 07-21). #3 Supabase OAuth bullet dropped by #1063 | [`blocked-by-human.md`](blocked-by-human.md). Open PRs: **0** at step 0 (#1060–#1063 merged since run 187) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/27 + 12 memory `/vs` pages | mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; rest Neon/infra-gated |
| | Dogfood track D-* (`SK-PIVOT-016` gate, **weekly focus**) | **3/7** (D-01 ✅, D-03 ✅, D-04 🟡, **D-06 🟡**) — gate **2/5** (criterion 2 green from D-04's 100 % first-10; **criterion 5 green on #978's deploy** — the public `/agents` `ag-dog` dashboard is live). Remaining: criterion 1 (12 → ≥100 real MCP asks, grind); criterion 3 (silent-wrong-answer axis, E-09-blocked); criterion 4 (temporal, E-09/GLOBAL-037-blocked). D-06 run 2 (staleness-CI red + demand-signal) + D-04 `NLQDB_MEMORY_DB` var still open | mirrors [`dogfood/INDEX.md`](features/agent-memory-pivot/worksheets/dogfood/INDEX.md) |
| | Memory-quality eval (`SK-QUAL-023`) | **39-q free-chain EX 79.49 % (31/39)** — current-main same-window baseline [33132370698](https://github.com/nlqdb/nlqdb/actions/runs/33132370698) (2026-08-28). Per-axis: consolidation 6/7, forgetting 6/7, temporal 9/11, retrieval 5/7, analytical 5/7. ≥ 70 % weekly target **MET, off-lever this run** (run 188's trim measured Δ −5.13 pp inside the ±5 pp free-chain noise floor → reverted; small trims are unmeasurable here). Next engine lever candidate: a full BIRD/Spider re-measure on the post-#1041 planner head (rows #8/#9) | 39 gold-verified questions, 5 axes; free-only, no baseline |

## Shipped distribution

**41 canonical `/solve` pages** + **40 `/blog` posts** + **31 `/vs` pages** live under `nlqdb.com/`
(`SK-SOLVE-001` / `SK-BLOG-001` / `SK-CMP-001`). The registries are `apps/web/src/data/{solve,blog,competitors}.ts`.

- **This run (189):** drained one dev.to variant — `agent-memory-benchmarks-measure-recall-not-analysis` →
  [dev.to](https://dev.to/omer_hochman/we-read-the-agent-memory-benchmarks-almost-none-measure-analysis-4khi)
  (**15 variants remain**). No new `/blog` page (blog-draft queue empty). CTR-lever run.
- **Run 188:** null run (engine lever measured Δ<0 → reverted); step 3 skipped (null run). 16 dev.to variants remained.
- **Run 187:** drained one dev.to variant — `one-way-internal-links-leak-yield` →
  [dev.to](https://dev.to/omer_hochman/we-shipped-18-seo-pages-and-got-1-referral-the-links-only-pointed-one-way-1e1i).

## Last change

**2026-08-29 (run 189)** — **LANE-1 CTR LEVER (row #7): hand-wrote SERP meta on the highest-impression untouched
page-1-adjacent `/solve` page. Weekly-focus number (memory-quality EX ≥ 70 %) is MET at 79.49 % and runs 185–188 all
pulled the memory-quality engine lever (188 net-zero, proving small trims sit inside the ±5 pp free-chain noise) → rule 7
anti-rut + met target ⇒ diversify to lane 1, which has a real pullable lever.**

**Number moved (row #7 surface yield / CTR):** `count-consecutive-days-streak-in-sql` — GSC **pos 10.8, 36 impr, 0 clicks**;
its auto-`<title>` kept the `How do I…? — nlqdb` framing (59 ≤ 60 so the brand suffix is never stripped) and its
auto-description clamped mid-value-prop at `…nlqdb compiles the…`. **Before → after:** shipped a hand-written `metaTitle`
(55 ch, front-loads `Count consecutive-day streaks in SQL — gaps and islands`) + `metaDescription` (150 ch, completes the
value prop). All strict page-1 `/solve` pages already carried hand-written meta, so this is the next candidate. **Click
delta realizes in a future GSC window** — the deferred CTR re-measure pattern run 183 established. Also drained one dev.to
variant (agent-memory-benchmarks; 15 remain).

**Step-1 (live):** GSC **9 clicks / 827 impr / pos 23.1** (28d, ↑ from 7/675/25.1); health GREEN (`typecheck` 0,
`bun run check` exit 0, meta-length + solve tests 22 pass; `deploy-web`/`deploy-api` both success on `main`); FLOW-005 6/6
(carried); open PRs 0. **KPI (GLOBAL-025 — distribution/UX pillar):** surface yield advanced (SERP snippet quality on a
page-1-adjacent page + 1 dev.to cross-post); no KPI degrades (docs + one data file, all guards green).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
