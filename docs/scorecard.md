# Scorecard — current state

Point-in-time tracker, regenerated each
[`/daily`](../.claude/commands/daily.md) run. Current state only — no changelog
(≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md` (engine).

**Weekly focus number (2026-07-04 → 07-11):** **BIRD raw EX → ≥ 0.60**
(row #8) — **0.546** (07-11 canonical, re-measured this run; was 0.526), still
the only pillar below a hard
[`GLOBAL-025`](decisions/GLOBAL-025-north-star.md) Phase-2 floor;
`SK-QUAL-005` mandates engine work until it clears. Every agent-movable
sub-lever is measured to a verdict (SC N≥2 flat #619; agentic-frontier 0.693
< the 0.80 floor, run 15's ≤ 0.70 ceiling call); the only live BIRD-free move
is the parked **corrected-set** (license, P2) — row #8 stays **dark for the
lever** (rule 8), though the 07-11 capacity-clean run drifted +2.01 pp
(flat McNemar) and the floor gap is now 5.4 pp.

**Worst number today:** real strangers reaching a first answer = **0** — a
lagging metric moved only through its agent-movable inputs. Worst
**agent-movable** number: **row #15 E2E freshness**, opencheck still 0 —
run 46 closed the capacity class (NVIDIA fallback lane, Suite A 2/5 → 4/5)
and left one blocker it read as app-side cold start. **Run 48 lever:
root-caused that blocker — it was never cold start.** The `#authed-state-
preserved` flow is create-anon → sign-in (adopt) → query, and adoption
flipped only the D1 `tenant_id` while the schema's Postgres grants + RLS
literal still named the anon creator — so exec's least-privilege `SET LOCAL
ROLE` (landed 07-05 #614) failed deterministically on every adopted DB,
mislabeled `db_unreachable` by a log-less catch-all. Also a **prod
onboarding bug** (the flagship anon-create → sign-in → query path
dead-ended). Fix: adoption ACL retarget (`SK-ANON-003` amendment) +
structured SQLSTATE logging on the catch-all. Verdict in row #15 + *Last
change*. Not anti-rut-blocked (last 5 merged = E2E, distribution ×2, docs,
onboarding; this is a product/onboarding lever).

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (fresh 07-11 pull — CF GraphQL + remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 108 visits / 131 pageloads (07-04→07-11 08:00Z, raw). Walker filter (run 12, `userAgentBrowser` cut): "Unknown" 67 + headless 1 ⇒ **real-browser ≈ 40 visits** — up from ≈ 39 earlier 07-11 | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (re-verified 07-11) |
| 3 | DBs total | 162; latest activity 07-11 01:30 UTC (the run-46 e2e verdict run's anon create) | +1 vs 07-10; stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not yet measurable** (fresh 07-11 remote-D1; method `SK-ONBOARD-007`). Unfiltered counters 5/22 ok — all founder/test per the email join (denominator +8 = the failed adopted-DB e2e asks, run 48's root-caused class) | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel. **Run 48 removed a structural ceiling: every anon-created→adopted DB was 0%-able by the ACL gap (SK-ANON-003 amendment)** |
| 5 | Session retention (≥ 2 queries) | 5 DBs with `first10_asks ≥ 2` (07-11, same attribution caveat as row #4) | share of DBs with `first10_asks ≥ 2` |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **92** (`/vs` 31 + `/solve` 33 + `/blog` 28) — run 48 pulled the product lever (adoption ACL fix) and drafted `ownership-transfer-outlives-least-privilege` into the queue. Pending drafts **3** ⇒ ≥ 3 ⇒ **next run publishes, not drafts** (step 3) | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts 28; 7d external referrals = **9** (bing 8, github 1 — 07-11 08:00Z pull; was 6 on 07-09, 1 on 07-06). Syndication feeds 1 (`/rss.xml`); internal links **2,758** | CF `refererHost` — measured every run. External-referral yield bing-led (1 → 6 → 9) as indexation lands |
| | **Engine** — BIRD 07-05 · Spider 07-08 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.546** (272/498 EA, 2 `gold_error`, 07-11 canonical on main `2cfda39`, [run 29144102081](https://github.com/nlqdb/nlqdb/actions/runs/29144102081) — completed in ONE window, `no_sql` 0/500, first fully capacity-clean canonical). Δ +2.01 pp vs 07-05, McNemar b=31/c=41, `regressions: []` — flat-to-positive drift, no attributable lever. Baseline re-seeded | target 0.65 / **Phase 2 floor 0.60** — gap now 5.4 pp. Offline levers exhausted; SC dead (#619); frontier-lens closed (run 15) |
| 9 | Spider raw EX | **0.2444** (33/135, 07-08 capacity-honest full run, [run 28959809497](https://github.com/nlqdb/nlqdb/actions/runs/28959809497), gold_error 0) | target 0.75. Still worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is its source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004) — flat vs 07-02) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06 run 15, `SK-QUAL-022`). persona-bench −4.35 pts (07-09, one-question noise at N=23) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69–0.70 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers analytics (fresh 07-11 pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 4,522 / 0 (0.00%) (07-11 08:00Z pull) | mcp-server 457 req / 0 err; events-worker 6 req |
| 13 | nlqdb-api wall-time p50 / p95 | ~24 ms / ~1.31 s (cross-bucket aggregation of adaptive samples) | mcp-server p95 ≈ 770 s = long-lived SSE, expected; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.58** — sdk ✅ · mcp ✅ · examples ✅ 07-09 (0.77 each, freshness decay) · opencheck ❌ 0. **Both app-side blocker classes are now closed:** run 46 closed capacity (NVIDIA fallback lane); **run 48 closed the last app-side failure** — the "cold-start" `db_unreachable` was the adoption ACL gap, and on the fix's verification dispatch [29144964531](https://github.com/nlqdb/nlqdb/actions/runs/29144964531) `#authed-state-preserved` **passed in 38.4 s** (first pass since 07-05). Suite A 4/5; the residual fail is `#add-row-redirects-to-auth` agent-lane starvation (216 s, run-46 flap class on the OpenRouter primary — same test passed in 25 s on the NVIDIA lane 07-11). Remaining red is 100% driver-lane, 0% app | **Sequencing rule: never dispatch opencheck alongside another OpenRouter-free consumer.** Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.546, 07-11); agentic-frontier ≥ 0.80 (0.693, Δ 18.66 ✓); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (stranger N=0); destructive-op retry < baseline (instrumented run 38, N≈0); **MCP in 3+ host apps (re-measured 07-11 `scripts/mcp-hosts.sh`: 0 stranger hosts, 1 founder host — cursor, 2 grants, 0 used — FAIL)**; 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | every criterion instrumented; only agent-movable *pass* left is the agentic-frontier ~11 pp competence lift (`SK-LLM-017` premium chain, or the parked corrected-set); rest are stranger-dependent |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **17** (fresh grep 07-11 run 48 — count held: the e2e-coverage cold-start OQ was already marked Resolved; run 48 rewrote it with the true root cause, adoption ACL gap, still Resolved) | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. Lever: research (P2/GLOBAL-033) → document (P4) → mark resolved |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting** (07-11 run-48 re-sweep: **112** pages, **2,758** internal links — unchanged, no web edits this run) | target 0 — `bun run build && bun run check:links` in `apps/web` |
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

**2026-07-11 (run 48)** — lever: **the opencheck "cold-start" `db_unreachable`
root-caused to a prod onboarding bug — adoption never retargeted Postgres ACLs
— and fixed (row #15 + GLOBAL-025 onboarding).** Step 0: no open PRs.
**Diagnosis first:** run-29134673858 traces show all 5 `#authed-state-preserved`
`/v1/ask` calls planning the correct SQL (confidence 1) and exec failing
deterministically for 2.5 min while `#create-table-anon` succeeded 60 s earlier
— not cold start; reproduced by hand 6 h later (`lastQueriedAt: null` on every
fixture-user DB). Root: the flow is create-anon → sign-in (adopt) → query;
adoption flipped only D1 `tenant_id`, while least-privilege exec (#614,
2026-07-05 — exactly when this class appeared) runs `SET LOCAL ROLE
tenant_<hash(adopter)>` against grants + a baked RLS tenant literal that still
named the anon creator; the deterministic 42704/42501 fell into a log-less
`db_unreachable` catch-all. **The flagship prod path (anon create → sign-in →
query) dead-ended the same way.** **Change:** adoption runs an idempotent ACL
retarget per migrated hosted DB (`retargetAdoptedDbAcl`: role-if-missing,
USAGE/DML/sequence grants, `WITH SET` membership, `ALTER POLICY` to the new
tenant literal — `SK-ANON-003` amended in place) + the exec catch-all now logs
SQLSTATE structurally (`recordExecUnreachable`, the SK-ASK-019 lesson).
**Measured verdict:** verification dispatch
[29144964531](https://github.com/nlqdb/nlqdb/actions/runs/29144964531)
(`depth=a`, fix deployed) — **`#authed-state-preserved` PASS in 38.4 s, first
pass since 07-05**; Suite A 4/5, residual fail = agent-lane starvation flap
(216 s on the OpenRouter primary; same test passed in 25 s on yesterday's
NVIDIA lane) — remaining red is driver-lane, not app. Δ > 0 — keep.
**Step-1 extras:** BIRD staleness handled — canonical 500q re-dispatch on main
`2cfda39` ([29144102081](https://github.com/nlqdb/nlqdb/actions/runs/29144102081),
resume per `SK-QUAL-013`; baseline re-seed lands when it completes).
**Artifact (step 3):** queue was 2 → drafted
`ownership-transfer-outlives-least-privilege` (queue 3 ⇒ next run publishes).
**KPI:** GLOBAL-025 onboarding (removes a 0%-forcing bug on the first-10 KPI
for adopted DBs) + engine-quality signal honesty (row #15); **none degrade**
(adoption path + logging only; happy-path exec, prompts, eval baselines
untouched).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
