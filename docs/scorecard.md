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
engine lever unparks. Row #15's claimed path has landed — #668 (diag
sink + adoption-ACL root cause, run 53) and #670 (sdk/mcp/examples
re-dispatch, run 55: 0.50 → 0.75) merged; the remaining opencheck red is
the named ACL-retarget fix — so run 56 pulled the next-priority lever: the
real-UX-flow class (founder-directed priority 1, PR #667) surfaced by the
stranger walkers — see *Worst number* and *Last change*.

**Worst number today:** real strangers reaching a first answer = **0** —
and run 56 found it was **structural, not just lagging**: since at least
07-05 every anonymous create on prod returned `428 challenge_required`
(Turnstile ran fail-closed with no secret provisioned and no widget
shipped — `solveChallenge()` is a stub), so no stranger *could* reach a
first answer; the client showed "Refresh and try again in a moment."
forever. **Run 56 lever: restore SK-ANON-009 fail-open** (code contradicted
the documented decision) — verified by A/B preview probe: main → 428, fix →
**200 with a full created DB** under `NODE_ENV=production`. The wall is
gone at the gate; prod delta lands on merge (deploy-api auto-fires; the
06:00Z acquisition cron re-walks FLOW-003). Remaining walker reds are
drift, not product: FLOW-001/002 assert the pre-redesign surface (two-door
home moved the goal input to `/app/new/`; solve copy now "doesn't try to
do") and flow-005-stdio expects the pre-memory 4-tool catalog — named
next-lever candidates (row #21). Not anti-rut-blocked (last 5 merged =
E2E/CI, weekly-process, E2E-diag, E2E-dispatch, CLI-release — this run
is onboarding/UX).

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (fresh 07-12 11:05Z pull — CF GraphQL + remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 112 visits / 135 pageloads (07-05→07-12 11:04Z, raw). Walker filter (run 12, `userAgentBrowser` cut): "Unknown" 67 + headless 1 ⇒ **real-browser ≈ 44 visits** (Chrome 36, ChromeMobile 3, MobileSafari 2, Firefox 2, Edge 1) | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (re-verified 07-12 11:05Z). Structural wall removed run 56 (see *Last change*) — anon first value was 428-dead since ≥ 07-05 |
| 3 | DBs total | **157**; latest activity 07-11 22:34 UTC (= #668's e2e fixture dispatch — noise; run-56 probe row created + deleted during verification) | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not yet measurable** (07-12 11:05Z remote-D1; method `SK-ONBOARD-007`). Unfiltered 4/13 ok — dominated by `db_users_2b6bb8` 2/10 (e2e fixture row from #668's dispatch; previews share prod D1); real founder/test rows: 2/2 + old 0/1. Note: stranger N was structurally pinned at 0 by the 428 wall (run 56) — instruments were waiting on users who could not exist | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 2 DBs with `first10_asks ≥ 2` (07-12 11:05Z; one is the e2e fixture row — same caveat as row #4) | share of DBs with `first10_asks ≥ 2` |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **97** (`/vs` 31 + `/solve` 33 + `/blog` 33) — run 54 (#669) published `ownership-transfer-outlives-least-privilege`, run 56 `ephemeral-staging-persistent-registry` (117 built pages, in rss/llms/sitemap). Pending drafts **1** (run 55's `green-checkmark-has-a-half-life`; open #667 claims none) ⇒ < 3 ⇒ next run may draft (step 3) | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts 33 (run 54: +`ownership-transfer…`; run 56: +`ephemeral-staging-persistent-registry`); 7d external referrals = **9** (bing 8, github 1 — 07-12 11:05Z pull; was 9 on 07-11, 6 on 07-09, 1 on 07-06). Syndication feeds 1 (`/rss.xml`); internal links **2,883** (run-56 reconciled-tree build) | CF `refererHost` — measured every run. External-referral yield holding (bing-led) as indexation lands |
| | **Engine** — BIRD 07-11 · Spider 07-11 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.546** (272/498 EA, 2 `gold_error`, 07-11 canonical on main `2cfda39`, [run 29144102081](https://github.com/nlqdb/nlqdb/actions/runs/29144102081) — completed in ONE window, `no_sql` 0/500, first fully capacity-clean canonical). Δ +2.01 pp vs 07-05, McNemar b=31/c=41, `regressions: []`. Baseline re-seeded. Measured pre-`SK-LLM-044`; next canonical re-verifies | target 0.65 / **Phase 2 floor 0.60** — gap 5.4 pp. Offline levers exhausted; SC dead (#619); frontier-lens closed (run 15) |
| 9 | Spider raw EX | **0.2963** (40/135, `no_sql` 0/135, exec_error 3, gold_error 0 — 07-11 canonical on `6e1725c` with `SK-LLM-044`, nine-window `SK-QUAL-013` resume [29160009809](https://github.com/nlqdb/nlqdb/actions/runs/29160009809) → [29164092490](https://github.com/nlqdb/nlqdb/actions/runs/29164092490)). Was 0.2741 (37/135, run 49's first fully-answered run) | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is its source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004) — flat vs 07-02) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06 run 15, `SK-QUAL-022`). persona-bench −4.35 pts (07-09, one-question noise at N=23) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69–0.70 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers analytics (fresh 07-12 11:04Z pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 5,159 / 0 (0.00%) (07-12 11:04Z pull) | mcp-server 438 req / 0 err; events-worker 30 req |
| 13 | nlqdb-api wall-time p50 / p95 | p95 ~1.63 s (max adaptive bucket); p50 ~0.58 s request-weighted across buckets | mcp-server p95 ≈ 760 ms this window; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.72** — sdk ✅ · mcp ✅ · examples ✅ all 07-12 04:13Z on main (run 55's dispatch, ≈0.96 each after decay at 11:20Z) · opencheck ❌ 0 (latest dispatch [29170696769](https://github.com/nlqdb/nlqdb/actions/runs/29170696769), #668's verification run: 18/18 diag rows `pg_code 22023`, missing tenant role on the adopted `users` DB — the run-48 adoption-ACL retarget silently fails in e2e, deterministic; #668 merged the diag sink, the retarget fix is the named next lever) | Sequencing rule (unchanged): never dispatch opencheck alongside another consumer of its lanes. Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.546, 07-11); agentic-frontier ≥ 0.80 (0.693, Δ 18.66 ✓); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (stranger N=0); destructive-op retry < baseline (instrumented run 38, N≈0); MCP in 3+ host apps (07-11: 0 stranger hosts, 1 founder host — FAIL); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | every stranger-dependent criterion was double-gated until run 56: the instruments waited on strangers, and the 428 wall guaranteed zero strangers. Wall removed; criteria now measure reality |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **17** (fresh grep 07-12 run 56 — held) | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. De-prioritised as a default lever per the 07-11 /weekly (monoculture, no external yield) |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting** (07-12 run-56 reconciled-tree sweep: **117** pages, **2,883** internal links — +1 page vs run 54's sweep = the `ephemeral-staging-persistent-registry` post) | target 0 — `bun run build && bun run check:links` in `apps/web` |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **1 open (founder-blocked)** — `brew install nlqdb/tap/nlq` advertised (`cli/README.md`, npm-shim fallback, SK-CLI-002) but the tap empty since 2026-05-19; blocked on the `HOMEBREW_TAP_GITHUB_TOKEN` PAT (top `blocked-by-human.md` bullet); releases no longer fail on it (run-54 fix, #669). Run 56 found + closed the largest gap to date: the homepage promise "No account needed to try" was 428-dead on prod (see *Last change*). Runs 32 + 37 each found + closed 1 | claim-vs-reality on shipped surfaces + docs; target 0. Standing candidate: extend `check:links` to assert each advertised capability has shipped code |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) · picker parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal; only genuine remaining slot is the premium chain |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **0/9** FLOW-001/002/003 (07-12 06:00Z cron [29185838512](https://github.com/nlqdb/nlqdb/actions/runs/29185838512); 0/9 since ≥ 07-05 — the cron exits 0 by design, so this was invisible until it had a row). Classes: FLOW-003 = the 428 wall (**fixed run 56**, expect 3/9 next cron post-merge); FLOW-001/002 = walker drift vs the shipped two-door home (`/app/new/` input; "doesn't try to do" copy); flow-005 hosted ✅ 6/6, stdio ❌ (expects 4-tool pre-memory catalog). Walker re-true = next-lever candidate | target 9/9 + both FLOW-005 transports. This row exists so a red walker can never again be silent (GLOBAL-032 freshness rule assumed *pass* freshness, not just run freshness) |
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

**2026-07-12 (run 56)** — lever: **restore SK-ANON-009 fail-open — the prod
anonymous funnel was 428-dead (rows #2/#4/#21).** Step 0: #668 (run 53,
diag sink + adoption-ACL root cause; published `most-active-user…`), #670
(run 55, row #15 0.50 → 0.75) and #669 (run 54, deploy-cli tap-push gate;
published `ownership-transfer…`) merged first; this entry reconciled on
top of all three per the second-merge rule. Still open: #667 (daily.md
rules) — no overlap with this lever or artifact.
**Finding (via the priority-1 real-UX-flow route, PR #667):**
today's acquisition-health artifact shows the canonical stranger walkers
**0/9 — and 0/9 in every artifact back to 07-05** (the cron exits 0 by
design; no scorecard row existed — row #21 added). FLOW-003's red was real product:
`POST /v1/ask` as a fresh anon returns `428 challenge_required` on prod
(reproduced directly). Root cause: `peekAnonCreateGate` hardened Turnstile
`unconfigured` to fail CLOSED under `NODE_ENV=production|canary` — but
**SK-ANON-009's canonical decision says `unconfigured` is allow-through and
explicitly rejects fail-closed**, and its premise ("production ALWAYS has
the secret set") was false: `TURNSTILE_SECRET` was never provisioned, the CF
account has zero Turnstile widgets, and the client widget was never built.
§10.2: code wrong, decision right → fixed the code
(removed the `isProd` carve-out + plumbing; SK-ANON-009 amended in place
with the real invariant: set the secret only in the release that ships the
widget; FEATURE.md net-shrank per D4). Abuse bounds unchanged
(SK-ANON-012 device cap, SK-ANON-010 global caps, per-IP buckets).
**Measured verdict (A/B preview probe, identical env,
`NODE_ENV=production`, same request):** main baseline → **HTTP 428**; fix →
**HTTP 200, full first value** (LLM plan + schema provisioned + `pk_live`
issued; probe D1 row + Neon branch deleted after). Δ > 0 — keep. Prod
flips on merge (deploy-api auto-fires); tomorrow's 06:00Z cron re-walks
FLOW-003 as the live confirmation. **Also found, not pulled (named for next
runs):** FLOW-001/002 + flow-005-stdio walker drift vs the shipped surface
(row #21), and `nlqdb-api-canary` 500s on every `/v1/*` route on the
current main build (manual secret drift — deploy workflow green, runtime
red; rule-6-adjacent). **Step 1:** full funnel/ops re-pull 11:05Z (rows
#1–#5, #12–#13); docs-ambiguity re-grep (17, held); link sweep on the
reconciled tree 117 pages / 2,883 links / 0 dead. **Artifact (step 3):**
queue ≥ 3 on main and the only unclaimed draft was
`ephemeral-staging-persistent-registry` → published (row #6: 96 → 97;
queue entry → venue pointer; pending drafts 1 ⇒ < 3 ⇒ next run may
draft). **KPI:** GLOBAL-025
onboarding (the no-login-wall first-value promise, GLOBAL-007, is true
again) + UX (the stranger path delivers instead of erroring); **none
degrade** (failure-path config removed, happy path unchanged; prompts, eval
baselines, CI lanes untouched — engine rows #8–#11 carried unchanged).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
