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
Acquisition levers stay pullable when no dogfood lever is — as does premium-chain work
(`SK-LLM-017`, row #20), one rank below.

**Worst number today (run 177, 2026-08-12):** the **weekly-focus `SK-PIVOT-016` dogfood gate**
(**1/5**) is still the worst number. This run pulled the gate's **only remaining agent-movable,
GLOBAL-037-unblocked criterion**: criterion 5, the public `/agents` memory dashboard (**D-06 run 1**).
Criteria 3 and 4 are E-09/GLOBAL-037-blocked; criterion 1 (12 → ≥100) is grind-only. So D-06 run 1
**built the criterion-5 surface**: a server-rendered `ag-dog` block on `/agents` that renders
nlqdb's **real** memory-DB aggregates (from D-04's prod-verified `db_agent_memory_v1_3a8a72`:
13 facts / 9 entities / 12 MCP asks / first-10 100 %) + two GROUP-BY result tables + the **as-of date
(2026-08-11)** + the one ask that broke ("here's what broke"). Data lives in a committed
aggregates-only snapshot (`agentMemory.data.json`) a generator refreshes out of `astro build`
(GLOBAL-013); a 7-invariant test guards asOf/staleness/aggregates-only. **Criterion 5 goes green on
deploy of this PR → gate 2/5.** The number moved: criterion 5 **unshipped → built & shipping**.
**Weekly-focus gate (don't overwrite the /weekly-set target mid-week):** dogfood **1/5** (2/5 on deploy).
**Top `blocked-by-human` bullet:** fire the Show HN launch sequence (⏱ ~30 min,
**idle 60 days since 06-13**) — the only bullet that can move real strangers off 0, still
condition-gated on the `SK-PIVOT-016` gate (now **1/5**, 2/5 on this PR's deploy). #2 = submit nlqdb to
the Anthropic **connector directory** (money-gated, since 07-21). Queue **depth 2**, head age 60 d is the real cycle time.
**Dark (rule 8, reported not pulled):** engine **#8 BIRD 0.5382** (16 d) / **#9 Spider 0.2222** (**23 d**
stale — resume deferred: async multi-window, `main` moved since the 07-27 checkpoint); rows **#2/#4/#5/#16**
stranger-dependent (N = 0 until launch); row **#15** opencheck (free-lane saturation, remedy costs money ⇒
rule 4); dogfood criterion 4 (E-09 GLOBAL-037-blocked) + criterion 3 (same root).

**Rule 6 — GREEN.** Branch based on `main@719b58e` (#976). Health re-measured live this run: `bun install`
restored container-lost deps; **`typecheck` exit 0** (all 21 packages), **`bun run lint` exit 0** (43
pre-existing warnings, +2 `noConsole` in the new generator script consistent with existing `scripts/`, 0
errors), **`@nlqdb/web check` 0 errors**, **new `agentMemory.test.ts` 7/7**, **`@nlqdb/web build` exit 0**
(the `/agents` block renders in `dist/` with the real numbers). `deploy-api` + `deploy-web` latest `main`
runs both success. This run's diff adds a web data module + test + generator + the `/agents` block, plus
docs — scoped, all gates green. **Open PRs (1, checked step-0):** draft **#719** (Infisical, oldest **26 d**);
#975/#977/#976 merged since run 176. My files touch no open-PR files.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel, bot-filtered** (RUM **re-pulled live 08-11** (`rum-pull.ts`, 7d, unsampled); GSC **re-pulled live 08-11** (`gsc-pull.ts`, 28d). Users/DBs carried from 07-27 remote-D1, no channel newly live) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF RUM) | **251 pl / 250 vis** raw, **real-browser floor 48 pl / 47 vis** (re-pulled 08-11; 203 synthetic cut). Real-browser landings led by `nlqdb.com/` (**12**), `docs.nlqdb.com/agent-memory/` (6), `docs.nlqdb.com/` (5), `app.nlqdb.com/app/new/` (3) | cut rule: `bot=1` or `userAgentBrowser ∈ {Unknown, ChromeHeadless}` or CF-classified bot ⇒ real-browser is a floor. Read at **7d** (28d comes back sampled) |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev — live remote-D1 07-27; no channel newly live to produce a signal. **Dark** (rule 8) — moves only on launch |
| 3 | DBs total | **254** (07-27 live remote-D1) + **1 dogfood** created this run (`db_agent_memory_v1_3a8a72`, internal) | stranger subset ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not measurable** (`SK-ONBOARD-007`). But the **dogfood workload** first-measured this run: **100 % (10/10)** through the public MCP surface (= gate criterion 2) | target ≥ 95 %. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12; founder-owned) | share with ≥ 2 asks |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **110** content pages (`/solve` 40 + `/vs` 31 + `/blog` 39); **118** sitemap URLs submitted / 0 indexed (GSC sitemap read 08-11) — **unchanged this run** (dogfood lever run, no new surface). Unpublished blog drafts **0** | leading input to rows #1–#3; `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **39** (no new surface — this is a dogfood lever run). **GSC re-pulled live 08-11** (28d): **9 clicks / 593 impr / pos 19.4** — flat vs 08-10 (9 clk / 599 impr). Top-impression page `/solve/running-total-cumulative-sum-in-sql/` **109 impr / pos 35.6 / 0 clicks** (still page-4, biggest wasted-impression surface; content already complete — ranking bottleneck is domain authority, not on-page). Strengthen-next #2: `/solve/find-rows-with-no-match-in-another-table/` **60 impr / pos 17.2** (page-2). **Referral yield (RUM 08-11):** 4 pl from 2 external referrers (google 3, bing 1) | `gsc-pull.ts` + `rum-pull.ts`. Total-impression breadth is the bottleneck, not per-page CTR at low N |
| | **Engine** — BIRD 07-26 · Spider 07-19 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.5382** (268/500, 07-26 canonical on `d961475`, [run 30212657876](https://github.com/nlqdb/nlqdb/actions/runs/30212657876)) — **16 d old, staleness trigger fired**, but **dark (rule 8)**: resume is async multi-window and `main` moved since the 07-27 checkpoint | target 0.65 / **Phase 2 floor 0.60** — gap 6.2 pp. Offline levers exhausted |
| 9 | Spider raw EX | **0.2222** (30/135, 07-19 canonical on `04fa3d0`, **23 d old**). 07-27 re-dispatch exited **partial** (`SK-QUAL-013` budget-stop) | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004)) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67 % → agentic 69.33 %, 150-q smoke, 07-06, `SK-QUAL-022`) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69 < the 0.80 floor (row #16) |
| | **Ops** — 7d, CF Workers analytics (live 07-27 09:25Z) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | **2,185 / 0** (0.00 %, 07-27 read) | mcp-server 1,627 / 0; web 11,310 / 0; events-worker 3 / 0 — zero errors across all four workers |
| 13 | nlqdb-api wall-time p50 / p95 | **p50 16.4 ms / p95 1.48 s** (07-27) | mcp-server p50 691.3 ms / p95 1.30 s. `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers — D-04 run 1 confirmed $0 (free-tier Neon DB + free LLM chain) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **~0.30** (time-decayed from 0.420 @ 07-28; no suite re-dispatched since). Per suite: **mcp** (✅ 07-25) · **sdk** (✅ 07-24) · **examples** (✅ 07-24) · **opencheck 0** (last success 07-17 ⇒ freshness floored — NVIDIA-free-tier saturation flake, remedy costs money ⇒ rule 4) | Never dispatch opencheck alongside another lane consumer. Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.5382); agentic-frontier ≥ 0.80 (0.693); TTFV p50 ≤ 60 s (awaits strangers); first-10 ≥ 95 % (stranger N=0); destructive-op retry (N≈0); MCP in 3+ hosts (0); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **≈12** (unchanged — not this run's lever). Lane-3 meta — reported not pulled | target ↓ 0 |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** — swept run 166; docs-only diff this run. Verified live 08-11: the GSC-indexed no-slash/`http://` variants (`/vs/wrenai`, `/agents`, `http://…/count-consecutive-days…`) all **301** to canonical (no defect) | target 0. Standing blind spots: external inbound links to bare paths, `www.`/`http://` host un-redirected (zone Redirect Rule ⇒ console click) |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **0 ✓** (resolved 07-29): `#826` published `@nlqdb/sdk@0.2.2` + `@nlqdb/mcp@0.1.1`; a clean-dir install resolves `dist/` entrypoints | target 0 ✓ |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ + parity ✅ · CTA ✅ · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | paid plan built before the signal fires |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **0 failed / 9 blocked** — carried from 07-26; **not re-walkable from a `/daily` container** (Playwright pins Chromium 1223, image ships 1194 → walker aborts). CI-only | target **0 `failed`** ✅; all walks stop at the 428 `challenge_required` (Turnstile, `SK-ANON-012`) |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 22 | Channels live with attributable yield | **4 live** — organic search + dev.to + npm + GitHub. MCP official registry published 07-22; Glama crawl-listed; Smithery/PulseMCP 0. First-touch attribution live since 07-19; `source_json` non-null **0**, for want of strangers, not instrument | **weekly focus (superseded): → ≥ 5 live.** Growth comes only from not-yet-live channels (R-05 registries, human-norm venues) |
| | **Human queue** — the one non-automatable actor | **depth 2**; head is the Show HN launch, oldest bullet **59 days** (`SK-PIVOT-016` gate **1/5**); #2 Anthropic connector directory (money-gated, 07-21) | [`blocked-by-human.md`](blocked-by-human.md). Open PRs: **1** — draft **#719** (oldest, 25 days) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/27 + 12 memory `/vs` pages | mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; rest Neon/infra-gated |
| | Dogfood track D-* (`SK-PIVOT-016` gate, **weekly focus**) | **3/7** (D-01 ✅, D-03 ✅, D-04 🟡, **D-06 🟡 run 1 built this run**) — gate **1/5** (criterion 2 green; **criterion 5 green on this PR's deploy → 2/5**). **D-06 run 1 (2026-08-12):** built the public `/agents` memory dashboard (`ag-dog` block) rendering D-04's real prod aggregates + 2 GROUP-BY tables + as-of date + published failure; committed aggregates-only snapshot + generator (out of `astro build`) + 7-invariant test. Remaining: D-06 run 2 (staleness-CI red + demand-signal); D-04 `NLQDB_MEMORY_DB` var + run-2 readout | mirrors [`dogfood/INDEX.md`](features/agent-memory-pivot/worksheets/dogfood/INDEX.md) |
| | Memory-quality eval (`SK-QUAL-023`) | **27-q free-chain EX 59.26 % (16/27)** — run 30413719690 (2026-07-29). Temporal 2/7 (synthetic 2/3, ops 0/4) — the weak axis gating criterion 4, E-09/GLOBAL-037-blocked | 27 gold-verified questions, 5 axes; free-only, no baseline |

## Shipped distribution

**40 canonical `/solve` pages** + **39 `/blog` posts** + **31 `/vs` pages** live under `nlqdb.com/`
(`SK-SOLVE-001` / `SK-BLOG-001` / `SK-CMP-001`). The registries are `apps/web/src/data/{solve,blog,competitors}.ts`.

- **This run (177):** new surface — the **`/agents` public memory dashboard** (D-06 run 1, criterion 5),
  live on deploy. Unpublished-drafts queue depth 1 (< 3) ⇒ no forced-publish; **dev.to drip posted** the
  oldest pending variant `http-200-error-in-body`
  (https://dev.to/omer_hochman/your-text-to-sql-eval-is-lying-the-gateway-returns-http-200-with-the-error-in-the-body-4i8i);
  one new draft added (`the-live-metric-on-your-marketing-page-is-a-credential-leak-waiting`, D-06's lesson).

## Last change

**2026-08-12 (run 177)** — **Lever run: built the dogfood gate's criterion 5 — the public `/agents`
memory dashboard (D-06 run 1). Weekly-focus number `SK-PIVOT-016`: criterion 5 unshipped → built &
shipping (gate 1/5 → 2/5 on deploy of this PR).**

Criterion 5 is the gate's **only remaining agent-movable, GLOBAL-037-unblocked criterion**: 3 and 4 are
E-09/GLOBAL-037-blocked (value-sampling is forbidden egress), and criterion 1 (12 → ≥100) is grind. So
this run built the criterion-5 surface end-to-end, `$0`, following the D-06 worksheet's **default
mechanism** (a committed aggregates snapshot with the as-of date printed — not a live credential; the
"Open founder call" default stands, P1-compliant, not silently loosened).

**Number moved (weekly focus): criterion 5 unshipped → built & shipping.** A server-rendered `ag-dog`
block now sits on `/agents` between the demo and replacement beats, rendering nlqdb's **real** memory-DB
aggregates from D-04's prod-verified `db_agent_memory_v1_3a8a72` (13 facts / 9 entities / 0 episodes;
`open_question 11` / `blocked 2`; `feature 7` / `queue_item 2`; 12 MCP asks; first-10 100 %), two
GROUP-BY golden-query result tables, the **as-of date (2026-08-11)**, and the one ask that broke
("here's what broke", SK-PIVOT-019). Files: `agentMemory.data.json` (committed aggregates-only snapshot),
`agentMemory.ts` (types), `agentMemory.test.ts` (7 invariants — asOf is a real past date, staleness
bound set, distributions ≤ table counts, golden queries are real GROUP-BYs with rows, **aggregates-only
recursive walk** rejects any `content`/`body`/`text`/`value`/`embedding` key, the gap is published),
`scripts/gen-agent-memory.mjs` (the generator D-02's `memory-sync.yml` runs to refresh the JSON from the
live DB via aggregate `/v1/run` reads — **out of `astro build`**, GLOBAL-013; a clean no-op when the key
is unset), and the `/agents` block + styles.

**Verified:** `@nlqdb/web check` 0 errors; `agentMemory.test.ts` 7/7; `bun run typecheck` + `bun run lint`
exit 0; `@nlqdb/web build` exit 0 with the block rendering the real numbers in `dist/agents/index.html`;
the generator no-ops cleanly with env unset.

**Remaining:** D-06 run 2 (the CI staleness-red test + the demand-signal event per GLOBAL-024). D-04's
`NLQDB_MEMORY_DB` var + run-2 readout still open. Criterion 5 flips **green in the gate table on deploy**.

**Four-null check.** Runs 176 (delta) / 175 (delta). This run is a real delta ⇒ no four-null territory.
**Anti-rut (rule 7):** recent levers were dogfood (176), dogfood (175), null (174), distribution (173) —
not 5 identical; the weekly focus is the dogfood gate, and this is a distinct sub-lever (a shipped surface,
not the workload run).

**Step 3 (artifact):** unpublished-drafts queue depth 1 (< 3) ⇒ no forced-publish; **dev.to drip posted**
`http-200-error-in-body`; one new draft added (D-06's honest-public-metrics lesson). **KPI (GLOBAL-025):**
advances **UX** (a real proof surface a visitor can read and believe) and **onboarding** (the `/agents`
wedge now shows live evidence the pattern works); **degrades none** — additive web module + block + docs,
all gates green, no endpoint or existing behavior touched.

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
