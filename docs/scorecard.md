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

**Worst number today (run 185, 2026-08-25) — ENGINE MEASUREMENT RUN:** pulled the **weekly-focus
engine lever the loop was waiting to sequence after #1041** (now merged, `aec2c6f`): re-measured the
26-day-stale **memory-quality free-chain EX** on the post-#1041 Qwen planner head. **Number moved
(memory row):** stale 59.26 % (27 q, 07-29, pre-#1041 dead head) → fresh **43.59 % (17/39, 08-25)** —
first scoring of the +12-q language-tutor pack (added post-07-29) *and* first read on the new head, so a
fresh 39-q baseline, not a regression delta. Per-axis: **temporal 2/11 = 18.18 %** (still the weak axis,
weekly focus); retrieval/consolidation/analytical 4/7; forgetting 3/7. **Diagnosis:** categorical
value-linking / vocabulary drift (planner guesses `'open question'`≠`'open_question'`); fix is a
per-goal-pack declared vocabulary — a design lever, not a snippet (GLOBAL-037 reconciliation in "Last change").
**P1 distribution still exhausted** — fresh GSC (28d): 7 clicks / 675 impr / pos 25.1; "Strengthen next"
winners (`running-total…` pos 38.4, `find-rows-with-no-match…` pos 19.9) authority-gated, content-complete.
**P2 UX-flow green** (FLOW-005 6/6, carried run 184; nothing in its path changed). BIRD/Spider dark.
**Weekly-focus gate (don't overwrite the /weekly target mid-week):** dogfood **2/5**; memory-eval
free-chain EX **43.59 %** (target ≥ 70 %, temporal 2/11 — refreshed live this run).
**Top `blocked-by-human` bullet:** Show HN launch sequence (⏱ ~30 min, **idle 73 days since 06-13**),
condition-gated on the `SK-PIVOT-016` gate (**2/5**). #2 Anthropic connector directory (money-gated,
07-21). #3 Supabase OAuth app + secrets (08-13; paste path works). Queue **depth 3**, head age 73 d.
**Dark (rule 8, reported not pulled):** dogfood gate (criterion 1 grind-only; criteria 3/4
E-09/GLOBAL-037-blocked); engine **#8 BIRD 0.5382** (30 d) / **#9 Spider 0.2222** (**37 d** stale, async
multi-window resume); rows **#2/#4/#5/#16** stranger-dependent (N = 0 until launch); row **#15** opencheck
(free-lane saturation, remedy costs money ⇒ rule 4).

**Rule 6 — GREEN.** Branch based on `main@aec2c6f` (latest; #1041 merged since run 184). Health
re-measured live: **`typecheck` 0**, **`bun run check` 0** (53 pre-existing script-`console.log` warnings,
none in this diff), **`bun run test` 1390 pass / 20 skip (exit 0)**. Deploys carried green from run 184
(this run's diff is docs-only — scorecard, verification log, dev.to queue line — path-filtered out of all
deploys). **Open PRs: 0** at step 0.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel, bot-filtered** (RUM + GSC **re-pulled live 08-25** (`rum-pull.ts` 7d SAMPLED; `gsc-pull.ts` 28d — barely moves day-to-day). Users/DBs carried from 07-27 remote-D1 — no container access to remote D1 this run, no channel newly live) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF RUM) | **317 pl / 304 vis** raw, **real-browser floor 72 pl / 60 vis** (re-pulled live 08-25; 245 synthetic cut). Of the floor, **`rateme12.com/` (18 pl) is RUM referrer-spam noise** (unrelated domain) ⇒ genuine nlqdb floor ≈ 54 pl. Real nlqdb landings: `app.nlqdb.com/` (7), `nlqdb.com/` (6), `hall-of-fame/` (4), `/agents/` (3), `/agent-memory-benchmarks` (2), `/vs/vanna/` (2), plus 1 pl each across several `/solve` + `/vs` pages | cut rule: `bot=1` or `userAgentBrowser ∈ {Unknown, ChromeHeadless}` or CF-classified bot ⇒ real-browser is a floor. Read at **7d**, SAMPLED (interval up to 2) — treat sub-interval buckets as noise |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev — live remote-D1 07-27; no channel newly live to produce a signal. **Dark** (rule 8) — moves only on launch |
| 3 | DBs total | **254** (07-27 live remote-D1) + **1 dogfood** (`db_agent_memory_v1_3a8a72`, internal) | stranger subset ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not measurable** (`SK-ONBOARD-007`). The **dogfood workload** (run 176): **100 % (10/10)** through the public MCP surface (= gate criterion 2) | target ≥ 95 %. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12; founder-owned) | share with ≥ 2 asks |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **112** content pages (`/solve` **41** + `/vs` 31 + `/blog` 40; unchanged this run — no new page, distribution on-page exhausted for a single run). Unpublished blog drafts **0** (queue drained) | leading input to rows #1–#3; `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **40** + 1 dev.to variant published this run (`model-preset-fail-loud` → [dev.to](https://dev.to/omer_hochman/your-best-model-toggle-quietly-serves-the-cheap-model-ship-a-409-instead-77o)). **GSC re-pulled live 08-25** (28d): **7 clicks / 675 impr / pos 25.1** (963 impr across 142 pages). Run-183 CTR fixes holding (SEO-lagging, still 0 clicks as expected): `count-rows-per-day` **pos 8.4, 54 impr**; `pivot-rows-into-columns` **pos 12.8, 21 impr**. **No new snippet lever** — "Strengthen next" winnable pages authority-gated: `running-total…` (106 impr, pos 38.4) + `find-rows-with-no-match…` (52 impr, pos 19.9) verified content-complete. **Referral yield (RUM 08-25):** 10 pl / 3 referrers (google 6, accounts.google 3, bing 1); real nlqdb referral landings = `/vs/vanna/` (2), `hall-of-fame` (2), `/solve/store-query-chatbot…`, `/vs/mindsdb/` | `gsc-pull.ts` + `rum-pull.ts`. Page-1 zero-click pages are a CTR lever (snippet, agent-movable); page-2+ ranks are authority/launch-gated |
| | **Engine** — BIRD 07-26 · Spider 07-19 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.5382** (268/500, 07-26 canonical on `d961475`, [run 30212657876](https://github.com/nlqdb/nlqdb/actions/runs/30212657876)) — **30 d old, staleness trigger fired**, but **dark (rule 8)**: resume is async multi-window and `main` moved since the 07-27 checkpoint. #1041 (planner re-head) now merged ⇒ a fresh BIRD/Spider re-measure is a valid next-run engine lever | target 0.65 / **Phase 2 floor 0.60** — gap 6.2 pp. Offline levers exhausted |
| 9 | Spider raw EX | **0.2222** (30/135, 07-19 canonical on `04fa3d0`, **37 d old**). 07-27 re-dispatch exited **partial** (`SK-QUAL-013` budget-stop) | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is source of truth |
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
| | **Human queue** — the one non-automatable actor | **depth 3**; head is the Show HN launch, oldest bullet **73 days** (`SK-PIVOT-016` gate **2/5**); #2 Anthropic connector directory (money-gated, 07-21); #3 Supabase OAuth app + secrets (08-13) | [`blocked-by-human.md`](blocked-by-human.md). Open PRs: **0** at step 0 (#1041 merged since run 184) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/27 + 12 memory `/vs` pages | mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; rest Neon/infra-gated |
| | Dogfood track D-* (`SK-PIVOT-016` gate, **weekly focus**) | **3/7** (D-01 ✅, D-03 ✅, D-04 🟡, **D-06 🟡**) — gate **2/5** (criterion 2 green from D-04's 100 % first-10; **criterion 5 green on #978's deploy** — the public `/agents` `ag-dog` dashboard is live). Remaining: criterion 1 (12 → ≥100 real MCP asks, grind); criterion 3 (silent-wrong-answer axis, E-09-blocked); criterion 4 (temporal, E-09/GLOBAL-037-blocked). D-06 run 2 (staleness-CI red + demand-signal) + D-04 `NLQDB_MEMORY_DB` var still open | mirrors [`dogfood/INDEX.md`](features/agent-memory-pivot/worksheets/dogfood/INDEX.md) |
| | Memory-quality eval (`SK-QUAL-023`) | **39-q free-chain EX 43.59 % (17/39)** — run [32796849658](https://github.com/nlqdb/nlqdb/actions/runs/32796849658) (**2026-08-25, live this run**; post-#1041 Qwen head + first scoring of the +12-q language-tutor pack). Per-axis: retrieval/consolidation/analytical 4/7, forgetting 3/7, **temporal 2/11 = 18.18 %** (weak axis = weekly focus). Failure = categorical value-linking / vocabulary drift (`'open question'`≠`'open_question'`); fix is per-goal-pack declared vocabulary (GLOBAL-037 lane-1 schema/evidence, not the founder-gated `value-retrieval` lane) — next-run lever | 39 gold-verified questions, 5 axes; free-only, no baseline |

## Shipped distribution

**41 canonical `/solve` pages** + **40 `/blog` posts** + **31 `/vs` pages** live under `nlqdb.com/`
(`SK-SOLVE-001` / `SK-BLOG-001` / `SK-CMP-001`). The registries are `apps/web/src/data/{solve,blog,competitors}.ts`.

- **This run (185):** drained one dev.to variant — `model-preset-fail-loud` →
  [dev.to](https://dev.to/omer_hochman/your-best-model-toggle-quietly-serves-the-cheap-model-ship-a-409-instead-77o)
  (step 3.3; 18 variants remain). No new `/blog` page (blog-draft queue empty).
- **Run 184:** null run — no new page, no publish.
- **Run 183:** CTR lever — hand-written SERP meta for two page-1 zero-click `/solve` pages.

## Last change

**2026-08-25 (run 185)** — **ENGINE MEASUREMENT RUN. Pulled the weekly-focus lever the loop was waiting
to sequence after #1041 (now merged): re-measured the 26-day-stale memory-quality free-chain EX on the
post-#1041 Qwen planner head. Number moved (memory row): 59.26 % (27 q, 07-29) → 43.59 % (17/39, 08-25).**

**The measurement (weekly focus, live):** first `quality-eval-memory` dispatch since #1041 landed
([run 32796849658](https://github.com/nlqdb/nlqdb/actions/runs/32796849658), free lane, main `aec2c6f`):
EX **43.59 % (17/39)**, `transport_failed:false` / `resumable:false`. Two confounds vs the 07-29 27-q
reading — the new planner head **and** the first-ever scoring of the +12-q language-tutor pack (added
after 07-29) — so this is a fresh 39-q baseline, not a regression delta. Per-axis: retrieval/
consolidation/analytical 4/7, forgetting 3/7, **temporal 2/11 = 18.18 %** (the weak axis, still the
weekly focus). Full row + confound in `progress/quality-score-verification-log.md`.

**Diagnosis (from the run-summary mismatch SQL) + next-run lever:** the dominant failure class is
**categorical value-linking / vocabulary drift** — the planner guesses a plausible-but-wrong literal
for `kind`/`predicate`/`role` (`'open question'`≠`'open_question'`, `'current_city'`≠`'city'`,
`'doc-sync'`≠`'sync'`, `'vocabulary'`≠`'vocab_encounter'`, `'tracker'`≠`'tracker_row'`,
`role='tutor'`≠`'lesson'`); a second, harder class is structural (`entity_facts` traversal;
`student:alex` mistaken for an `agent_id`). **Why the fix is a design lever, not a snippet
(GLOBAL-037):** surfacing distinct `kind`/`role` values to the planner IS the `value-retrieval`
cell-value lane — explicitly **unbuilt and founder-gated** (planning = schema-only). The generic
`agent_memory_v1` preset is deliberately **open-vocabulary** `TEXT`, so a static `CHECK`-enum would
wrongly reject legitimate agent writes. The in-bounds path is a **per-goal-pack declared categorical
vocabulary** (schema / hand-authored evidence — GLOBAL-037 lane-1 legal), which needs a pack-schema
layer that does not exist in production yet. That is a real feature (next-run engine lever), not a
value-decidable snippet; no founder action needed (GLOBAL-033).

**Step-1 refreshed (live):** health GREEN (`typecheck`/`check` 0, `test` 1390 pass; deploys carried,
docs-only diff); RUM 317/304 raw, floor 72/60 (genuine ≈54); GSC 7 clicks / 675 impr / pos 25.1 (P1
exhausted); FLOW-005 carried 6/6 (nothing in its path changed); step 3 drained one dev.to variant; open PRs 0.

**Anti-rut (rule 7):** recent daily levers — engine-measure (185), null (184), CTR (183), UX-flow (182),
distribution-page (181/180/179). No 5-in-a-row same category; the engine lane is a fresh pull.

**KPI (GLOBAL-025):** advances **engine quality** (pillar #1) — the wedge's headline quality number is
now fresh on the shipped head with the weak axis + its exact failure mode pinpointed. Diff is docs-only;
**degrades none.**

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
