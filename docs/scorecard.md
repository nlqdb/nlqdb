# Scorecard — current state

Point-in-time tracker, regenerated each
[`/daily`](../.claude/commands/daily.md) run. Current state only — no changelog
(≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md` (engine).

**Weekly focus number (2026-07-11 → 07-18):** **row #15 E2E freshness →
1.0** — close the opencheck stale-fixture red and keep all four suites
fresh. **Why:** it is the worst *agent-movable* number. BIRD (row #8, 0.546
< the 0.60 [`GLOBAL-025`](decisions/GLOBAL-025-north-star.md) floor) is
**dark for the lever** — offline levers exhausted, SC dead (#619),
frontier-lens closed (run 15); the only remaining path, the corrected-set,
is blocked on an external maintainer's license reply (uiuc-kang-lab #7,
filed 07-07, no response), so no single run can move it. Strangers (row #2)
lag. Row #15 responds to agent action (0 → live signal via runs 46/48/50)
and guards the integrity of every engine/UX number this loop reports. Last
week's focus (BIRD ≥ 0.60) was itself dark: 0 of ~43 runs could pull it —
see [`weekly-review.md`](weekly-review.md).

**Worst number today:** real strangers reaching a first answer = **0** — a
lagging metric moved only through its agent-movable inputs. Worst
**agent-movable** number: **row #15 E2E freshness**, opencheck still 0.
Runs 46/48/49 closed the capacity, adoption-ACL and Spider-`no_sql`
classes; the one class left un-attacked was **agent-lane starvation on
the OpenRouter primary** (13 failed dispatches 07-02→07-10; flaps past
the 3-probe gate). **Run 50 lever: swap the lanes — NVIDIA NIM (same
`gpt-oss-120b` weights, independent $0 pool, ~40 RPM) becomes the primary
agent lane; the 5-candidate OpenRouter `:free` walk becomes the
fallback.** Verdict on the first full-depth NIM dispatch
([29154050866](https://github.com/nlqdb/nlqdb/actions/runs/29154050866)):
starvation class closed — details in row #15 + *Last change*. The
surviving red is app/env-side ("Couldn't reach the database" on the
fixture account's `users` DBs + a cleanup timeout over ~27 stale fixture
DBs whose Neon `e2e` branch is recreated under their D1 rows every run) —
that stale-fixture class is the next lever candidate. Not
anti-rut-blocked (last 5 merged = engine, onboarding, E2E, distribution
×2).

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
| 15 | E2E manual-suite freshness | **0.57** — sdk ✅ · mcp ✅ · examples ✅ 07-09 (0.75 each after decay) · opencheck ❌ 0. **Run 50 closed the driver-starvation class** (agent-lane swap: NIM primary, OpenRouter fallback). First full-depth NIM dispatch [29154050866](https://github.com/nlqdb/nlqdb/actions/runs/29154050866): **A 4/5 · B 3/8 · C 8/9** (first B/C signal since the pool saturated 07-02) — NIM picked 3/3 in every suite, zero pre-flight aborts, zero starvation losses; `#add-row-redirects-to-auth` 216 s starved fail → **14.9 s PASS**. Surviving red is app/env-side: "Couldn't reach the database" on the fixture account's `users` DBs + `#delete-remaining-db` timing out over ~27 stale fixture DBs (D1 rows over a recreated Neon `e2e` branch — same-name pins can land on schemas that no longer exist) | Stale-fixture cleanup = next lever candidate. Sequencing rule (unchanged): never dispatch opencheck alongside another consumer of its lanes. Triage: `e2e-coverage/opencheck-operations.md` |
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

**2026-07-11 (run 50)** — lever: **opencheck agent-lane swap — NVIDIA NIM
promoted to primary, the OpenRouter `:free` walk demoted to fallback (row
#15).** Step 0: PR #662 (run 49 — transient-wall stop, Spider 0.2741;
published the oldest queue draft) merged first; this entry reconciled on
top of it per the second-merge rule. **Diagnosis:** with runs 46/48's classes closed, the
one un-attacked opencheck class was driver starvation on the OpenRouter
primary — 13 failed dispatches 07-02→07-10, and the pool *flaps past the
3-probe gate* (216 s starvation on a probe-healthy pick, 29144964531) while
the NIM lane ran the same tests in 7.7–25 s. The failure domain is the
provider pool, not the model. **Change:** `_e2e-opencheck.yml` lane defaults +
caller secrets swapped (NIM `gpt-oss-120b` primary; the 5-candidate OpenRouter
walk is now the fallback); probe logic + two-budget split untouched;
`SK-E2E-003` amended in place. **Measured verdict** (first full-depth `abc`
dispatch on NIM, [29154050866](https://github.com/nlqdb/nlqdb/actions/runs/29154050866)):
**A 4/5 · B 3/8 · C 8/9** — first B/C signal since 07-02, NIM picked 3/3 in
all suites, zero pre-flight aborts, **zero starvation losses**;
`#add-row-redirects-to-auth` went 216 s starved fail → **14.9 s PASS**. Δ > 0
— keep. Surviving red is app/env-side: "Couldn't reach the database" on the
fixture account's `users` DBs + a C cleanup timeout over ~27 stale fixture
DBs (D1 rows over a per-run-recreated Neon `e2e` branch) — logged in the
opencheck tracker as the next lever candidate. **Step-1:** full funnel/ops
re-pull 13:00Z (rows #1–#5, #12–#13); docs-ambiguity re-grep (17, held).
**Artifact (step 3):** queue effectively 2 after #662's publish → drafted
`most-active-user-is-your-test-suite` (queue back to 3 ⇒ next run publishes).
**KPI:** GLOBAL-025 engine quality (the E2E signal now measures the app, not
the driver's provider weather) + performance of the suite itself (A+C wall
time 5m21s + 11m11s); **none degrade** (CI lane config + docs only; app code,
prompts, eval baselines untouched).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
