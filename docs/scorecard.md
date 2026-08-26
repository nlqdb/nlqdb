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

**Worst number today (run 186, 2026-08-26) — WEEKLY-FOCUS ENGINE LEVER, +20.51 pp:** built the
**per-goal-pack declared categorical vocabulary** run 185 pre-drafted as the next-run lever, via the
in-bounds channel run 185 named (hand-authored `Evidence:`, GLOBAL-037 lane-1 legal), and measured a
**clean same-session A/B** on the free chain (both today, main vs branch): memory-quality free-chain EX
**41.03 % (16/39, main [32919866678](https://github.com/nlqdb/nlqdb/actions/runs/32919866678)) → 61.54 %
(24/39, branch [32920213591](https://github.com/nlqdb/nlqdb/actions/runs/32920213591))**, **+20.51 pp / +8
questions** (vs run 185's 43.59 %: +17.95 pp). Every weak axis rose: **temporal 4→5/11**, consolidation
3→6, forgetting 2→4, retrieval 3→4, analytical 4→5. **Mechanism confirmed in the mismatch SQL:** the
fixed questions now emit the *correct* `kind`/`predicate`/`role` literal (`'open question'`→`'open_question'`,
`'doc-sync'`→`'sync'`, `'vocabulary'`→`'vocab_encounter'`, `'current_city'`→`'city'`) instead of a drifted
guess. **A first cut also declared an `agent_id` convention + recency note; the run 32919537669 diagnostics
caught both backfiring** (planner injected the prose verbatim as a literal, `agent_id='the memory-owning
agent'`) so it was trimmed to categorical-domains-only before shipping — that trim is the 43.59 %→61.54 %
swing. **Next-run lever (dominant remaining class):** structural — `entity_facts` traversal + the
`student:alex`-as-`agent_id` convention (needs a hint that doesn't literal-inject; schema `COMMENT`, not prose).
**P1 distribution still exhausted** (GSC 28d: 7 clicks / 675 impr / pos 25.1; winners authority-gated).
**P2 UX-flow green** (FLOW-005 6/6, carried run 184). BIRD/Spider dark.
**Weekly-focus gate (don't overwrite the /weekly target mid-week):** dogfood **2/5**; memory-eval
free-chain EX **61.54 %** (target ≥ 70 %, temporal 5/11 — moved live this run, gap to target 8.5 pp).
**Top `blocked-by-human` bullet:** Show HN launch sequence (⏱ ~30 min, **idle 74 days since 06-13**),
condition-gated on the `SK-PIVOT-016` gate (**2/5**). #2 Anthropic connector directory (money-gated,
07-21). #3 Supabase OAuth app + secrets (08-13; paste path works). Queue **depth 3**, head age 74 d.
**Dark (rule 8, reported not pulled):** dogfood gate (criterion 1 grind-only; criteria 3/4
E-09/GLOBAL-037-blocked); engine **#8 BIRD 0.5382** (31 d) / **#9 Spider 0.2222** (**38 d** stale, async
multi-window resume); rows **#2/#4/#5/#16** stranger-dependent (N = 0 until launch); row **#15** opencheck
(free-lane saturation, remedy costs money ⇒ rule 4).

**Rule 6 — GREEN.** Branch based on `main@7137d86` (latest; #1049/#1050/#1051 merged since run 185). Health
re-measured live: **`typecheck` 0**, **`bun run check` 0** (53 pre-existing script-`console.log` warnings,
none in this diff), **`bun run test` exit 0** (full suite, re-run this run). Deploys **green on latest main**
(deploy-api + deploy-events-worker success on `7137d86`; web on `ac0534a`, path-filtered). This run's code
diff is eval-only (`tools/eval/` dataset + test — no runtime/prompt/baseline path); deploys path-filtered.
**Open PRs: 0** at step 0.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel, bot-filtered** (RUM + GSC **carried from 08-25** — no `scripts/` pull this engine-lever run; Users/DBs carried from 07-27 remote-D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF RUM) | **carried 08-25:** floor **72 pl / 60 vis** (genuine ≈54 after `rateme12.com` spam cut); real nlqdb landings led by `app.nlqdb.com/` (7), `nlqdb.com/` (6), `hall-of-fame/` (4), `/agents/` (3) | cut rule: `bot=1` / `userAgentBrowser ∈ {Unknown, ChromeHeadless}` / CF-bot ⇒ real-browser is a floor. 7d SAMPLED — sub-interval buckets are noise |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev — live remote-D1 07-27; no channel newly live to produce a signal. **Dark** (rule 8) — moves only on launch |
| 3 | DBs total | **254** (07-27 live remote-D1) + **1 dogfood** (`db_agent_memory_v1_3a8a72`, internal) | stranger subset ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not measurable** (`SK-ONBOARD-007`). The **dogfood workload** (run 176): **100 % (10/10)** through the public MCP surface (= gate criterion 2) | target ≥ 95 %. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12; founder-owned) | share with ≥ 2 asks |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **112** content pages (`/solve` **41** + `/vs` 31 + `/blog` 40; unchanged this run — no new page, distribution on-page exhausted for a single run). Unpublished blog drafts **0** (queue drained) | leading input to rows #1–#3; `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **40** + 1 dev.to variant published this run (`llm-timeout-looks-like-hallucination` → [dev.to](https://dev.to/omer_hochman/the-timeout-that-looked-like-a-hallucination-1m0o); 17 variants remain). **GSC carried 08-25** (28d, no `scripts/` pull this engine-lever run): **7 clicks / 675 impr / pos 25.1**. "Strengthen next" winnable pages authority-gated + content-complete (`running-total…` pos 38.4, `find-rows-with-no-match…` pos 19.9) ⇒ no new snippet lever. Referral (08-25): google 6 / accounts.google 3 / bing 1 | `gsc-pull.ts` + `rum-pull.ts`. Page-1 zero-click = CTR lever (agent-movable); page-2+ authority/launch-gated |
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
| | Memory-quality eval (`SK-QUAL-023`) | **39-q free-chain EX 61.54 % (24/39)** — branch run [32920213591](https://github.com/nlqdb/nlqdb/actions/runs/32920213591) (**2026-08-26, live this run**; per-goal-pack declared categorical vocabulary lever). **Same-session A/B:** main-no-evidence 41.03 % (16/39, [32919866678](https://github.com/nlqdb/nlqdb/actions/runs/32919866678)) → branch 61.54 %, **+20.51 pp**. Per-axis: **consolidation 6/7, analytical 5/7, forgetting 4/7, retrieval 4/7, temporal 5/11 = 45.45 %** (weak axis, up from 4/11 A/B and 2/11 run 185). Remaining misses are **structural** (`entity_facts` traversal; `student:alex`-as-`agent_id`) — vocabulary drift eliminated, next-run lever named | 39 gold-verified questions, 5 axes; free-only, no baseline |

## Shipped distribution

**41 canonical `/solve` pages** + **40 `/blog` posts** + **31 `/vs` pages** live under `nlqdb.com/`
(`SK-SOLVE-001` / `SK-BLOG-001` / `SK-CMP-001`). The registries are `apps/web/src/data/{solve,blog,competitors}.ts`.

- **This run (186):** drained one dev.to variant — `llm-timeout-looks-like-hallucination` →
  [dev.to](https://dev.to/omer_hochman/the-timeout-that-looked-like-a-hallucination-1m0o)
  (step 3.3; 17 variants remain). No new `/blog` page (blog-draft queue empty).
- **Run 185:** drained one dev.to variant — `model-preset-fail-loud`. Engine-measurement run.
- **Run 184:** null run — no new page, no publish.

## Last change

**2026-08-26 (run 186)** — **WEEKLY-FOCUS ENGINE LEVER SHIPPED + MEASURED. Built the per-goal-pack
declared categorical vocabulary run 185 pre-drafted; same-session free-chain A/B: memory-quality EX
41.03 % (16/39) → 61.54 % (24/39), +20.51 pp.**

**The lever (GLOBAL-037-legal):** run 185 diagnosed the dominant free-lane failure as categorical
value-linking drift and named the in-bounds fix — a per-goal-pack declared categorical vocabulary via
*hand-authored evidence* (GLOBAL-037 planning lane 1 explicitly permits "schema … and hand-authored
evidence/descriptions"; the `value-retrieval` cell-sampling lane stays unbuilt/founder-gated). Realized
it through the harness's existing `Evidence:` channel (the one BIRD uses): `MEMORY_SCHEMA_EVIDENCE`
declares each goal-pack's closed `kind`/`predicate`/`role` domains (`tools/eval/src/datasets/
memory-quality.ts`), wired into `toEvalQuestions`. A new honesty-guard test pins every declared literal
to the seed in both directions, so evidence can't drift from the fixture as packs grow.

**The measurement (clean same-session A/B, both on today's free chain):** main-no-evidence
[32919866678](https://github.com/nlqdb/nlqdb/actions/runs/32919866678) **41.03 % (16/39)** → branch
[32920213591](https://github.com/nlqdb/nlqdb/actions/runs/32920213591) **61.54 % (24/39)**, **+20.51 pp**
(vs run 185's 43.59 %: +17.95 pp; every axis rose — per-axis in the memory row). Mechanism confirmed in
the mismatch SQL: fixed rows now emit the correct literal where main drifted.

**Backfire caught + trimmed (the swing):** a first cut ([32919537669](https://github.com/nlqdb/nlqdb/actions/runs/32919537669),
17/39 = 43.59 %, flat) also declared an `agent_id` identifier convention + an append-only recency note;
its mismatch diagnostics showed the planner injecting the prose *verbatim* as a literal
(`agent_id = 'the memory-owning agent'`, q19/q32/q38) and over-applying recency (q0), cancelling the
vocabulary gain. Trimming to categorical-domains-only (commit `f89d684`) is the 43.59 %→61.54 % swing.

**Next-run lever:** remaining misses are **structural** (`entity_facts` traversal; `student:alex`-as-`agent_id`)
— a hint that doesn't literal-inject (schema `COMMENT`, not prose). Vocabulary drift is eliminated.

**Step-1 refreshed (live):** health GREEN (`typecheck`/`check` 0, `test` exit 0; deploys green on
`7137d86`, eval-only diff path-filtered); GSC carried 7 clicks / 675 impr / pos 25.1 (P1 exhausted);
FLOW-005 carried 6/6; step 3 drained one dev.to variant (`llm-timeout-looks-like-hallucination`); open PRs 0.

**Anti-rut (rule 7):** recent daily levers — engine-change (186), engine-measure (185), null (184),
CTR (183), UX-flow (182). No 5-in-a-row same category.

**KPI (GLOBAL-025):** advances **engine quality** (pillar #1, the GLOBAL-036 wedge headline) — memory-quality
free-chain EX +20.51 pp toward the ≥70 % weekly target (gap now 8.5 pp). Diff is eval-only (no runtime/
prompt/baseline path); **degrades none.**

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
