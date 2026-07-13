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
engine lever unparks. Row #15 state (07-13 02:58Z recompute): all four
suites green — sdk/mcp/examples 07-12 04:13Z, opencheck's first green
main run 07-12 13:18Z
([29194166944](https://github.com/nlqdb/nlqdb/actions/runs/29194166944));
**≈ 0.88** and decaying only with the calendar (no new dispatch this
run). With #15 near ceiling and row #21 maxed (9/9), run 61 pulled the
next-priority *distribution/surface-integrity* lever per the ordering:
**the cross-app dead-link blind spot (row #18)** — see *Worst number*
and *Last change*.

**Worst number today:** real strangers reaching a first answer = **0**
(row #2; funnel open since run 56, lagging — moved only through its
agent-controllable inputs; the top UX-flow input, row #21, is now maxed
9/9). With every canonical flow green and #15 near ceiling, the live
agent-movable lever is **distribution / surface integrity** (founder
order priority 2). **Run 61 finding:** the `check:links` dead-link sweep
(row #18) only classed `https://nlqdb.com` + relative paths as internal;
every `href`/`src` to an owned subdomain (`docs./app./mcp.nlqdb.com`) was
dropped by `isInternal` and **never checked** — exactly the class the
2026-07-02 docs-site 404 shipped through (a marketing→docs link nobody
swept). **Run 61 lever: extend the sweep to live-verify cross-app links
— 14 `docs.nlqdb.com` funnel links now swept every build (0 → 14
covered), 0 dead.** Not anti-rut-blocked (last 5 merged = walker-correct,
create-trace, walker-re-true, e2e-fix, anon-fail-open — all
flow/quality; this is the first distribution/integrity pull in the
window). Next agent-movable lever stays distribution yield (rows #6/#7)
or the engine lane (row #9 Spider).

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (fresh 07-13 02:58Z pull — CF GraphQL + remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 232 pageloads (07-06→07-13 02:58Z, raw). Walker filter (run 12, `userAgentBrowser` cut): "Unknown" 183 ⇒ **real-browser ≈ 49 pageloads** (Chrome 41, ChromeMobile 3, MobileSafari 2, Firefox 2, Edge 1) | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (re-verified 07-13 02:52Z). The 428 wall is gone (run 56, live since 13:03Z); acquisition now depends on distribution yield |
| 3 | DBs total | **223** (07-13 02:52Z; +58 vs 07-12, synthetic — walker/preview traffic; previews share prod D1) | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not yet measurable** (07-12 19:41Z remote-D1; method `SK-ONBOARD-007`). Only 3/165 DBs have `first10_asks > 0` (Σok 3 / Σasks 4), all founder/test | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12 19:41Z; founder-owned) | share of DBs with `first10_asks ≥ 2` |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **98** (`/vs` 31 + `/solve` 33 + `/blog` 34). Run 60 published the oldest queued draft (`green-checkmark-has-a-half-life`, step 3); pending drafts **3 → 2** (run 57's `one-shot-recovery-permanent-outage`, run 58's `smoke-test-walks-the-old-ui`) | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **34**; 7d external referrals = 9 (bing 8, github 1 — carried 07-12 19:39Z pull; was 6 on 07-09, 1 on 07-06). Syndication feeds 1 (`/rss.xml`); internal links **2,908** + **14 cross-app** (run-61 build: 118 pages, 0 dead — row #18) | CF `refererHost` — carried from 19:39Z (strangers unchanged). External-referral yield holding (bing-led) as indexation lands |
| | **Engine** — BIRD 07-11 · Spider 07-11 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.546** (272/498 EA, 2 `gold_error`, 07-11 canonical on main `2cfda39`, [run 29144102081](https://github.com/nlqdb/nlqdb/actions/runs/29144102081) — completed in ONE window, `no_sql` 0/500). Δ +2.01 pp vs 07-05, McNemar b=31/c=41, `regressions: []`. Baseline re-seeded. Measured pre-`SK-LLM-044`; next canonical re-verifies | target 0.65 / **Phase 2 floor 0.60** — gap 5.4 pp. Offline levers exhausted; SC dead (#619); frontier-lens closed (run 15) |
| 9 | Spider raw EX | **0.2963** (40/135, `no_sql` 0/135, exec_error 3, gold_error 0 — 07-11 canonical on `6e1725c` with `SK-LLM-044`, nine-window `SK-QUAL-013` resume [29160009809](https://github.com/nlqdb/nlqdb/actions/runs/29160009809) → [29164092490](https://github.com/nlqdb/nlqdb/actions/runs/29164092490)). Was 0.2741 | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is its source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004) — flat vs 07-02) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06 run 15, `SK-QUAL-022`). persona-bench −4.35 pts (07-09, one-question noise at N=23) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69–0.70 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers analytics (fresh 07-13 02:58Z pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 4,974 / 0 (0.00%) | mcp-server 473 req / 0 err; events-worker 31 req; canary 4 req / 0 err this window (secret-drift re-provisioning still tracked in `blocked-by-human.md`) |
| 13 | nlqdb-api wall-time p50 / p95 | p50 ≈ 0.61 s / p95 ≈ 1.70 s | mcp-server p95 ≈ 755 ms this window; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **≈ 0.88** at 07-13 02:58Z — sdk ✅ · mcp ✅ · examples ✅ all 07-12 04:13Z on main (≈0.86 each) · opencheck ✅ first green main conclusion 07-12 13:18Z ([29194166944](https://github.com/nlqdb/nlqdb/actions/runs/29194166944), ≈0.92). The run-53 "deterministic ACL retarget" red root-caused + fixed in #672 (run 57, merged): dynamic-import crash on fresh isolates (`pg-client.ts` split) + `SK-ASK-024` heal; depth=ab re-verify app-side clean, residual red = agent-lane capacity | Sequencing rule (unchanged): never dispatch opencheck alongside another consumer of its lanes. Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.546, 07-11); agentic-frontier ≥ 0.80 (0.693, Δ 18.66 ✓); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (stranger N=0); destructive-op retry < baseline (instrumented run 38, N≈0); MCP in 3+ host apps (07-11: 0 stranger hosts, 1 founder host — FAIL); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 removed the 428 wall |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **17** (fresh grep 07-13 run 61 — held) | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. De-prioritised as a default lever per the 07-11 /weekly (monoculture, no external yield) |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** (07-13 run-61 sweep: **118** pages, **2,908** internal + **14 cross-app** links). Run 61 **added cross-app coverage** — `href`/`src` to owned subdomains (`docs./app./mcp.nlqdb.com`) were dropped by `isInternal` and never checked; the sweep now live-verifies them (4xx/5xx = dead & hard-fail; auth/method gate = alive; network error = "unverified", never red). 14 `docs.nlqdb.com` funnel links now covered (0 → 14) | target 0 — `bun run build && bun run check:links` in `apps/web` |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **1 open (founder-blocked)** — `brew install nlqdb/tap/nlq` advertised (`cli/README.md`, npm-shim fallback, SK-CLI-002) but the tap empty since 2026-05-19; blocked on the `HOMEBREW_TAP_GITHUB_TOKEN` PAT (top `blocked-by-human.md` bullet); releases no longer fail on it (run-54 fix, #669). Runs 32 + 37 + 56 each found + closed 1 | claim-vs-reality on shipped surfaces + docs; target 0. Standing candidate: extend `check:links` to assert each advertised capability has shipped code. Run 59 closed a cousin gap: trust-ux docs claimed create-path trace parity that the wire didn't ship |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) · picker parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal; only genuine remaining slot is the premium chain |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **9/9 + both FLOW-005 transports** ✅ (run-60 branch dispatch [29211619838](https://github.com/nlqdb/nlqdb/actions/runs/29211619838) against prod: FLOW-001 3/3 · FLOW-002 3/3 · FLOW-003 3/3 · FLOW-005 walk + stdio both `passed`). FLOW-001's step-8 red was the walker asserting a 2nd anon `/v1/ask` 200 — impossible under `SK-ANON-012`'s message-#2 wall; step 8 now asserts the 401 cap (dt 296–337 ms). Before: main dispatch [29211269726](https://github.com/nlqdb/nlqdb/actions/runs/29211269726) FLOW-001 0/3 step-8 `status=401`. The run-59 "morph-to-chat gap" is **decided, not a gap**: the anon terminus IS the sign-in redirect (SK-ANON-011 stash → SK-ANON-003 adopt); the SK-WEB-002 chat is the post-sign-in /app surface | target 9/9 + both FLOW-005 ✅ **met**. The corrected walker runs on main at the next 06:00Z cron; step-7 copy-affordance skip (button reads "Copy" not "Copy snippet") is a benign found-not-pulled |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/20 + 12 memory `/vs` pages | tick on merge; mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — the only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; E-03…E-07 all Neon/infra-gated |
| | Memory-quality eval (`SK-QUAL-023`) | harness shipped — EX unmeasured | 15 gold-verified questions, 4 axes; a scored dispatch + the vector head-to-head are the next slices |

## Shipped distribution (live URLs)

Canonical copies on `/blog` (`SK-BLOG-001`); venue variants stay in
`research/distribution-queue.md` as pointers:

- https://nlqdb.com/blog/green-checkmark-has-a-half-life/ (run 60 — CI/measurement lesson, the row #15 freshness method: when an expensive suite can't run on every push, "passing" is an event not a state — score `pass × freshness` with a linear decay so the number rots until someone re-runs it)
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

**2026-07-13 (run 61)** — lever: **extend the `check:links` dead-link
sweep to cover cross-app links (row #18, surface integrity / distribution
priority-2).** Step 0: no open PRs; rule-6 health clean — all 7
push-deploys success on main `cfbf291` (deploy-api/web/docs all ✅);
local `bun run typecheck` (12/12 workspaces) + `bun run lint` (exit 0) +
`@nlqdb/web test` (244 pass / 0 fail) green. **Why this lever:** row #21
maxed 9/9 and row #15 near ceiling ⇒ the UX-flow input is spent; per the
founder order the live lever is distribution / surface integrity, and
the last 5 merged dailies were all flow/quality (anti-rut clear).
**The finding:** the sweep's `isInternal` classed only `https://nlqdb.com`
+ relative paths as internal; every `href`/`src` to an owned subdomain
(`https://docs./app./mcp.nlqdb.com`) fell through and was **never
checked** — the exact blind spot the 2026-07-02 docs-site 404 shipped
through (a marketing→docs link nobody swept, unnoticed for weeks).
**The change:** `apps/web/scripts/check-links.mjs` now collects every
cross-app `href`/`src` to an owned subdomain from built HTML and
live-verifies each distinct one: a definitive 4xx/5xx is dead (hard
fail, exit 1); an auth/method gate (401/403/405) counts as alive; a
network error is reported "unverified" and never fails the sweep, so an
offline run degrades to the internal-only result. API endpoints
(`/v1/ask`, `/mcp`) and copy-paste code snippets (`elements.../v1.js`)
appear only as code text, not `href`/`src`, so they stay correctly out
of scope. **Measured (same instrument, `bun run build && check:links`):**
before = 118 pages, 2,908 internal links checked, **0 cross-app links
checked** (all silently dropped) → after = same 118 pages / 2,908
internal, **14 `docs.nlqdb.com` funnel links now swept, 0 dead, 0
unverified** (all 200). **Row #18 cross-app coverage 0 → 14 links —
0 dead.** Δ > 0 — keep. **Artifact (step 3):** skipped — queue is 2-deep
(< 3), no publish; no new draft (P4/founder-2026-07-11: drafting is not a
run's output). **Step 1:** fresh 02:52–02:58Z pulls — visits 232
pageloads (real-browser ≈ 49); users 9 (4 founder + 5 test), strangers
**0**; DBs 165 → 223 (synthetic); nlqdb-api 4,974 req / 0 err;
docs-ambiguity 17 (held); row #15 ≈ 0.92 → 0.88 (calendar decay, no new
e2e dispatch). **KPI:** GLOBAL-025 UX + distribution (a dead
marketing→docs link silently loses a stranger; the funnel's cross-app
hops are now swept every build) — **none degrade** (one build-script
change; no product, prompt, eval-baseline, CI-lane, or shipped-source
change; engine rows #8–#11 and walker row #21 carried).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
