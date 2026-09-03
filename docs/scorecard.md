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

**Worst number today (run 194, 2026-09-03) — LANE-2 UX-FLOW INSTRUMENT: row #21 Playwright walker made container-runnable — the pin-mismatch launch block is fixed; residual block re-diagnosed as sandbox UDP egress, not the pin.**
The `/weekly` (08-29) focus is **dogfood gate `SK-PIVOT-016` 2/5 → ≥ 3/5, by landing the schema-structure lever so criterion 4 (temporal) flips.**
Step 0: **open PRs = 1** (#1087 changeset-release, `changeset-release/main` — no file overlap; avoided). **Weekly-focus lever still not cleanly pullable:** criterion 4's two golden
misses (q19 ops, q4 synthetic) remain query-shape within the offline eval's ±5 pp noise floor (runs 188/192/193) and the eval lane is anti-rut (rules 7/8, 6 of runs 185–192). **CTR lane
(row #7) exhausted:** the fresh 09-03 GSC pull's page-1 zero-click pages (`count-rows-per-day…` pos 7.1 / 54 impr; `countif-sumif` pos 5.7 for "postgres countif") already carry hand-written
SERP meta (runs 183/190) — position/authority is the gate now, not the snippet. So per step-2 order the pullable lane is **lane-2 (real UX-flow quality)**.
**Lever (this run):** fixed the row-#21 Playwright walker's launch — `browser.ts` now falls back to the prebuilt Chromium when the pinned revision is absent (details + verification in "Last change"
below). Null-shaped on funnel metrics; the fix is the finding's remediation, and the full walk stays CI-canonical (sandbox UDP-egress limit).
**P2 UX-flow green** (FLOW-005 6/6, carried run 184). BIRD/Spider dark; memory-quality proxy MET at 79.49 % (off-lever).
**Top `blocked-by-human` bullet:** Show HN launch sequence (⏱ ~30 min, **idle 81 days since 06-13**),
condition-gated on the `SK-PIVOT-016` gate (**2/5**; criterion 4 at 5/7 golden). #2 Anthropic
connector directory (money-gated, 07-21). Queue **depth 2+**, head age 81 d.
**Dark (rule 8, reported not pulled):** dogfood criterion 1 (grind-only); criterion 3 (silent-wrong-answer, E-09/GLOBAL-037); criterion 4 (query-shape
lever within ±5 pp noise); engine **#8 BIRD 0.5382** (38 d) / **#9 Spider 0.2222** (**45 d** stale, async multi-window resume); rows **#2/#4/#5/#16**
stranger-dependent (N = 0 until launch); row **#15** opencheck lane (free-lane saturation, remedy costs money ⇒ rule 4).

**Rule 6 — GREEN.** Branch based on `main@57ba62b` (latest; #1085/#1086/#1088 merged since run 193). Health
re-measured live: **`typecheck` 0** (workspace, post-`bun install`), **`bun run check` exit 0** (biome; 53 pre-existing warnings, 0 errors), **`bun run test` exit 0**.
`deploy-web` + `deploy-api` latest `main` runs both **success**. Diff: the `browser.ts` launch fallback + `stranger-test/AGENTS.md` doc fix (row-#21 lever), scorecard, and the dev.to
queue-line drain. Stranger-test typecheck + 51 unit tests green. **Open PRs: 1** (#1087 changeset-release, no overlap) at step 0.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel, bot-filtered** (RUM + GSC **live-pulled 09-02** this run; Users/DBs carried from 07-27 remote-D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF RUM) | **live 09-03** (08-27→09-03, unsampled): raw 399 pl / 247 vis; real-browser floor **56 pl / 54 vis** (genuine ≈30 after the `rateme12.com` spam cut of ~24 — GLOBAL-039 residual http noise); real nlqdb landings led by `docs.nlqdb.com/` (3), `/vs/vanna/` + `/solve/find-rows-with-no-match…` (2 each), spread of `/solve` + `/blog` singles. Referral: google 7 (→ `/vs/vanna/` ×2, `/solve/`, `/vs/`, `/agents/`, `/manifesto/`) | cut rule: `bot=1` / `userAgentBrowser ∈ {Unknown, ChromeHeadless}` / CF-bot ⇒ real-browser is a floor. Unsampled (sampleInterval 1) — counts exact |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev — live remote-D1 07-27; no channel newly live to produce a signal. **Dark** (rule 8) — moves only on launch |
| 3 | DBs total | **254** (07-27 live remote-D1) + **1 dogfood** (`db_agent_memory_v1_3a8a72`, internal) | stranger subset ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not measurable** (`SK-ONBOARD-007`). The **dogfood workload** (run 176): **100 % (10/10)** through the public MCP surface (= gate criterion 2) | target ≥ 95 %. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12; founder-owned) | share with ≥ 2 asks |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **112** content pages (`/solve` **41** + `/vs` 31 + `/blog` 40; unchanged this run — CTR lever, not a new page). Unpublished blog drafts **0** (queue drained) | leading input to rows #1–#3; `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **40** + **dev.to variant drained this run** (`decided-questions-rot-in-your-decision-log` → [dev.to](https://dev.to/omer_hochman/an-open-question-thats-already-decided-is-worse-than-one-thats-still-open-3619); **10 variants remain**). **GSC live 09-03** (28d 08-04→08-31): **9 clicks / 866 impr / pos 26.7** (flat vs 9/858/26.6 @ 09-02). **CTR lane exhausted:** the page-1 zero-click pages already carry hand-written SERP meta — `count-rows-per-day…` (pos 7.1 / 54 impr, metaed run 183) + `countif-sumif` (pos 5.7 for "postgres countif", metaed run 190) — snippet is no longer the lever; both still 0-click ⇒ position/authority-gated. GSC "Strengthen next" leaders (`/solve/` index pos 35.1 / 91 impr, `running-total…` pos 42.6 / 64 impr) are page-2/3+. Referral (live 09-03): google 7 | `gsc-pull.ts` + `rum-pull.ts`. Page-1 zero-click CTR pool metaed-out; page-2+ authority/launch-gated |
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
| 15 | E2E manual-suite freshness | **0.14 → 0.64 (this run's lever)** — sdk + examples had decayed to freshness 0 (last success 08-22, 11 d); re-dispatched both on `main@1fbd3e4` this run: **sdk ✅ ([run 33578892318](https://github.com/nlqdb/nlqdb/actions/runs/33578892318)) + examples ✅ ([run 33578894339](https://github.com/nlqdb/nlqdb/actions/runs/33578894339))**, freshness 1.0 each; **mcp ✅ 0.57** (last success 08-30, PR trigger); opencheck **0** (07-17, dark — costs money, rule 4). Score = mean(pass×freshness) over 4 = (1+1+0.57+0)/4 | Never dispatch opencheck alongside another lane consumer. Triage: `e2e-coverage/opencheck-operations.md`. Re-dispatch is a lever candidate (workflow_dispatch, agent-runnable) — pulled runs 182, 193 |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.5382); agentic-frontier ≥ 0.80 (0.693); TTFV p50 ≤ 60 s (awaits strangers); first-10 ≥ 95 % (stranger N=0); destructive-op retry (N≈0); MCP in 3+ hosts (0); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **≈12** (unchanged — not this run's lever). Lane-3 meta — reported not pulled | target ↓ 0 |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** — swept run 166; docs-only diff. GSC still shows the `http://` variant of `/solve/count-consecutive-days-streak-in-sql/` indexed (25 impr, pos 15.6) → splits signal with the https canonical; the redirect exists but Google indexed http — the fix is a zone Redirect Rule (console click, founder territory, standing blind spot) | target 0. Standing blind spots: external inbound links to bare paths, `www.`/`http://` host un-redirected (zone Redirect Rule ⇒ console) |
| | **Product-readiness** — client-blocking gaps | | |
| 19 | Live-surface claim integrity | **0 ✓** (resolved 07-29): `#826` published `@nlqdb/sdk@0.2.2` + `@nlqdb/mcp@0.1.1`; a clean-dir install resolves `dist/` entrypoints | target 0 ✓ |
| 20 | Hosted-premium readiness (§6 build-before-signal) | **LIVE 08-14** — `premium.live=true` in prod (`premiumConfigured(env)`). schema ✅ · BYOLLM lanes ✅ · picker web ✅ + parity ✅ · CTA ✅ · **premium chain ✅ live** (#987 meter, #992 bring-back, #996 live-lane billing, #1001 free-chain fallback) · spend-cap UI ⬜ (Lago-parked) | paid plan **shipped**; §6 signal effectively tripped. Meter fires; $0 while no paying customer |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **FLOW-005 re-walked live run 184: 6/6 PASS** (curl-based MCP discovery + auth-wall, agent-runnable). **Playwright walker launch fixed run 194** — `browser.ts` now falls back to the prebuilt Chromium when the pinned revision is absent, so it launches in-container (was: download-attempt fail on the `chromium-1234` pin). Full walk still **CI-canonical** (`acquisition-health.yml`): the sandbox's proxy-stripped direct egress blackholes UDP/443 ⇒ cross-host nav intermittently `ERR_QUIC_PROTOCOL_ERROR` (~2/3 runs fail step 1), so no reliable container pass-count; carried **0 failed / 9 blocked** from 07-26. #999 (08-16) fixed the `/app/new/` 428 dead-end | target **0 `failed`** ✅; anon walks stop at the 428 `challenge_required` (Turnstile, `SK-ANON-012`) |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 22 | Channels live with attributable yield | **4 live** — organic search + dev.to + npm + GitHub. MCP official registry published 07-22; Glama crawl-listed; Smithery/PulseMCP 0. First-touch attribution live since 07-19; `source_json` non-null **0**, for want of strangers, not instrument | **weekly focus (superseded): → ≥ 5 live.** Growth comes only from not-yet-live channels (R-05 registries, human-norm venues) |
| | **Human queue** — the one non-automatable actor | **depth 2+**; head is the Show HN launch, oldest bullet **81 days** (`SK-PIVOT-016` gate **2/5**; criterion 4 at 5/7 golden); #2 Anthropic connector directory (money-gated, 07-21); registry-submit payloads (PulseMCP/mcp.directory) parked last by `/reach` run 1081 | [`blocked-by-human.md`](blocked-by-human.md). Open PRs: **1** (#1087 changeset-release) at step 0 |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/27 + 12 memory `/vs` pages | mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; rest Neon/infra-gated |
| | Dogfood track D-* (`SK-PIVOT-016` gate, **weekly focus**) | **3/7** (D-01 ✅, D-03 ✅, D-04 🟡, **D-06 🟡**) — gate **2/5** (criterion 2 green from D-04's 100 % first-10; criterion 5 green on #978's `/agents` `ag-dog` dashboard). Remaining: criterion 1 (12 → ≥100 real MCP asks, grind); criterion 3 (silent-wrong-answer, E-09-blocked); criterion 4 (temporal) — golden **5/7** (run 192; only q19 ops + q4 synthetic miss, both query-shape within ±5 pp noise ⇒ query-shape/pack-recipe lever, not grinding). D-06 run 2 + D-04 `NLQDB_MEMORY_DB` var still open | mirrors [`dogfood/INDEX.md`](features/agent-memory-pivot/worksheets/dogfood/INDEX.md) |
| | Memory-quality eval (`SK-QUAL-023`) | **39-q free-chain EX 79.49 % (31/39)** — current-main same-window baseline [33132370698](https://github.com/nlqdb/nlqdb/actions/runs/33132370698) (2026-08-28). Per-axis: consolidation 6/7, forgetting 6/7, temporal 9/11, retrieval 5/7, analytical 5/7. ≥ 70 % weekly target **MET**. The 2 temporal misses (q4 synthetic range scan + q19 ops `blocked` over-joins episodes) are query-shape within the ±5 pp noise floor. Next engine lever candidate: a full BIRD/Spider re-measure on the post-#1041 planner head (rows #8/#9) | 39 gold-verified questions, 5 axes; free-only, no baseline |

## Shipped distribution

**41 canonical `/solve` pages** + **40 `/blog` posts** + **31 `/vs` pages** live under `nlqdb.com/`
(`SK-SOLVE-001` / `SK-BLOG-001` / `SK-CMP-001`). The registries are `apps/web/src/data/{solve,blog,competitors}.ts`.

- **This run (194):** drained one dev.to variant — `decided-questions-rot-in-your-decision-log` →
  [dev.to](https://dev.to/omer_hochman/an-open-question-thats-already-decided-is-worse-than-one-thats-still-open-3619)
  (**10 variants remain**). No new `/blog` page (blog-draft queue empty). Lane-2 UX-flow instrument lever (row #21 walker launch fix).
- **Run 193:** drained `emit-metrics-where-the-distinction-is-certain` →
  [dev.to](https://dev.to/omer_hochman/your-metric-is-only-as-honest-as-the-layer-you-emit-it-from-54ma)
  (11 remained). Lane-2 UX-flow (E2E freshness) lever run.
- **Run 192:** drained one dev.to variant — `rotate-encryption-key-without-a-version-column` →
  [dev.to](https://dev.to/omer_hochman/you-need-to-rotate-an-encryption-key-you-dont-need-a-key-version-column-1h50)
  (12 variants remained). Weekly-focus measurement-reconciliation run.
- **Run 191:** drained one dev.to variant — `text-to-sql-planner-told-wrong-dialect` →
  [dev.to](https://dev.to/omer_hochman/you-added-a-second-sql-engine-your-text-to-sql-model-is-still-being-told-its-the-first-one-2d92)
  (13 variants remained). Weekly-focus engine/schema lever run.

## Last change

**2026-09-03 (run 194)** — **LANE-2 UX-FLOW INSTRUMENT: row #21 Playwright walker made container-runnable — pin-mismatch launch block fixed; residual block re-diagnosed as sandbox UDP egress.**
No stranger-facing funnel/engine/distribution *metric* was cleanly pullable (weekly-focus criterion 4 query-shape within ±5 pp noise + anti-rut; CTR row #7 exhausted; engine dark; strangers N=0), so
per step-2 order the lane was lane-2 (UX-flow instrument). **Root cause:** `@playwright/test` 1.60 pins `chromium-1234`, absent in the sandbox (prebuilt `chromium-1194` at the `/opt/pw-browsers/chromium`
symlink), so `launchBrowser()` attempted a download and failed — that is what "not container-runnable (Chromium pin mismatch)" was. **Change:** `browser.ts` falls back to the prebuilt Chromium when the pin
is absent (no-op in CI, which `playwright install`s the pin; overridable via `NLQDB_STRANGER_CHROMIUM`) + stale `AGENTS.md` note (claimed 1.49.x/`chromium-1148`) corrected (D5). **Verified both ways:**
before = launch fails on the absent pin; after = `launchBrowser()` launches and walks flow-002 steps 1–7 live. **Honest limit:** full walk stays CI-canonical — the proxy-stripped direct egress (`SK-STRG-001`,
untouched) blackholes UDP/443 so cross-host `app.nlqdb.com` nav intermittently `ERR_QUIC_PROTOCOL_ERROR`s (~2/3 of runs fail step 1); no reliable container pass-count, so row #21's Playwright cell stays
0-failed/9-blocked (CI-instrumented). What moved: the **launch capability (broken→fixed)** + the **corrected root-cause** (pin→egress). **KPI (GLOBAL-025 — UX pillar):** instrument reach widened, blocker
record made honest. No KPI degrades — `typecheck`/`check`/`test` + 51 stranger-test unit tests green; fallback inert in CI. **Null-shaped on funnel metrics.**

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
