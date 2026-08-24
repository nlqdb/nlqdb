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

**Worst number today (run 183, 2026-08-23):** the **weekly-focus `SK-PIVOT-016` dogfood gate**
(**2/5**) remains the worst *reported* number, but it stays **dark for lever-choice** (rule 8) — its
only agent-movable, GLOBAL-037-unblocked criterion is **criterion 1 (real MCP asks 12 → ≥100)**,
grind-only and not honestly container-movable without fabricating asks. This run pulled the **priority-1
acquisition/distribution-yield lever** — but a *CTR* lever, not "add another page" (runs 179/180/181
already added pages; on-page authoring is exhausted). Fresh GSC (28d) surfaced the sharper signal:
`/solve/count-rows-per-day-including-missing-dates/` ranks **page-1 at pos 8.6 with 57 impr and 0
clicks**, and `/solve/pivot-rows-into-columns/` at **pos 12.8, 21 impr, 0 clicks** — both lacked
hand-written SERP meta, so `lib/meta.ts` auto-clamped their titles to a fragment that **truncated the
differentiating keyword** ("…including days with…" cut "zero rows"; "…without writing a…" cut "crosstab
query") and clipped the description mid-sentence. Wrote hand-tuned `metaTitle`/`metaDescription` for
both (the exact remedy `lib/meta.ts` documents for high-value pages), so the SERP snippet now leads with
the query keyword and a complete pitch. Number moved: **row #7 surface-yield CTR-readiness** — 2 page-1
zero-click pages go from truncated to keyword-forward snippets (before/after measured on rendered
`<title>`/`<meta>`; CTR shows in GSC over the coming weeks, all SEO lagging). Delta in "Last change".
The top-impression `/solve/running-total…` (**106 impr, pos 37**) stays untouched: verified
content-complete + inbound-linked and at page-4 depth CTR is ~0 regardless — authority-gated, not
snippet-gated.
**Weekly-focus gate (don't overwrite the /weekly-set target mid-week):** dogfood **2/5**.
**Top `blocked-by-human` bullet:** fire the Show HN launch sequence (⏱ ~30 min,
**idle 71 days since 06-13**), still condition-gated on the `SK-PIVOT-016` gate (now **2/5**).
#2 = Anthropic **connector directory** (money-gated, since 07-21). #3 = Supabase OAuth app +
prod secrets (⏱ ~15 min, since 08-13; paste path works meanwhile). Queue **depth 3**, head age
71 d is the real cycle time.
**Dark (rule 8, reported not pulled):** dogfood gate (criterion 1 grind-only; criteria 3/4
E-09/GLOBAL-037-blocked); engine **#8 BIRD 0.5382** (25 d) / **#9 Spider 0.2222**
(**34 d** stale — resume deferred: async multi-window, `main` moved since the 07-27 checkpoint);
rows **#2/#4/#5/#16** stranger-dependent (N = 0 until launch); row **#15** opencheck lane only
(free-lane saturation, remedy costs money ⇒ rule 4).

**Rule 6 — GREEN.** Branch based on `main@b0bfb75` (latest; main moved only by the docs-only weekly PR
#1040 since run 182). Health re-measured live: **`typecheck` exit 0** (all packages), **`bun run check`
exit 0** (CI gate; 53 pre-existing script-`console.log` warnings, none in this diff). **All four deploys
green on latest code `main`**: deploy-api / deploy-docs / deploy-mcp (`098953c`), deploy-events-worker
(`715c944`) — all success (the weekly docs PR is path-filtered out of the deploys, so `098953c` is the
current deployed code). This run's diff: `apps/web/src/data/solve.ts` (2 hand-written SERP-meta
overrides + comments) and this scorecard. **Open PRs: 1** at step 0 — **#1041** (engine/LLM planner-head
re-head, touches `packages/llm/**`, `tools/eval/**`, `docs/features/llm-router/**`,
`quality-score-source-of-truth.md`). This run's diff has **no file overlap** with #1041 (web-data only).

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel, bot-filtered** (RUM + GSC **re-pulled live 08-22** (`rum-pull.ts` 7d SAMPLED; `gsc-pull.ts` 28d — barely moves day-to-day). Users/DBs carried from 07-27 remote-D1 — no container access to remote D1 this run, no channel newly live) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF RUM) | **280 pl / 270 vis** raw, **real-browser floor 50 pl / 50 vis** (re-pulled live 08-23; 230 synthetic cut). Real-browser landings: `nlqdb.com/` (**20**), `app.nlqdb.com/` (10), `nlqdb.com/solve/pivot-rows-into-columns/` (10 — one of this run's optimized pages), `nlqdb.com/pricing/` (10). (`rateme12.com` referral = RUM referrer-spam noise, unrelated domain.) | cut rule: `bot=1` or `userAgentBrowser ∈ {Unknown, ChromeHeadless}` or CF-classified bot ⇒ real-browser is a floor. Read at **7d**, SAMPLED (interval up to 10) — treat sub-interval buckets as noise |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev — live remote-D1 07-27; no channel newly live to produce a signal. **Dark** (rule 8) — moves only on launch |
| 3 | DBs total | **254** (07-27 live remote-D1) + **1 dogfood** (`db_agent_memory_v1_3a8a72`, internal) | stranger subset ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not measurable** (`SK-ONBOARD-007`). The **dogfood workload** (run 176): **100 % (10/10)** through the public MCP surface (= gate criterion 2) | target ≥ 95 %. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12; founder-owned) | share with ≥ 2 asks |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **112** content pages (`/solve` **41** + `/vs` 31 + `/blog` 40; unchanged this run — no new page, distribution on-page exhausted for a single run). Unpublished blog drafts **0** (queue drained) | leading input to rows #1–#3; `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **40** (no `/blog` publish — queue empty). **GSC re-pulled live 08-23** (28d): **7 clicks / 659 impr / pos 24.1** (949 impr across 143 pages). **This run's CTR lever:** the two page-1/near-page-1 zero-click pages — `/solve/count-rows-per-day-including-missing-dates/` (**pos 8.6, 57 impr, 0 clicks**) and `/solve/pivot-rows-into-columns/` (**pos 12.8, 21 impr, 0 clicks**) — shipped auto-clamped SERP titles that truncated their key phrase; now carry hand-written `metaTitle`/`metaDescription` (keyword-forward, complete pitch). Top-impression `/solve/running-total…` **106 impr / pos 37 / 0 clicks** left untouched (content-complete; page-4 CTR ~0, authority-gated). **Referral yield (RUM 08-23):** real referral ≈ 0 (the one bing.com→rateme12.com row is referrer-spam noise) | `gsc-pull.ts` + `rum-pull.ts`. Page-1 zero-click pages are a CTR lever (snippet, agent-movable); low ranks are authority/launch-gated |
| | **Engine** — BIRD 07-26 · Spider 07-19 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.5382** (268/500, 07-26 canonical on `d961475`, [run 30212657876](https://github.com/nlqdb/nlqdb/actions/runs/30212657876)) — **22 d old, staleness trigger fired**, but **dark (rule 8)**: resume is async multi-window and `main` moved since the 07-27 checkpoint | target 0.65 / **Phase 2 floor 0.60** — gap 6.2 pp. Offline levers exhausted |
| 9 | Spider raw EX | **0.2222** (30/135, 07-19 canonical on `04fa3d0`, **29 d old**). 07-27 re-dispatch exited **partial** (`SK-QUAL-013` budget-stop) | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is source of truth |
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
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **0 failed / 9 blocked** — carried from 07-26; **not re-walkable from a `/daily` container** (Playwright pins Chromium 1223, image ships 1194 → walker aborts). CI-only via `acquisition-health.yml`. #999 (08-16) fixed the `/app/new/` 428 dead-end | target **0 `failed`** ✅; anon walks stop at the 428 `challenge_required` (Turnstile, `SK-ANON-012`) |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 22 | Channels live with attributable yield | **4 live** — organic search + dev.to + npm + GitHub. MCP official registry published 07-22; Glama crawl-listed; Smithery/PulseMCP 0. First-touch attribution live since 07-19; `source_json` non-null **0**, for want of strangers, not instrument | **weekly focus (superseded): → ≥ 5 live.** Growth comes only from not-yet-live channels (R-05 registries, human-norm venues) |
| | **Human queue** — the one non-automatable actor | **depth 3**; head is the Show HN launch, oldest bullet **71 days** (`SK-PIVOT-016` gate **2/5**); #2 Anthropic connector directory (money-gated, 07-21); #3 Supabase OAuth app + secrets (08-13) | [`blocked-by-human.md`](blocked-by-human.md). Open PRs: **1** at step 0 (#1041, engine/LLM) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/27 + 12 memory `/vs` pages | mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; rest Neon/infra-gated |
| | Dogfood track D-* (`SK-PIVOT-016` gate, **weekly focus**) | **3/7** (D-01 ✅, D-03 ✅, D-04 🟡, **D-06 🟡**) — gate **2/5** (criterion 2 green from D-04's 100 % first-10; **criterion 5 green on #978's deploy** — the public `/agents` `ag-dog` dashboard is live). Remaining: criterion 1 (12 → ≥100 real MCP asks, grind); criterion 3 (silent-wrong-answer axis, E-09-blocked); criterion 4 (temporal, E-09/GLOBAL-037-blocked). D-06 run 2 (staleness-CI red + demand-signal) + D-04 `NLQDB_MEMORY_DB` var still open | mirrors [`dogfood/INDEX.md`](features/agent-memory-pivot/worksheets/dogfood/INDEX.md) |
| | Memory-quality eval (`SK-QUAL-023`) | **27-q free-chain EX 59.26 % (16/27)** — run 30413719690 (2026-07-29). Temporal 2/7 (synthetic 2/3, ops 0/4) — the weak axis gating criterion 4, E-09/GLOBAL-037-blocked | 27 gold-verified questions, 5 axes; free-only, no baseline |

## Shipped distribution

**41 canonical `/solve` pages** + **40 `/blog` posts** + **31 `/vs` pages** live under `nlqdb.com/`
(`SK-SOLVE-001` / `SK-BLOG-001` / `SK-CMP-001`). The registries are `apps/web/src/data/{solve,blog,competitors}.ts`.

- **This run (183):** no new page — a **CTR lever** instead: hand-written `metaTitle`/`metaDescription`
  for the two page-1/near-page-1 zero-click `/solve` pages (`count-rows-per-day-including-missing-dates`
  pos 8.6, `pivot-rows-into-columns` pos 12.8) whose auto-clamped titles truncated the key phrase.
  dev.to drain: drip-guarded (last post 5.1 h ago) — expected no-op, no queue edit.
- **Run 182:** re-dispatched the hermetic E2E suites (row #15) — caught + fixed `e2e-mcp` red on `main`.

## Last change

**2026-08-23 (run 183)** — **Acquisition/distribution CTR lever (P1): hand-wrote SERP
`metaTitle`/`metaDescription` for the two page-1/near-page-1 zero-click `/solve` pages whose
auto-clamped titles truncated the differentiating keyword. Number moved: row #7 surface-yield
CTR-readiness — 2 pages go from truncated-fragment snippets to keyword-forward, complete-pitch
snippets.**

**Delta (measured, rendered `<title>`/`<meta>` before/after via `lib/meta.ts` over live data):**
- `/solve/count-rows-per-day-including-missing-dates/` (GSC pos **8.6**, 57 impr, **0 clicks** — top
  page-1 zero-click page): TITLE `"How do I count rows per day in SQL, including days with…"`
  (truncated, cut "zero rows") → `"Count rows per day in SQL, including zero-row days"` (50 chars);
  DESC clipped mid-sentence → complete 153-char pitch with CTA.
- `/solve/pivot-rows-into-columns/` (GSC pos **12.8**, 21 impr, 0 clicks): TITLE
  `"How do I pivot rows into columns in SQL without writing a…"` (cut "crosstab query") →
  `"Pivot rows into columns in SQL — no crosstab query"` (50); DESC clipped → complete 154-char pitch.
- Both fit the guard bounds (title 30–60, desc 110–155); `meta-length-integrity.test.ts` **4/4 pass**.
  This is the exact remedy `lib/meta.ts` documents ("worth writing by hand on the highest-value pages").
- Step 1 fresh: RUM (row #1) real-browser floor 60/48 → **50/50** (one real landing was
  `/solve/pivot-rows-into-columns/`); GSC (row #7) **7 clicks / 659 impr / pos 24.1** (28d).
- Step 3: queue has 0 unpublished drafts → no `/blog` publish; dev.to drip-guarded (last post 5.1 h) →
  expected no-op, no queue edit.

**Why this lever (founder's priority order):** (1) **Acquisition/distribution (P1) — pulled, but a CTR
lever, not another page.** Runs 179/180/181 added pages; on-page authoring is exhausted at low N. Fresh
GSC surfaced a *different* signal: pages ranking **page-1 with impressions and 0 clicks** — a snippet
(CTR) problem, agent-movable, distinct from ranking (authority-gated). The truncated titles literally
cut the query keyword out of the SERP. `running-total…` (pos 37, page-4) left untouched — CTR ~0
regardless. No overlap with the one open PR (#1041, engine/LLM). (2) UX-flow (P2) — row #15 mcp fixed +
merged last run (#1039). (3) Engine — dark + overlaps #1041's `tools/eval/**`. Dogfood gate stays 2/5.

**Anti-rut (rule 7):** recent daily levers — UX-flow (182), distribution-page (181/180/179), null (178).
Not 5 same-category in a row; and this run is a distribution *CTR* lever (optimize existing rankers), a
different sub-lever from the 179/180/181 add-a-page pulls.

**KPI (GLOBAL-025):** advances the **onboarding/acquisition** pillar (page-1 rankers now present a
keyword-forward, non-truncated SERP snippet — the click is the top of the funnel). **Degrades none** —
web-data-only diff (two override string fields + comments); no product/schema/render change; full
suite green (typecheck 0, check 0, api 1381 pass, web data 107 pass, meta guard 4/4).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
