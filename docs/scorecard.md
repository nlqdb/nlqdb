# Scorecard — current state

Point-in-time tracker, regenerated each
[`/daily`](../.claude/commands/daily.md) run. Current state only — no changelog
(≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md` (engine).

**Weekly focus number (2026-07-11 → 07-18):** **row #15 E2E freshness →
1.0** — close the opencheck stale-fixture red and keep all four suites
fresh. **Why:** it is the worst *agent-movable* number outside the daily
engine lane, which already pulls row #9 Spider (run 51, #664). BIRD
(row #8, 0.546 < the 0.60
[`GLOBAL-025`](decisions/GLOBAL-025-north-star.md) floor) is
**dark for the lever** — offline levers exhausted, SC dead (#619),
frontier-lens closed (run 15); the only remaining path, the corrected-set,
is blocked on an external maintainer's license reply (uiuc-kang-lab #7,
filed 07-07, no response), so no single run can move it — `SK-QUAL-005`'s
engine-work mandate stands lever-blocked and re-binds the focus once any
engine lever unparks. Row #15 state: sdk/mcp/examples fresh (07-12 04:13Z);
opencheck's first green main run landed 07-12 13:18Z (depth=a Suite A 5/5,
[29194166944](https://github.com/nlqdb/nlqdb/actions/runs/29194166944));
open PR #672 carries the adoption-ACL root fix + a failed depth=ab
re-verify on its branch (its named follow-up — not this run's to touch).
With #15 near its ceiling pending #672, run 58 pulled the next-priority
lever per the founder-directed UX-flow-first ordering (PR #667): **row #21
walker re-true** — see *Worst number* and *Last change*.

**Worst number today:** real strangers reaching a first answer = **0**
(row #2; the run-56 428-wall fix is live — deploy-api succeeded on
`cba08af` 07-12 13:03Z — so the funnel is open but unwalked by real
strangers; instruments now measure reality). The worst *agent-movable*
number was **row #21 stranger-walker pass rate 0/9**, red since ≥ 07-05:
FLOW-003's class was the 428 wall (fixed run 56); FLOW-001/002 +
flow-005-stdio were **walker drift** — the walkers asserted the
pre-redesign surface (hero input on `/`, old honest-limits heading, 4-tool
MCP catalog) while the shipped product moved on (two-door home with the
goal input on `/app/new/`, "doesn't *try to* do here" copy, 5-tool catalog
with `nlqdb_connect_database` + the `model` key). **Run 58 lever: re-true
every drifted walker to the shipped surface** — measured before → after on
the same instruments (see *Last change*). Not anti-rut-blocked (last 5
merged = anonymous-mode/UX, E2E-dispatch, CLI-release, E2E-diag,
weekly-process — this run is walker/verification integrity).

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (fresh 07-12 16:16Z pull — CF GraphQL + remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 114 visits / 137 pageloads (07-05→07-12 16:16Z, raw). Walker filter (run 12, `userAgentBrowser` cut): "Unknown" 67 + headless 1 ⇒ **real-browser ≈ 46 visits** (Chrome 38, ChromeMobile 3, MobileSafari 2, Firefox 2, Edge 1) | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (re-verified 07-12 16:15Z). The 428 wall is gone (run 56, live since 13:03Z); acquisition now depends on distribution yield |
| 3 | DBs total | **157**; latest created 07-12 15:48Z, latest queried 07-12 16:10Z (both synthetic — newest first10-counted row belongs to `test@example.com`; previews share prod D1) | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not yet measurable** (07-12 16:15Z remote-D1; method `SK-ONBOARD-007`). Only 3/157 DBs have `first10_asks > 0`, all founder/test (2/2 founder, 1/1 test, old 0/1) | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12 16:15Z; founder-owned) | share of DBs with `first10_asks ≥ 2` |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **97** (`/vs` 31 + `/solve` 33 + `/blog` 33). Pending drafts **2** on this branch (run 55's `green-checkmark-has-a-half-life`, run 58's `smoke-test-walks-the-old-ui`; open #672 adds a third on merge) ⇒ < 3 at draft time ⇒ step 3 drafted (no publish) | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts 33; 7d external referrals = **9** (bing 8, github 1 — 07-12 16:16Z pull; was 9 on 07-12 11:05Z, 6 on 07-09, 1 on 07-06). Syndication feeds 1 (`/rss.xml`); internal links **2,883** (run-58 build: 117 pages, 0 dead — row #18) | CF `refererHost` — measured every run. External-referral yield holding (bing-led) as indexation lands |
| | **Engine** — BIRD 07-11 · Spider 07-11 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.546** (272/498 EA, 2 `gold_error`, 07-11 canonical on main `2cfda39`, [run 29144102081](https://github.com/nlqdb/nlqdb/actions/runs/29144102081) — completed in ONE window, `no_sql` 0/500, first fully capacity-clean canonical). Δ +2.01 pp vs 07-05, McNemar b=31/c=41, `regressions: []`. Baseline re-seeded. Measured pre-`SK-LLM-044`; next canonical re-verifies | target 0.65 / **Phase 2 floor 0.60** — gap 5.4 pp. Offline levers exhausted; SC dead (#619); frontier-lens closed (run 15) |
| 9 | Spider raw EX | **0.2963** (40/135, `no_sql` 0/135, exec_error 3, gold_error 0 — 07-11 canonical on `6e1725c` with `SK-LLM-044`, nine-window `SK-QUAL-013` resume [29160009809](https://github.com/nlqdb/nlqdb/actions/runs/29160009809) → [29164092490](https://github.com/nlqdb/nlqdb/actions/runs/29164092490)). Was 0.2741 (37/135, run 49's first fully-answered run) | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is its source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004) — flat vs 07-02) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06 run 15, `SK-QUAL-022`). persona-bench −4.35 pts (07-09, one-question noise at N=23) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69–0.70 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers analytics (fresh 07-12 16:16Z pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 5,375 / 0 (0.00%) | mcp-server 394 req / 0 err; events-worker 31 req |
| 13 | nlqdb-api wall-time p50 / p95 | p50 ≈ 0.61 s / p95 ≈ 1.67 s | mcp-server p95 ≈ 762 ms this window; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **≈ 0.94** at 16:45Z — sdk ✅ · mcp ✅ · examples ✅ all 07-12 04:13Z on main (run 55's dispatch, ≈0.93 each) · opencheck ✅ first green main conclusion 07-12 13:18Z (depth=a Suite A 5/5, [29194166944](https://github.com/nlqdb/nlqdb/actions/runs/29194166944), ≈0.98). Open #672 owns the deeper fix + its failed branch depth=ab re-verify | Sequencing rule (unchanged): never dispatch opencheck alongside another consumer of its lanes. Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.546, 07-11); agentic-frontier ≥ 0.80 (0.693, Δ 18.66 ✓); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (stranger N=0); destructive-op retry < baseline (instrumented run 38, N≈0); MCP in 3+ host apps (07-11: 0 stranger hosts, 1 founder host — FAIL); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 removed the 428 wall |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **17** (fresh grep 07-12 run 58 — held) | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. De-prioritised as a default lever per the 07-11 /weekly (monoculture, no external yield) |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting** (07-12 run-58 sweep: **117** pages, **2,883** internal links — unchanged vs run 56) | target 0 — `bun run build && bun run check:links` in `apps/web` |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **1 open (founder-blocked)** — `brew install nlqdb/tap/nlq` advertised (`cli/README.md`, npm-shim fallback, SK-CLI-002) but the tap empty since 2026-05-19; blocked on the `HOMEBREW_TAP_GITHUB_TOKEN` PAT (top `blocked-by-human.md` bullet); releases no longer fail on it (run-54 fix, #669). Runs 32 + 37 + 56 each found + closed 1 | claim-vs-reality on shipped surfaces + docs; target 0. Standing candidate: extend `check:links` to assert each advertised capability has shipped code |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) · picker parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal; only genuine remaining slot is the premium chain |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **6/9** + both FLOW-005 transports ✅ (was 0/9 since ≥ 07-05; run-58 re-true, dispatch [29200271657](https://github.com/nlqdb/nlqdb/actions/runs/29200271657) 16:31Z). FLOW-002 3/3 · FLOW-003 3/3 (428 fix confirmed live; TTFV p50 4.2 s) · flow-005 hosted 6/6 + stdio 22/22 · verify-flows 0 fails. FLOW-001 0/3: 2× **real** — `/app/new` first-answer surface has no trace toggle (SK-WEB-005/GLOBAL-023 gap, unmasked now the walls are gone — **named next lever**), 1× submit flake | target 9/9 + both FLOW-005 transports. This row exists so a red walker can never again be silent (GLOBAL-032 freshness rule assumed *pass* freshness, not just run freshness) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/20 + 12 memory `/vs` pages | tick on merge; mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — the only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; E-03…E-07 all Neon/infra-gated |
| | Memory-quality eval (`SK-QUAL-023`) | harness shipped — EX unmeasured | 15 gold-verified questions, 4 axes; a scored dispatch + the vector head-to-head are the next slices |

## Shipped distribution (live URLs)

Canonical copies on `/blog` (`SK-BLOG-001`); venue variants stay in
`research/distribution-queue.md` as pointers:

- https://nlqdb.com/blog/ephemeral-staging-persistent-registry/ (run 56 — CI/test-infra lesson, the SK-E2E-007 spin-up purge: an environment is only as ephemeral as the most persistent store that references it)
- https://nlqdb.com/blog/ownership-transfer-outlives-least-privilege/ (run 54 — Postgres multi-tenancy lesson, the SK-ANON-003 adoption ACL gap: an ownership transfer must retarget every authorization store; a catch-all must log the code it swallows)
- https://nlqdb.com/blog/most-active-user-is-your-test-suite/ (run 53 — measurement-hygiene lesson, the funnel bot-filter: a metric that doesn't name its population is measuring your robots; filter at read time)
- https://nlqdb.com/blog/five-fallback-models-one-provider/ (run 51 — CI/engine lesson, the opencheck lane swap: redundancy must cross the failure-domain boundary; the lane, not the model, is the fallback unit)
- https://nlqdb.com/blog/decided-questions-rot-in-your-decision-log/ (run 49 — decision-hygiene lesson, the row #17 docs-ambiguity method: resolved is a greppable state; unmarked decided bullets are counted debt)
- https://nlqdb.com/blog/emit-metrics-where-the-distinction-is-certain/ (run 47 — instrumentation lesson, `SK-TRUST-004` retry-rate emit point: emit where the distinction is certain, thread facts down)
- https://nlqdb.com/blog/rotate-encryption-key-without-a-version-column/ (run 44 — `GLOBAL-031` KEK rotation: version in the self-describing ciphertext prefix, not a `key_version` column)
- https://nlqdb.com/blog/text-to-sql-planner-told-wrong-dialect/ (run 40 — thread the row's real engine into the dialect field; twin of the validator post)
- https://nlqdb.com/blog/postgres-validator-rejects-valid-clickhouse-sql/ (run 35 — SK-MULTIENG-004: wrong-dialect parse = "wrong parser," not "dangerous query")
- https://nlqdb.com/blog/agent-memory-benchmarks-measure-recall-not-analysis/ (SK-QUAL-023 research finding; anchors `/solve/analytical-queries-over-agent-memory`)
- https://nlqdb.com/blog/blog-without-a-feed-is-a-dead-end/ (run 31 — count the doors into your content, not the pages)
- https://nlqdb.com/blog/one-way-internal-links-leak-yield/ (run 28 — measure the link graph, not the page count)
- https://nlqdb.com/blog/agent-memory-vector-store-aggregation-gap/ (run 53 — anchors `/vs/pinecone`)
- https://nlqdb.com/blog/store-form-submissions-without-a-backend/ (run 106 — anchors `/solve/store-form-submissions-without-backend`)
- https://nlqdb.com/blog/not-in-subquery-null-trap/ (run 130 — anchors `/solve/find-rows-with-no-match-in-another-table`)
- https://nlqdb.com/blog/zep-recall-vs-analytical-agent-memory/ (run 20 — anchors `/vs/zep`)
- https://nlqdb.com/blog/null-timestamp-ttl-sweep-funnel-metric/ (run 2 — engine lesson)
- https://nlqdb.com/blog/mcp-server-what-does-the-agent-own/ (run 102 — anchors `/vs/hex`)
- https://nlqdb.com/blog/text-to-sql-accuracy-schemas-your-users-never-build/ (run 55 — engine lesson, persona-bench/SK-QUAL-018)
- https://nlqdb.com/blog/ai-internal-tool-builder-faster/ (run 67 — anchors `/vs/retool`)
- https://nlqdb.com/blog/offline-llm-eval-rate-limits/ (run 68 — engine lesson, SK-QUAL-013 capacity honesty)
- https://nlqdb.com/blog/sitemap-advertising-redirects/ (run 69 — engine lesson, trailing-slash canonical/sitemap hygiene)
- https://nlqdb.com/blog/text-to-sql-build-vs-buy/ (run 109 — anchors `/solve/add-ask-your-data-feature-without-building-text-to-sql`)
- https://nlqdb.com/blog/find-duplicate-rows-you-re-google-every-time/ (run 119 — anchors `/solve/find-duplicate-rows-in-my-data`)
- https://nlqdb.com/blog/your-bi-tool-got-acquired-data-layer/ (run 110 — anchors `/vs/mode`)
- https://nlqdb.com/blog/top-n-rows-per-group/ (run 131 — anchors `/solve/find-top-n-rows-per-group`)
- https://nlqdb.com/blog/http-200-error-in-body/ (run 7 — engine lesson, SK-LLM-042 gateway-200-error-body classifier)
- https://nlqdb.com/blog/llm-concatenates-columns-text-to-sql/ (run 12 — engine lesson, SK-LLM-043 projection directive)
- https://nlqdb.com/blog/bird-gold-noise-distinct/ (run 14 — engine lesson, SK-QUAL-014 loss-bucketing before prompt directives)
- https://nlqdb.com/blog/model-preset-fail-loud/ (run 16 — engine/product lesson, SK-PREMIUM-014 honest model knob)
- https://nlqdb.com/blog/llm-preflight-probe-health/ (run 17 — CI/engine lesson, SK-LLM-042 probe-health ≠ agent-competence)
- https://nlqdb.com/blog/serverless-db-cold-start-retry/ (run 24 — engine/ops lesson, SK-ASK-013 per-stage retry backoff)
- https://nlqdb.com/blog/llm-timeout-looks-like-hallucination/ (run 20 — engine lesson, SK-QUAL-022 eval-budget ≠ prod SLA)

## Last change

**2026-07-12 (run 58)** — lever: **re-true every drifted walker to the
shipped surface (row #21, 0/9 → 6/9).** Step 0: open PRs #672 (opencheck
adoption fix) and #667 (daily.md rules) — no file overlap; their claims
left to them. **The drift (all three fronts, decision-checked before
edit):** FLOW-001 asserted a hero input on `/` but SK-WEB-018 moved the
goal input to `/app/new/` behind the GLOBAL-007 door; FLOW-002 +
`verify-flows.sh` grepped "What nlqdb doesn't do here" while the shipped
heading (since ≥ run 15) says "doesn't *try to* do here"; flow-005-stdio
pinned a 4-tool catalog while the server ships 5 — `nlqdb_connect_database`
is byo-connect/GLOBAL-003-sanctioned and `nlqdb_query` carries the
SK-PREMIUM-014 `model` key — so every red was the walker, not the product.
§10.3 applied: shipped surface + sanctioning decisions win; walkers,
SK-STRG-009, SK-MCP-002 (verb list), SK-SOLVE-002 (heading), and both
tracker walkthroughs re-trued in their canonical homes. `launchBrowser`
now honours `HTTPS_PROXY` (no-op on cron; enables proxied-sandbox runs —
though this sandbox's egress resets browser CONNECTs, so the canonical
measurement ran on a GH runner). **Measured verdict (same instrument,
before → after):** 06:00Z cron artifact `acquisition-health-29185838512`
**0/9** → on-branch dispatch
[`acquisition-health-29200271657`](https://github.com/nlqdb/nlqdb/actions/runs/29200271657)
**6/9**, flow-005 hosted 6/6 + stdio 22/22 (was failed), verify-flows 9
drift-fails → 0. Δ > 0 — keep. Bonus: first FLOW-001/002/003 anon **200s**
ever in the outcome log — the run-56 428 fix confirmed live from a
stranger IP (TTFV p50 4.2 s / p95 14.1 s). **Found, not pulled (named next
levers):** (1) `/app/new` renders the first answer without the
SK-WEB-005/GLOBAL-023 trace toggle — the 2026-05-24 masked regression,
now the only real red in the canonical flows (row #21); (2) FLOW-001
run-3 submit flake (no `/v1/ask` observed). **Step 1:** full funnel/ops
re-pull 16:16Z (rows #1–#5, #12–#13 — strangers still 0, N still
unmeasurable); docs-ambiguity 17 (held); link sweep 117 pages / 2,883
links / 0 dead; row #15 ≈ 0.94 (all four suites green ≤ 12.5 h old;
opencheck's deeper fix rides open #672). **Artifact (step 3):** queue < 3
⇒ drafted `smoke-test-walks-the-old-ui` into the queue (no publish).
**KPI:** GLOBAL-025 onboarding (the anti-self-deception instrument over
the stranger path measures the real product again; the one remaining red
is a genuine first-value UX gap, now visible) — **none degrade** (walker +
docs-only diff; app code, prompts, eval baselines, CI lanes untouched;
engine rows #8–#11 carried unchanged).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
