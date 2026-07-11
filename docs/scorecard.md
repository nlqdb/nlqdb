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
engine lever unparks. Strangers (row #2)
lag. Row #15 responds to agent action (0 → live signal via runs 46/48/50)
and guards the integrity of every engine/UX number this loop reports. Last
week's focus (BIRD ≥ 0.60) was itself dark: 0 of ~43 runs could pull it —
see [`weekly-review.md`](weekly-review.md).

**Worst number today:** real strangers reaching a first answer = **0** — a
lagging metric moved only through its agent-movable inputs. Worst
**agent-movable** number: **row #15**, opencheck still 0. Runs 46/48/49/50/52
closed the capacity, adoption-ACL, Spider-`no_sql`, driver-starvation and
stale-fixture classes; the surviving red is the **intermittent exec
`db_unreachable` on the fixture account's fresh `users` DBs** (run 52 left its
attribution open: "pull the SQLSTATE from staging logs"). **Run 53 finding:
that instruction was impossible as written — Cloudflare preview-URL
invocations emit NO logs anywhere (Workers Logs, `wrangler tail`, Logpush all
exclude them; verified against CF docs + a telemetry-API sweep of the full
run-52 window: zero preview events, prod-only rows).** Every prior e2e
diagnosis ran blind; the run-48 ACL gap's nine-run cost was this hole. Run 53
lever: **SK-ASK-023** — the exec catch-all now persists `(pgCode, pgMessage,
db_id, cache_hit, plan_model)` to a 7-day-TTL `diag:exec_db_unreachable:*` row
in the shared KV namespace (bindings DO cross the preview boundary; proven by
queue events arriving from the preview mid-dispatch), pullable offline via the
CF REST API. Verdict from the first full-depth `ab` dispatch on the fix SHA:
see *Last change*. Not anti-rut-blocked (last 5 merged = E2E, engine,
onboarding, E2E, distribution).

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (fresh 07-11 22:40Z pull — CF GraphQL + remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 111 visits / 134 pageloads (07-04→07-11 22:40Z, raw). Walker filter (run 12, `userAgentBrowser` cut): "Unknown" 67 + headless 1 ⇒ **real-browser ≈ 43 visits** (Chrome 35, ChromeMobile 3, MobileSafari 2, Firefox 2, Edge 1) — flat vs run 52's ≈ 43 | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (re-verified 07-11 22:40Z) |
| 3 | DBs total | 157; latest activity 07-11 22:34 UTC (run 53's own verification dispatch — fixture traffic) | 156 (run 52 post-purge) +1; stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not yet measurable** (fresh 07-11 22:40Z remote-D1; method `SK-ONBOARD-007`). Unfiltered counters 2/6 over 3 rows — all founder/test per the email join (live-dispatch fixture asks included) | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 2 DBs with `first10_asks ≥ 2` (07-11 22:40Z, same attribution caveat as row #4) | share of DBs with `first10_asks ≥ 2` |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **95** (`/vs` 31 + `/solve` 33 + `/blog` 31) — run 53 published `most-active-user-is-your-test-suite` (the run-50 measurement-hygiene draft; 114 built pages at run 53's sweep, 115 with #664's `five-fallback…` post, which landed after it). Pending queue drafts **2** (`ownership-transfer…` [collapsed gist] + `ephemeral-staging…`) ⇒ < 3 ⇒ next run drafts one, per step 3 | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts 31 (run 53: +`most-active-user…`; run 51: +`five-fallback…`); 7d external referrals = **9** (bing 8, github 1 — 07-11 22:40Z pull; 1 → 6 → 9 over the last week). Syndication feeds 1 (`/rss.xml`); internal links **2,808** (run-53 sweep, pre-#664's 31st post — next sweep re-counts) | CF `refererHost` — measured every run. External-referral yield holding (bing-led) |
| | **Engine** — BIRD 07-11 · Spider 07-11 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.546** (272/498 EA, 2 `gold_error`, 07-11 canonical on main `2cfda39`, [run 29144102081](https://github.com/nlqdb/nlqdb/actions/runs/29144102081) — completed in ONE window, `no_sql` 0/500, first fully capacity-clean canonical). Δ +2.01 pp vs 07-05, McNemar b=31/c=41, `regressions: []`. Baseline re-seeded. Measured pre-`SK-LLM-044`; next canonical re-verifies | target 0.65 / **Phase 2 floor 0.60** — gap 5.4 pp. Offline levers exhausted; SC dead (#619); frontier-lens closed (run 15) |
| 9 | Spider raw EX | **0.2963** (40/135, `no_sql` 0/135, exec_error 3, gold_error 0 — 07-11 canonical on `6e1725c` with `SK-LLM-044`, nine-window `SK-QUAL-013` resume [29160009809](https://github.com/nlqdb/nlqdb/actions/runs/29160009809) → [29164092490](https://github.com/nlqdb/nlqdb/actions/runs/29164092490)). Was 0.2741 (37/135, run 49's first fully-answered run) | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is its source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004) — flat vs 07-02) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06 run 15, `SK-QUAL-022`). persona-bench −4.35 pts (07-09, one-question noise at N=23) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69–0.70 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers analytics (fresh 07-11 22:40Z pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 5,027 / 0 (0.00%) | mcp-server 447 req / 0 err; events-worker 27 req |
| 13 | nlqdb-api wall-time p50 / p95 | p95 ~1.57 s (max adaptive bucket); p50 method-sensitive across adaptive-sample buckets (~request-weighted 0.3–0.6 s) | mcp-server p95 ≈ 762 ms this window; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.53** — sdk ✅ · mcp ✅ · examples ✅ 07-09 21:00Z (0.70 each after 2.1d decay) · opencheck ❌ 0. **Run 53 closed the *diagnosability* hole on the surviving red:** preview invocations log nowhere (CF-documented), so the "intermittent" `db_unreachable` class was undiagnosable by design; SK-ASK-023's KV diag rows named it in one dispatch — **18/18 rows = PG 22023 missing tenant role on the adopted `users` DB ⇒ the adoption ACL retarget silently fails in e2e** (role absent + RLS literal still anon, verified live on the branch). Next lever: pull `diag:anon_adopt_regrant_failed:*` from one `depth=a` dispatch (the catch is now instrumented) and fix the retarget's e2e failure | Sequencing rule (unchanged): never dispatch opencheck alongside another consumer of its lanes. Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.546, 07-11); agentic-frontier ≥ 0.80 (0.693, Δ 18.66 ✓); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (stranger N=0); destructive-op retry < baseline (instrumented run 38, N≈0); MCP in 3+ host apps (07-11 `scripts/mcp-hosts.sh`: 0 stranger hosts, 1 founder host — FAIL); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | every criterion instrumented; only agent-movable *pass* left is the agentic-frontier ~11 pp competence lift (`SK-LLM-017` premium chain, or the parked corrected-set); rest are stranger-dependent |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **17** (fresh grep 07-11 run 53 — count held) | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. De-prioritised as a default lever per the 07-11 /weekly (monoculture, no external yield) || 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting** (07-11 run-53 sweep: **114** pages, **2,808** internal links — +1 page = the new `most-active-user…` post; #664's `five-fallback…` post landed after the sweep — next sweep re-counts) | target 0 — `bun run build && bun run check:links` in `apps/web` |

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

**2026-07-11 (run 53)** — lever: **SK-ASK-023 — durable diagnostics across
the preview boundary (row #15, the weekly focus).** Step-0: #664 (run 51, Spider directive), #665 (run 52, fixture purge) and
#666 (weekly refocus) merged first; this entry reconciled on top of all
three per the second-merge rule. **Diagnosis first:** run 52 ended on "pull `recordExecUnreachable`'s
SQLSTATE from staging logs" — measured today, that instruction is impossible:
Cloudflare stores no telemetry for preview-URL invocations (Workers Logs,
`wrangler tail`, Logpush all exclude them; CF docs + a telemetry-API sweep of
the full run-52 window — zero preview events, prod-only rows). Every e2e
failure diagnosis to date ran blind; the run-48 nine-run misdiagnosis was
this hole. **Change:** the exec catch-all and the adopt-regrant catch now
persist `(pgCode, pgMessage, dbId, …)` as 7-day-TTL `diag:<event>:*` rows in
the shared KV namespace (bindings DO cross the preview boundary — queue
events arriving from the preview mid-dispatch proved it); `ask/diag.ts`,
swallowed `nlqdb.diag.write` span, SK-ASK-023 canonical (ask-pipeline
FEATURE sharded per D4, net-shrink). **Measured verdict** (first `ab`
dispatch on the fix SHA, [29170696769](https://github.com/nlqdb/nlqdb/actions/runs/29170696769)):
**channel live and the class named within one run** — **18/18** preview-source
rows pulled (7 mid-Suite-A, 11 more from Suite B; A ❌ · B ❌ · C skipped at
`depth=ab`), every one identical: `pg_code 22023 · role
"tenant_9047fe6e4d69026b" does not exist` on `db_users_2b6bb8`, the fixture
user's *adopted* DB — fully deterministic, not intermittent.
Cross-checked live on the still-running e2e branch (Neon SQL-over-HTTP): the
tenant role **does not exist** and the RLS literal **still names the anon
creator** ⇒ the run-48 adoption ACL retarget **silently fails in the e2e
environment** — "intermittent db_unreachable" was mislabeled connectivity;
it's deterministic per adopted DB. The retarget's own failure log
(`anon_adopt_regrant_failed`) was preview-invisible too — now also a diag
row, so the *why* is one `depth=a` dispatch + one KV pull away (**next lever
candidate**). Δ: the surviving red's SQLSTATE went unpullable → pulled +
root-caused; run 52's open attribution: closed. **Step-1:** full re-pull
22:40Z (rows #1–#5, #12–#13, #15, #17, #18). **Artifact (step 3):** queue
≥ 3 on main ⇒ published the oldest unclaimed draft
https://nlqdb.com/blog/most-active-user-is-your-test-suite/ (rows #6/#7: 95
surfaces, 31 posts post-merge). **KPI:** GLOBAL-025 engine quality (E2E signal
integrity — staging failures are now self-diagnosing) advanced; **none
degrade** (failure-path-only code — happy path, prompts, and eval baselines
untouched).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
