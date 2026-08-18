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
**Weekly focus (`/weekly` 2026-08-15 — affirms the founder's 07-28 gate):** agent-movable
number = **dogfood criterion 1, real MCP asks 12 → ≥ 100.** Criterion 5 (the `/agents`
dashboard) shipped run 177 (#978, deployed), so criterion 1 is the gate's only
GLOBAL-037-unblocked lever; the gate is still the only path off real strangers = 0 —
premium going **live 08-14** (row #20, meter firing) doesn't change that.

**Worst number today (run 179, 2026-08-18):** the **weekly-focus `SK-PIVOT-016` dogfood gate**
(**2/5**) remains the worst number — its only agent-movable, GLOBAL-037-unblocked criterion is
**criterion 1 (real MCP asks 12 → ≥100)**, grind-only and not honestly container-movable without
fabricating asks (dark for lever-choice, rule 8). So this run pulled the **highest-yield
agent-movable lever available — distribution (P1)**: published the queued dogfood-lessons post to
`/blog` (**posts 39 → 40**, indexable content pages **110 → 111**, unpublished drafts **1 → 0**)
and drained one dev.to variant (run-119 `find-duplicate-rows`,
[live](https://dev.to/omer_hochman/the-duplicate-rows-query-you-re-google-every-six-weeks-39km)).
Delta in "Last change".
**Weekly-focus gate (don't overwrite the /weekly-set target mid-week):** dogfood **2/5**.
**Top `blocked-by-human` bullet:** fire the Show HN launch sequence (⏱ ~30 min,
**idle 66 days since 06-13**), still condition-gated on the `SK-PIVOT-016` gate (now **2/5**).
#2 = Anthropic **connector directory** (money-gated, since 07-21). #3 = Supabase OAuth app +
prod secrets (⏱ ~15 min, since 08-13; paste path works meanwhile). Queue **depth 3**, head age
66 d is the real cycle time.
**Dark (rule 8, reported not pulled):** engine **#8 BIRD 0.5382** (23 d) / **#9 Spider 0.2222**
(**30 d** stale — resume deferred: async multi-window, `main` moved since the 07-27 checkpoint);
rows **#2/#4/#5/#16** stranger-dependent (N = 0 until launch); row **#15** opencheck (free-lane
saturation, remedy costs money ⇒ rule 4); dogfood criterion 4 (E-09 GLOBAL-037-blocked) +
criterion 3 (same root).

**Rule 6 — GREEN.** Branch based on `main@1202e2e`. Health re-measured live this run:
`bun install` restored container deps; **`typecheck` exit 0** (all 21 packages), **`bun run lint`
exit 0** (54 warnings, 0 errors), **`bun run test` exit 0** (1307 passed), **`@nlqdb/web` blog +
endpoint tests 559 pass** (new post advertised in sitemap + llms.txt, all invariants green).
`deploy-api` + `deploy-web` latest `main` runs (`1202e2e`) both **success**. This run's diff:
`apps/web/src/data/blog.ts` (+1 post), `distribution-queue.md`, this scorecard.
**Open PRs: 0** (checked step-0). No file overlap risk.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel, bot-filtered** (RUM **re-pulled live 08-18** (`rum-pull.ts`, 7d, SAMPLED); GSC carried from 08-17 live pull (`gsc-pull.ts`, 28d — barely moves day-to-day). Users/DBs carried from 07-27 remote-D1 — no container access to remote D1 this run, no channel newly live) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF RUM) | **357 pl / 322 vis** raw, **real-browser floor 93 pl / 58 vis** (re-pulled 08-18; 264 synthetic cut). Real-browser landings led by `app.nlqdb.com/auth/sign-in/` (**18**), `app.nlqdb.com/app/` (17), `auth/continue/` (16), `auth/post-signin/` (9), `nlqdb.com/` (8) | cut rule: `bot=1` or `userAgentBrowser ∈ {Unknown, ChromeHeadless}` or CF-classified bot ⇒ real-browser is a floor. Read at **7d** (28d comes back sampled); this 7d window is itself sampled (interval ≤1.5) — treat sub-interval buckets as noise |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev — live remote-D1 07-27; no channel newly live to produce a signal. **Dark** (rule 8) — moves only on launch |
| 3 | DBs total | **254** (07-27 live remote-D1) + **1 dogfood** (`db_agent_memory_v1_3a8a72`, internal) | stranger subset ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not measurable** (`SK-ONBOARD-007`). The **dogfood workload** (run 176): **100 % (10/10)** through the public MCP surface (= gate criterion 2) | target ≥ 95 %. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12; founder-owned) | share with ≥ 2 asks |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **111** content pages (`/solve` 40 + `/vs` 31 + `/blog` **40**; +1 this run — `success-rate-cant-see-a-wrong-answer`); 119 sitemap URLs submitted (GSC auto-aggregates the new slug). Unpublished blog drafts **0** (queue drained) | leading input to rows #1–#3; `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **40** (+1 this run — the dogfood-lessons post). **GSC carried 08-17** (28d): **12 clicks / 619 impr / pos 21.3**. Top-impression page `/solve/running-total-cumulative-sum-in-sql/` **115 impr / pos 36.3 / 0 clicks** (page-4, biggest wasted-impression surface; content complete — bottleneck is domain authority, not on-page). Strengthen-next #2 `/solve/find-rows-with-no-match-in-another-table/` **59 impr / pos 16.7** (page-2, content-complete). **Referral yield (RUM 08-18):** **17 pl from 4 external referrers** (mail.google 8, baidu 5, bing 2, google 2) — and the blog is now earning organic referral landings: bing → `/blog/restrictive-rls-agent-memory-scoping/`, baidu → 3 `/blog/*` posts. Validates the distribution lever: published posts, not just count, now open sessions | `gsc-pull.ts` + `rum-pull.ts`. Total-impression breadth is the bottleneck, not per-page CTR at low N |
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
| 15 | E2E manual-suite freshness | **~0.0** (time-decayed: last successes were mcp 07-25 / sdk 07-24 / examples 07-24 / opencheck 07-17 — all now >7 d ⇒ freshness floored). None re-dispatched since 07-28 | Never dispatch opencheck alongside another lane consumer. Triage: `e2e-coverage/opencheck-operations.md`. Re-dispatch is a lever candidate (workflow_dispatch, agent-runnable) |
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
| | **Human queue** — the one non-automatable actor | **depth 3**; head is the Show HN launch, oldest bullet **66 days** (`SK-PIVOT-016` gate **2/5**); #2 Anthropic connector directory (money-gated, 07-21); #3 Supabase OAuth app + secrets (08-13) | [`blocked-by-human.md`](blocked-by-human.md). Open PRs: **0** |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/27 + 12 memory `/vs` pages | mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; rest Neon/infra-gated |
| | Dogfood track D-* (`SK-PIVOT-016` gate, **weekly focus**) | **3/7** (D-01 ✅, D-03 ✅, D-04 🟡, **D-06 🟡**) — gate **2/5** (criterion 2 green from D-04's 100 % first-10; **criterion 5 green on #978's deploy** — the public `/agents` `ag-dog` dashboard is live). Remaining: criterion 1 (12 → ≥100 real MCP asks, grind); criterion 3 (silent-wrong-answer axis, E-09-blocked); criterion 4 (temporal, E-09/GLOBAL-037-blocked). D-06 run 2 (staleness-CI red + demand-signal) + D-04 `NLQDB_MEMORY_DB` var still open | mirrors [`dogfood/INDEX.md`](features/agent-memory-pivot/worksheets/dogfood/INDEX.md) |
| | Memory-quality eval (`SK-QUAL-023`) | **27-q free-chain EX 59.26 % (16/27)** — run 30413719690 (2026-07-29). Temporal 2/7 (synthetic 2/3, ops 0/4) — the weak axis gating criterion 4, E-09/GLOBAL-037-blocked | 27 gold-verified questions, 5 axes; free-only, no baseline |

## Shipped distribution

**40 canonical `/solve` pages** + **40 `/blog` posts** + **31 `/vs` pages** live under `nlqdb.com/`
(`SK-SOLVE-001` / `SK-BLOG-001` / `SK-CMP-001`). The registries are `apps/web/src/data/{solve,blog,competitors}.ts`.

- **This run (179):** published **https://nlqdb.com/blog/success-rate-cant-see-a-wrong-answer/** —
  the dogfood-run lesson (a first-10 success counter can't see a semantically-wrong answer; the
  fix is a separate wrong-answer judgement + declaring categorical domains in DDL). Drained one
  dev.to variant: run-119 `find-duplicate-rows` →
  https://dev.to/omer_hochman/the-duplicate-rows-query-you-re-google-every-six-weeks-39km

## Last change

**2026-08-18 (run 179)** — **Distribution lever (P1): published the queued dogfood-lessons post to
`/blog` and drained one dev.to variant. Number moved: published-post count / indexable surfaces.**

**Delta (measured, same-instrument before/after):**
- Published `/blog` posts **39 → 40** (row #7); indexable content pages **110 → 111** (row #6);
  unpublished blog drafts **1 → 0** (queue drained). Sitemap URLs **118 → 119** (`sitemap.xml.ts`
  + `llms.txt.ts` auto-aggregate the new slug — asserted green by the endpoint tests, 559 pass).
- New post: **https://nlqdb.com/blog/success-rate-cant-see-a-wrong-answer/** — the D-04 dogfood
  run's lesson, verbatim numbers verified against `dogfood/D-04-first-corpus-sync.md`: 22 writes /
  9 entities / 13 facts, 12/12 asks answered, 10/10 first-ten, one silent wrong answer (query #8:
  planner compiled `kind='question'` against stored `open_question` → 0 rows, true 11,
  `confidence:1`). Lesson: a success-rate counter is blind to semantic error; the fix is a separate
  wrong-answer judgement + declaring the categorical domain in DDL (`CHECK`/enum) so value-linking
  is legitimate schema egress, not data egress (`E-09`/`GLOBAL-037`).
- dev.to variant drained (step 3.3, `SK-BLOG-003`): run-119 `find-duplicate-rows` posted to
  https://dev.to/omer_hochman/the-duplicate-rows-query-you-re-google-every-six-weeks-39km (not
  drip-guarded — no dev.to post in the prior 20 h). Queue line updated: dev.to venue dropped, live
  URL appended.

**Why this lever (lanes in the founder's priority order):** (1) Acquisition/distribution (P1) — a
ready draft sat unpublished; publishing it is the highest-yield agent-movable move and it moves a
real distribution number (published-post count), while RUM 08-18 shows the blog is now earning
organic referral landings (bing → RLS post, baidu → 3 `/blog/*`), so the surface produces yield,
not just count. `/reach` owns the R-slices — not duplicated. The dogfood gate (weekly focus) stays
2/5: criterion 1 is grind-only, criteria 3/4 are GLOBAL-037-blocked — none single-run-movable.
(2) UX-flow — health + both deploys green, no failing flow. (3) Engine — dark (async multi-window,
`main` moved).

**Anti-rut (rule 7):** recent levers were null (178), dogfood (177), dogfood (176), null (174),
distribution (173) — distribution last pulled 6 runs back, not 5-in-a-row; clear.

**KPI (GLOBAL-025):** advances the **distribution/onboarding** pillar (one more indexed, honest
engineering post on the wedge's search surface; the post is on-brand "unflattering by design" per
`SK-PIVOT-019`). **Degrades none** — additive one-post edit, all suites green.

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
