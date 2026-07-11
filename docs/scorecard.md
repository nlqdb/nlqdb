# Scorecard — current state

Point-in-time tracker, regenerated each
[`/daily`](../.claude/commands/daily.md) run. Current state only — no changelog
(≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md` (engine).

**Weekly focus number (2026-07-04 → 07-11):** **BIRD raw EX → ≥ 0.60**
(row #8) — 0.526 (07-05 canonical), still the only pillar below a hard
[`GLOBAL-025`](decisions/GLOBAL-025-north-star.md) Phase-2 floor;
`SK-QUAL-005` mandates engine work until it clears. Every agent-movable
sub-lever is measured to a verdict (SC N≥2 flat #619; agentic-frontier 0.693
< the 0.80 floor, run 15's ≤ 0.70 ceiling call); the only live BIRD-free move
is the parked **corrected-set** (license, P2) — row #8 stays **dark for the
lever** (rule 8). **Staleness alert: the 07-05 canonical measurement turns
7 days old 07-12 — the next run must re-dispatch the BIRD workflow (resume
rules per `SK-QUAL-013`).**

**Worst number today:** real strangers reaching a first answer = **0** — a
lagging metric moved only through its agent-movable inputs. Worst
**agent-movable** number: **row #15 E2E freshness ≈ 0.62**, dragged by
opencheck at 0 — **13 consecutive failed dispatches 07-02 → 07-10**, and
run-46 trace triage proved every one shares a single root: all five agent
candidates sit on OpenRouter's one free pool, which saturates as a unit
(the app answered both failed tests' `/v1/ask` in ~4 s with 200 while the
agent lane starved for 240 s). **Run 46 lever: a second-provider fallback
lane in the opencheck pre-flight** (NVIDIA NIM `gpt-oss-120b`, $0
dev-program tier, outside the app's engine chain) — verdict in row #15 +
*Last change*. Not anti-rut-blocked (E2E last pulled 07-06; last 5 merged =
distribution ×2 (runs 44/47), docs ×2, onboarding).

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (fresh 07-11 pull — CF GraphQL + remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 106 visits / 129 pageloads (07-04→07-11, raw). Walker filter (run 12, `userAgentBrowser` cut): "Unknown" = 67 ⇒ **real-browser ≈ 39 visits** (38 excl. ChromeHeadless) — up from ≈ 33 on 07-09 | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev |
| 3 | DBs total | 161, all with `last_queried_at`; latest 07-10 22:22 UTC | +1 vs 07-09; stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not yet measurable** (fresh 07-11 remote-D1; method `SK-ONBOARD-007`). Unfiltered counters 5/14 ok — all founder/test per the email join | target ≥ 95%. Full instrument set live: TTFV (run 34) + build-goal chips (run 30) + drop-off funnel (run 43, `SK-ONBOARD-005`) |
| 5 | Session retention (≥ 2 queries) | 4 DBs with `first10_asks ≥ 2` (07-11, same attribution caveat as row #4) | share of DBs with `first10_asks ≥ 2` |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **92** (`/vs` 31 + `/solve` 33 + `/blog` 28) — run 47 published `emit-metrics-where-the-distinction-is-certain` (`SK-TRUST-004` retry-rate emit point; 112 built pages, in rss/llms/sitemap); run 46 pulled the E2E lever and drafted. Pending drafts **2** (`five-fallback-models-one-provider` + `decided-questions-rot-in-your-decision-log`) ⇒ < 3 ⇒ next run drafts one, per step 3 | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts 28 (run 47: +`emit-metrics-where-the-distinction-is-certain`); 7d external referrals = **9** (bing 8, github 1 — 07-11 pull; was 6 on 07-09, 1 on 07-06). Syndication feeds 1 (`/rss.xml`); internal links **2,758** (run-47 build) | CF `refererHost` — measured every run. External-referral yield keeps ticking up (bing-led, 1 → 6 → 9) as indexation lands |
| | **Engine** — BIRD 07-05 · Spider 07-08 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.526** (262/498 EA, 2 `gold_error`, 07-05 canonical, [run 28742006051](https://github.com/nlqdb/nlqdb/actions/runs/28742006051)). `SK-QUAL-017` SC verdict: N=3 majority-vote flat vs greedy (p=1.0) | target 0.65 / **Phase 2 floor 0.60**. Offline levers exhausted; SC dead (#619); frontier-lens closed (run 15). **Goes stale 07-12 — re-dispatch next run** |
| 9 | Spider raw EX | **0.2444** (33/135, 07-08 capacity-honest full run, [run 28959809497](https://github.com/nlqdb/nlqdb/actions/runs/28959809497), gold_error 0) | target 0.75. Still worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is its source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004) — flat vs 07-02) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06 run 15, `SK-QUAL-022`). persona-bench −4.35 pts (07-09, one-question noise at N=23) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69–0.70 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers analytics (fresh 07-11 pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 4,494 / 0 (0.00%) | mcp-server 454 req / 0 err; events-worker 6 req |
| 13 | nlqdb-api wall-time p50 / p95 | ~24 ms / ~1.31 s (cross-bucket aggregation of adaptive samples) | mcp-server p95 ≈ 770 s = long-lived SSE, expected; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.62** — sdk ✅ · mcp ✅ · examples ✅ 07-09 (0.83 each) · opencheck ❌ 0 (14 straight failed runs since 07-02). **But the capacity class is now closed:** run-46 fallback lane fired live in [29134673858](https://github.com/nlqdb/nlqdb/actions/runs/29134673858) — 4 OpenRouter candidates 429'd, gate caught a flap, NVIDIA picked 3/3, **Suite A 4/5 (was 2/5 on 07-10) with agent per-test time 7.7–25.1 s (vs 72–240 s starved)**. Sole remaining blocker = app-side cold-start `db_unreachable` (the `e2e-coverage` FEATURE.md OQ) — next opencheck lever | **Sequencing rule: never dispatch opencheck alongside another OpenRouter-free consumer.** Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.526); agentic-frontier ≥ 0.80 (0.693, Δ 18.66 ✓); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (stranger N=0); destructive-op retry < baseline (instrumented run 38, N≈0); **MCP in 3+ host apps (re-measured 07-11 `scripts/mcp-hosts.sh`: 0 stranger hosts, 1 founder host — cursor, 2 grants, 0 used — FAIL)**; 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | every criterion instrumented; only agent-movable *pass* left is the agentic-frontier ~11 pp competence lift (`SK-LLM-017` premium chain, or the parked corrected-set); rest are stranger-dependent |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **17** (verified by fresh grep 07-11; run 45 resolved cli mcp-install add-a-host 18 → 17. Note: run 44 merged after run 45 and its scorecard showed the stale 18 — reconciled this run, the count itself never regressed) | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. Lever: research (P2/GLOBAL-033) → document (P4) → mark resolved |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting** (07-11 run-47 sweep: **112** pages, **2,758** internal links — +1 page / +25 links = the new `emit-metrics-where-the-distinction-is-certain` post) | target 0 — `bun run build && bun run check:links` in `apps/web` |
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

**2026-07-11 (run 46)** — lever: **E2E — second-provider fallback lane for the
opencheck agent pre-flight (row #15, worst agent-movable number at 0.62 with
opencheck at 0).** Step 0: no open PRs. **Diagnosis first:** downloaded run
[29127134203](https://github.com/nlqdb/nlqdb/actions/runs/29127134203)'s Suite-A
recordings and read the Playwright network traces — in BOTH 240 s-timeout tests the
app answered `/v1/ask` with 200 in ~4 s; the failures are 100% agent-lane starvation.
All 13 consecutive failures (07-02 → 07-10, at 04:37/07:25/21:01/22:14 UTC alike)
share one root: all five agent candidates sit on OpenRouter's single free pool,
which saturates as a unit — model diversity without provider diversity.
**Change:** `_e2e-opencheck.yml` pre-flight now walks a fallback provider lane
(`fallback_provider_base_url`/`fallback_candidate_models`/`FALLBACK_LLM_API_KEY`)
when every primary candidate fails the 3-probe gate; default NVIDIA NIM
`openai/gpt-oss-120b` ($0 dev-program tier, ~40 RPM, outside the app's engine
chain — the two-budget split holds). Hand-verified 3/3 CI-shape tool-call probes
at 01:20 UTC while OpenRouter's pool was 429. **Measured verdict:** verification
dispatch [29134673858](https://github.com/nlqdb/nlqdb/actions/runs/29134673858)
(`depth=a`) — **the lane fired live**: 4 OpenRouter candidates instant-429, the
3-probe gate caught gpt-oss-20b flapping, NVIDIA picked 3/3; **Suite A 2/5 → 4/5
day-over-day, agent per-test time 7.7–25.1 s vs 72–240 s starved**. Δ > 0 — keep.
Sole remaining failure is the pre-existing app-side cold-start class
(`db_unreachable` ×2 on `#authed-state-preserved`), already the `e2e-coverage`
FEATURE.md open question. **Artifact (step 3):** queue was 2 deep → drafted
`five-fallback-models-one-provider` (run 47, merged first, then published from
the bottom of the queue — pending drafts 2 ⇒ next run drafts, row #6).
**KPI:** GLOBAL-025 engine quality/performance via honest E2E signal (row #15);
**none degrade** (CI + docs only; no product code, prompts, or eval baselines
touched).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
