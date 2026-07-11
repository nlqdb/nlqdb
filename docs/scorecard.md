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
lever** (rule 8).

**Worst number today:** real strangers reaching a first answer = **0** — a
lagging metric moved only through its agent-movable inputs. Worst
**agent-movable** number: **row #9 Spider raw EX 0.2444** — and run-49
triage of the 07-08 report proved **26/135 rows (19%) scored `no_sql`
where every chain attempt was capacity/transport** (`circuit_open` /
`rate_limited` / `network`) — zero engine signal by `SK-QUAL-020`'s own
classification, scored as engine failure because one transport attempt
demoted the `SK-QUAL-013` capacity pause. **Run 49 lever: the
transient-wall budget stop** (per-question pause on capacity∪transport
walls) + a post-fix canonical re-measure — **verdict: 0.2444 → 0.2741,
`no_sql` 30 → 0, first fully-answered Spider run** (row #9 + *Last
change*). Row #15's two named classes are both
closed (run 46 capacity lane; PR #661 adoption-ACL fix). Engine lane, per
the weekly focus; not anti-rut-blocked (last 5 merged = E2E, distribution
×2, docs, onboarding).

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (fresh 07-11 pull — CF GraphQL + remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 120 visits / 146 pageloads (07-04→07-11 13:00Z, raw). Walker filter (run 12, `userAgentBrowser` cut): "Unknown" 76 + headless 1 ⇒ **real-browser ≈ 41 visits** (Chrome 35, ChromeMobile 3, MobileSafari 2, Edge 1) — up from ≈ 40 earlier 07-11 | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (re-verified 07-11 13:00Z) |
| 3 | DBs total | 163; latest activity 07-11 11:47 UTC (the run-49 Spider window's staging activity) | +1 vs earlier 07-11; stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not yet measurable** (fresh 07-11 13:00Z remote-D1; method `SK-ONBOARD-007`). Unfiltered counters 5/22 ok — all founder/test per the email join (denominator +8 = the failed adopted-DB e2e asks, run 48's root-caused class) | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel. Run 48 removed the structural ceiling (adoption ACL gap, SK-ANON-003 amendment) |
| 5 | Session retention (≥ 2 queries) | 5 DBs with `first10_asks ≥ 2` (07-11 13:00Z, same attribution caveat as row #4) | share of DBs with `first10_asks ≥ 2` |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **93** (`/vs` 31 + `/solve` 33 + `/blog` 29) — run 49 published `decided-questions-rot-in-your-decision-log` (the row #17 docs-ambiguity method; 113 built pages, in rss/llms/sitemap). Run 50 drafted `most-active-user-is-your-test-suite`; pending drafts **3** (`five-fallback-models-one-provider` + `ownership-transfer-outlives-least-privilege` + it) ⇒ ≥ 3 ⇒ **next run publishes, not drafts** (step 3) | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts 29 (run 49: +`decided-questions-rot-in-your-decision-log`); 7d external referrals = **9** (bing 8, github 1 — 07-11 13:00Z pull; was 6 on 07-09, 1 on 07-06). Syndication feeds 1 (`/rss.xml`); internal links **2,783** (run-49 build) | CF `refererHost` — measured every run. External-referral yield keeps ticking up (bing-led, 1 → 6 → 9) as indexation lands |
| | **Engine** — BIRD 07-11 · Spider 07-11 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.546** (272/498 EA, 2 `gold_error`, 07-11 canonical on main `2cfda39`, [run 29144102081](https://github.com/nlqdb/nlqdb/actions/runs/29144102081) — completed in ONE window, `no_sql` 0/500, first fully capacity-clean canonical). Δ +2.01 pp vs 07-05, McNemar b=31/c=41, `regressions: []` — flat-to-positive drift, no attributable lever. Baseline re-seeded | target 0.65 / **Phase 2 floor 0.60** — gap now 5.4 pp. Offline levers exhausted; SC dead (#619); frontier-lens closed (run 15) |
| 9 | Spider raw EX | **0.2741** (37/135, 07-11 canonical, [final run 29151548561](https://github.com/nlqdb/nlqdb/actions/runs/29151548561) — **first fully-answered Spider run: `no_sql` 0/135**, exec_error 5, gold_error 0; five-window `SK-QUAL-013` resume on the fix SHA). Was 0.2444 (07-08) with 26 capacity/transport rows scored `no_sql` — run 49's transient-wall fix converts those to pauses | target 0.75. Still worst engine number, now engine-honest. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is its source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004) — flat vs 07-02) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06 run 15, `SK-QUAL-022`). persona-bench −4.35 pts (07-09, one-question noise at N=23) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69–0.70 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers analytics (fresh 07-11 pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 4,596 / 0 (0.00%) (07-11 13:00Z pull) | mcp-server 475 req / 0 err; events-worker 8 req |
| 13 | nlqdb-api wall-time p50 / p95 | p95 ~1.35 s; p50 method-sensitive across adaptive-sample buckets (~24 ms min-bucket, ~0.3 s request-weighted) | mcp-server p95 ≈ 763 ms this window; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.58** — sdk ✅ · mcp ✅ · examples ✅ 07-09 (0.77 each, freshness decay) · opencheck ❌ 0. **Both app-side blocker classes are now closed:** run 46 closed capacity (NVIDIA fallback lane); **run 48 closed the last app-side failure** — the "cold-start" `db_unreachable` was the adoption ACL gap, and on the fix's verification dispatch [29144964531](https://github.com/nlqdb/nlqdb/actions/runs/29144964531) `#authed-state-preserved` **passed in 38.4 s** (first pass since 07-05). Suite A 4/5; the residual fail is `#add-row-redirects-to-auth` agent-lane starvation (216 s, run-46 flap class on the OpenRouter primary — same test passed in 25 s on the NVIDIA lane 07-11). Remaining red is 100% driver-lane, 0% app | **Sequencing rule: never dispatch opencheck alongside another OpenRouter-free consumer.** Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.546, 07-11); agentic-frontier ≥ 0.80 (0.693, Δ 18.66 ✓); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (stranger N=0); destructive-op retry < baseline (instrumented run 38, N≈0); **MCP in 3+ host apps (re-measured 07-11 `scripts/mcp-hosts.sh`: 0 stranger hosts, 1 founder host — cursor, 2 grants, 0 used — FAIL)**; 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | every criterion instrumented; only agent-movable *pass* left is the agentic-frontier ~11 pp competence lift (`SK-LLM-017` premium chain, or the parked corrected-set); rest are stranger-dependent |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **17** (fresh grep 07-11 run 50 — count held) | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. Lever: research (P2/GLOBAL-033) → document (P4) → mark resolved |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting** (07-11 run-49 sweep: **113** pages, **2,783** internal links — +1 page / +25 links = the new `decided-questions-rot-in-your-decision-log` post; no web edits run 50) | target 0 — `bun run build && bun run check:links` in `apps/web` |
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

**2026-07-11 (run 49)** — lever: **engine — transient-wall budget stop
(`SK-QUAL-013` rev) + first fully-answered canonical Spider run (row #9,
worst agent-movable number, weekly-focus lane).** Step 0: open PR #661
(run 48 — adoption-ACL fix + BIRD re-measure 0.546) noted; zero file/lever
overlap chosen. **Diagnosis first:** downloaded the 07-08 Spider report
([28959809497](https://github.com/nlqdb/nlqdb/actions/runs/28959809497)) —
**26/30 `no_sql` rows (19% of the dataset) failed with only
capacity/transport attempts** (`circuit_open`/`rate_limited`/`network`);
one transport attempt demoted each `SK-QUAL-013` capacity pause to a
scored engine failure (only 4 rows carried real `parse` signal). 0.2444
measured availability, not SQL. **Change:** the per-question pause
predicate widened to the transient union (`isChainTransientWall`:
capacity + `network`/`timeout`); config reasons (`not_configured`/
`auth_denied`) stay scored so an all-config outage still fails loudly via
`SK-QUAL-020`'s run-level collapse. Both canonical decision bodies
amended; 299 eval tests green. **Measured verdict:** post-fix canonical
re-measure, five-window SHA-keyed resume (runs
[29149841907](https://github.com/nlqdb/nlqdb/actions/runs/29149841907) →
[29151548561](https://github.com/nlqdb/nlqdb/actions/runs/29151548561)) —
**raw EX 0.2444 → 0.2741 (37/135), `no_sql` 30 → 0/135, gold_error 0** —
the first Spider run where every row carries a real model answer; walls
paused and resumed instead of scoring. Δ > 0 — keep. (One extra window was
spent re-scoring 50 questions after mid-loop commits moved the branch SHA
off the checkpoint key — freeze the branch during a multi-window resume.)
**Artifact (step 3):** queue ≥ 3 counting PR #661's draft ⇒ published the
oldest ready draft `decided-questions-rot-in-your-decision-log` (rows
#6/#7/#18: 93 surfaces, 113 pages, 2,783 internal links, 0 dead).
**KPI:** GLOBAL-025 engine quality (row #9 honest + up; harness now
measures reasoning, not provider weather); **none degrade** (eval harness
+ docs + one blog post; prompts, chains, scorer, and BIRD baseline
untouched — BIRD's fresh 0.546 is PR #661's re-measure, reconciled here).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
