# Scorecard — current state

Point-in-time tracker, regenerated each
[`/daily`](../.claude/commands/daily.md) run. Current state only — no changelog
(≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md` (engine).

**Weekly focus number (2026-07-04 → 07-11):** **BIRD raw EX → ≥ 0.60**
(row #8) — **0.546** (07-11 canonical re-measure, PR #661's dispatch
[29144102081](https://github.com/nlqdb/nlqdb/actions/runs/29144102081);
staleness cleared, baseline re-seeded), still the only pillar below a hard
[`GLOBAL-025`](decisions/GLOBAL-025-north-star.md) Phase-2 floor;
`SK-QUAL-005` mandates engine work until it clears. Every agent-movable
sub-lever is measured to a verdict (SC N≥2 flat #619; agentic-frontier 0.693
< the 0.80 floor, run 15's ≤ 0.70 ceiling call); the only live BIRD-free move
is the parked **corrected-set** (license, P2) — row #8 stays **dark for the
lever** (rule 8). Run 51's `SK-LLM-044` directive touches the shared planner
prompt post-measure — next BIRD canonical re-verifies the 0.546.

**Worst number today:** real strangers reaching a first answer = **0** — a
lagging metric moved only through its agent-movable inputs. Worst
**agent-movable** number: **row #9 Spider raw EX** — run 49 made it honest
(0.2741, first fully-answered run); run 51 attacked its largest recoverable
loss class: offline result-shape bucketing of all 98 non-matches (predicted
SQL re-executed against the local fixtures, diffed vs gold CSVs with the
canonical comparator) found **52/98 at the exact gold row count but failing
on column values** — right grain, wrong projection — with a directive-
addressable core of ~10–12 rows (surrogate id where gold wants the name,
e.g. local026 bowler id `294` vs `"P Awana"`; omitted requested attributes,
e.g. local023). **Run 51 lever: `SK-LLM-044` entity-identification
projection directive** + canonical re-measure — verdict in row #9 / *Last
change*. Engine lane; not anti-rut-blocked (last 5 merged = engine/eval,
onboarding, E2E, distribution, docs).

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (fresh 07-11 16:30Z pull — CF GraphQL + remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 110 visits / 133 pageloads (07-04→07-11 16:30Z, raw). Walker filter (run 12, `userAgentBrowser` cut): "Unknown" 67 + headless 1 ⇒ **real-browser ≈ 42 visits** — up from ≈ 40 at 07-11 08:00Z | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (re-verified 07-11 16:30Z) |
| 3 | DBs total | **158** (−4 vs 07-11 morning: e2e fixture-DB cleanup deleted registry rows); latest activity 07-10 22:22 UTC | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not yet measurable** (fresh 07-11 remote-D1; method `SK-ONBOARD-007`). Unfiltered counters now 2/4 ok — the fixture-DB deletion (row #3) took its counter rows with it, incl. run 48's +8 failed adopted-DB asks | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel. Deleted-row counters are a known caveat of DB-row-scoped counters; stranger-only method unaffected (their DBs persist) |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-11, same fixture-deletion caveat as row #4) | share of DBs with `first10_asks ≥ 2` |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **94** (`/vs` 31 + `/solve` 33 + `/blog` 30) — run 51 published `five-fallback-models-one-provider` (the run-50 lane-swap lesson; 114 built pages, in rss/llms/sitemap). Pending drafts **2** counting open PR #663's (`ownership-transfer-outlives-least-privilege` inline + `most-active-user-is-your-test-suite` in #663) ⇒ < 3 ⇒ next run drafts one, per step 3 | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts 30 (run 51: +`five-fallback-models-one-provider`); 7d external referrals = **9** (bing 8, github 1 — 07-11 16:30Z pull; was 6 on 07-09, 1 on 07-06). Syndication feeds 1 (`/rss.xml`); internal links **2,808** (run-51 build, +25) | CF `refererHost` — measured every run. External-referral yield holding (bing-led, 1 → 6 → 9) as indexation lands |
| | **Engine** — BIRD 07-11 · Spider 07-11 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.546** (272/498 EA, 2 `gold_error`, 07-11 canonical on main `2cfda39`, [run 29144102081](https://github.com/nlqdb/nlqdb/actions/runs/29144102081) — completed in ONE window, `no_sql` 0/500, first fully capacity-clean canonical). Δ +2.01 pp vs 07-05, McNemar b=31/c=41, `regressions: []`. Baseline re-seeded. Measured pre-`SK-LLM-044`; next canonical re-verifies | target 0.65 / **Phase 2 floor 0.60** — gap 5.4 pp. Offline levers exhausted; SC dead (#619); frontier-lens closed (run 15) |
| 9 | Spider raw EX | **0.2963** (40/135, `no_sql` 0/135, exec_error 3, gold_error 0 — 07-11 canonical on `6e1725c` with `SK-LLM-044`, nine-window `SK-QUAL-013` resume [29160009809](https://github.com/nlqdb/nlqdb/actions/runs/29160009809) → [29164092490](https://github.com/nlqdb/nlqdb/actions/runs/29164092490)). Was 0.2741 (37/135, run 49's first fully-answered run) | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is its source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004) — flat vs 07-02) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06 run 15, `SK-QUAL-022`). persona-bench −4.35 pts (07-09, one-question noise at N=23) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69–0.70 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers analytics (fresh 07-11 16:30Z pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 4,769 / 0 (0.00%) | mcp-server 458 req / 0 err; events-worker 16 req |
| 13 | nlqdb-api wall-time p50 / p95 | ~310 ms / ~1.39 s (request-weighted mean of per-day adaptive-sample quantiles — earlier "~24 ms" pulls weighted by bucket, not requests; this method pins to request weight) | mcp-server p50 ~6 ms / p95 ≈ 736 ms (SSE tails excluded by 7d window); `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.56** — sdk ✅ · mcp ✅ · examples ✅ 07-09 (≈0.74 each after decay) · opencheck ❌ 0 (latest completed dispatch [29154050866](https://github.com/nlqdb/nlqdb/actions/runs/29154050866), open PR #663's lane swap: starvation class closed — `#add-row` 216 s FAIL → 14.9 s PASS, A 4/5 · B 3/8 · C 8/9 — but suite conclusion red on app/env-side residuals: fixture account's stale D1 registry rows over recreated Neon `e2e` branches) | **Sequencing rule: never dispatch opencheck alongside another OpenRouter-free consumer.** Residual class tracked in `e2e-coverage/opencheck-operations.md` (PR #663) |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.546, 07-11); agentic-frontier ≥ 0.80 (0.693, Δ 18.66 ✓); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (stranger N=0); destructive-op retry < baseline (instrumented run 38, N≈0); **MCP in 3+ host apps (re-measured 07-11 `scripts/mcp-hosts.sh`: 0 stranger hosts, 1 founder host — cursor, 2 grants, 0 used — FAIL)**; 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | every criterion instrumented; only agent-movable *pass* left is the agentic-frontier ~11 pp competence lift (`SK-LLM-017` premium chain, or the parked corrected-set); rest are stranger-dependent |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **17** (fresh grep 07-11 run 51 — count held) | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. Lever: research (P2/GLOBAL-033) → document (P4) → delete the bullet |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting** (07-11 run-51 sweep: **114** pages, **2,808** internal links — +1 page / +25 links = the new `five-fallback-models-one-provider` post) | target 0 — `bun run build && bun run check:links` in `apps/web` |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **0 tracked gaps** (runs 32 + 37 each found + closed 1) | claim-vs-reality on shipped surfaces + docs; target 0. Standing candidate: extend `check:links` to assert each advertised capability has shipped code |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) · picker parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal; only genuine remaining slot is the premium chain |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/20 + 12 memory `/vs` pages | tick on merge; mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — the only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; E-03…E-07 all Neon/infra-gated |
| | Memory-quality eval (`SK-QUAL-023`) | harness shipped — EX unmeasured | 15 gold-verified questions, 4 axes; a scored dispatch + the vector head-to-head are the next slices |

## Shipped distribution (live URLs)

Canonical copies on `/blog` (`SK-BLOG-001`); venue variants stay in
`research/distribution-queue.md` as pointers:

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

**2026-07-11 (run 51)** — lever: **engine — `SK-LLM-044`
entity-identification projection directive (row #9 Spider, worst
agent-movable number).** Step 0: open PR #663 (run 50 — opencheck lane swap +
drafted `most-active-user-is-your-test-suite`) noted; zero file/lever
overlap (this run touches prompts/eval docs/blog; #663 touches opencheck
workflows). **Diagnosis first:** downloaded run 49's canonical Spider
report and re-executed all 98 non-matches offline against the local
SQLite fixtures with the canonical comparator — **52/98 fail at the exact
gold row count** (grain right, projection wrong; buckets: 32 all-cols-wrong,
20 some-cols-wrong, 20 empty-result, 21 row-count, 5 exec_error). The
directive-addressable core: surrogate id projected where gold wants the
human-readable name (local026, local020, local133) + omitted explicitly
requested attributes (local023, local004, local194, local209, local220),
~10–12 rows. **Change:** one `PLAN_DIRECTIVES` bullet (canonical decision
`SK-LLM-044`, llm-router) — identification goals project the entity's name
column, ids/attributes only as the goal requests them, never a subset of a
multi-part ask; BIRD-safe by deferring to the goal's literal ask.
**Measured verdict:** post-fix canonical Spider re-measure on `6e1725c`
([run 29160009809](https://github.com/nlqdb/nlqdb/actions/runs/29160009809)):
**raw EX 0.2741 → 0.2963** (37 → 40/135), `no_sql` 0/135, second consecutive fully-answered run. Paired per-question: gained c=13 / lost b=10, McNemar exact p≈0.68 — net positive, statistically flat (provider-mix churn swamps a ~10-row lever at N=135, the SK-LLM-043 precedent); **2 of the directive's named target instances flipped mismatch→match (local020, local133 — the id-for-name class)**, directional confirmation. Δ > 0 — keep. Row #8 note added: BIRD
0.546 was measured pre-directive; next BIRD canonical re-verifies (bullet
defers to the literal ask, so the regression bound is the directive's own
scope). **Artifact (step 3):** queue ≥ 3 counting #663's draft ⇒ published
the oldest ready draft `five-fallback-models-one-provider` (rows #6/#7/#18:
94 surfaces, 114 pages, 2,808 internal links, 0 dead). Funnel reconcile:
DBs 162 → 158 and first10 counters shrank — the e2e fixture cleanup deletes
registry rows *with their counters* (stranger-only method unaffected).
**KPI:** GLOBAL-025 engine quality (row #9); **none degrade** (prompt bullet +
docs + one blog post; BIRD re-verify noted on row #8, chains/scorer/
baselines untouched).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
