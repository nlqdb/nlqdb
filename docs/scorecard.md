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
lagging metric moved only through its agent-movable inputs. On row #15,
run 52 (#665) closed the stale-fixture class, run 53's `SK-ASK-023` diag
sink (#668, merged) proved the adoption-ACL retarget silently fails in
e2e (18/18 diag rows `pg_code 22023`; the retarget repair is the named
next lever), and run 55 (#670, merged) re-dispatched the three green
suites (row #15 0.50 → 0.75). **Run 54 lever (rule 6 — red deploy
on main outranks everything): deploy-cli had NEVER been green — 10/10 runs
failed 2026-05-19 → 07-11** at the Homebrew tap push
(`HOMEBREW_TAP_GITHUB_TOKEN` never valid → 401 *after* the GitHub Release
publishes), contradicting the
runbook's documented behavior ("without it … only the tap bump silently
skips"). Fixed by gating the tap push on token presence
(`skip_upload` template, `cli/.goreleaser.yml`) — verified against the
goreleaser publish pipe source + a local snapshot run with the env var
absent; the merge itself auto-fires deploy-cli (`cli/**` path filter), which
is the live green re-measure. The PAT itself is founder-only →
top bullet in `blocked-by-human.md`; until set, `brew install
nlqdb/tap/nlq` stays a tracked row #19 claim gap (tap empty). Not
anti-rut-blocked (last 5 merged = E2E-dispatch, E2E-diag, E2E/CI, weekly
refocus, engine).

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (fresh 07-12 04:15Z pull — CF GraphQL + remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 111 visits / 134 pageloads (07-05→07-12 04:15Z, raw). Walker filter (run 12, `userAgentBrowser` cut): "Unknown" 67 + headless 1 ⇒ **real-browser ≈ 43 visits** — Chrome 35, ChromeMobile 3, Firefox 2, MobileSafari 2, Edge 1 | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (re-verified 07-12 04:15Z) |
| 3 | DBs total | **157** (+1 vs run 52's post-purge 156); latest activity 07-11 22:34 UTC (run 53's #668 verification dispatch — fixture traffic) | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not yet measurable** (fresh 07-12 remote-D1; method `SK-ONBOARD-007`). Unfiltered counters 4/13 ok across 3 counted DBs — dominated by the e2e adoption-ACL failures diagnosed by run 53's `SK-ASK-023` (#668, merged) | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel. Deleted-row counters are a known caveat of DB-row-scoped counters (run 52's `SK-E2E-007` purge deletes fixture rows every run); stranger-only method unaffected (their DBs persist) |
| 5 | Session retention (≥ 2 queries) | 2 DBs with `first10_asks ≥ 2` (07-12, same fixture caveat as row #4) | share of DBs with `first10_asks ≥ 2` |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **96** (`/vs` 31 + `/solve` 33 + `/blog` 32) — run 53 (#668) published `most-active-user-is-your-test-suite`, run 54 `ownership-transfer-outlives-least-privilege` (116 built pages, in rss/llms/sitemap). Pending drafts **2** (run 52's `ephemeral-staging-persistent-registry` + run 55's `green-checkmark-has-a-half-life`; only #667 remains open and claims neither) ⇒ < 3 ⇒ next run may draft (step 3) | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts 32 (run 53: +`most-active-user…`, run 54: +`ownership-transfer…`); 7d external referrals = **9** (bing 8, github 1 — 07-12 04:15Z pull; was 6 on 07-09, 1 on 07-06). Syndication feeds 1 (`/rss.xml`); internal links **2,858** (run-54 reconciled-tree build) | CF `refererHost` — measured every run. External-referral yield holding (bing-led, 1 → 6 → 9) as indexation lands |
| | **Engine** — BIRD 07-11 · Spider 07-11 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.546** (272/498 EA, 2 `gold_error`, 07-11 canonical on main `2cfda39`, [run 29144102081](https://github.com/nlqdb/nlqdb/actions/runs/29144102081) — completed in ONE window, `no_sql` 0/500, first fully capacity-clean canonical). Δ +2.01 pp vs 07-05, McNemar b=31/c=41, `regressions: []`. Baseline re-seeded. Measured pre-`SK-LLM-044`; next canonical re-verifies | target 0.65 / **Phase 2 floor 0.60** — gap 5.4 pp. Offline levers exhausted; SC dead (#619); frontier-lens closed (run 15) |
| 9 | Spider raw EX | **0.2963** (40/135, `no_sql` 0/135, exec_error 3, gold_error 0 — 07-11 canonical on `6e1725c` with `SK-LLM-044`, nine-window `SK-QUAL-013` resume [29160009809](https://github.com/nlqdb/nlqdb/actions/runs/29160009809) → [29164092490](https://github.com/nlqdb/nlqdb/actions/runs/29164092490)). Was 0.2741 (37/135, run 49's first fully-answered run) | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is its source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004) — flat vs 07-02) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06 run 15, `SK-QUAL-022`). persona-bench −4.35 pts (07-09, one-question noise at N=23) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69–0.70 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers analytics (fresh 07-12 04:15Z pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 5,148 / 0 (0.00%) | mcp-server 447 req / 0 err; events-worker 30 req |
| 13 | nlqdb-api wall-time p50 / p95 | ~356 ms / ~1.52 s (request-weighted mean of per-day adaptive-sample quantiles — earlier "~24 ms" pulls weighted by bucket, not requests; this method pins to request weight) | mcp-server p50 ~6 ms / p95 ≈ 730 ms (SSE tails excluded by 7d window); `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.75** (was 0.50 at 07-12 04:12Z) — sdk ✅ · mcp ✅ · examples ✅ all re-dispatched + green 07-12 04:13Z on main `c4fc468` (runs [29179395303](https://github.com/nlqdb/nlqdb/actions/runs/29179395303) · [29179395870](https://github.com/nlqdb/nlqdb/actions/runs/29179395870) · [29179396550](https://github.com/nlqdb/nlqdb/actions/runs/29179396550)) · opencheck ❌ 0 — stale-fixture class closed by run 52's `SK-E2E-007` purge (#665: A 4/5 · B 4/8 · C 9/9, first fully-green Suite C); run 53 (#668, merged) landed the `SK-ASK-023` diag channel and named the class in one dispatch ([29170696769](https://github.com/nlqdb/nlqdb/actions/runs/29170696769)): 18/18 diag rows `pg_code 22023`, missing tenant role on the adopted `users` DB ⇒ the run-48 adoption-ACL retarget silently fails in e2e — deterministic, not intermittent; the retarget fix itself did not land with #668 | **Sequencing rule: never dispatch opencheck alongside another OpenRouter-free consumer.** Residual class tracked in `e2e-coverage/opencheck-operations.md`; next lever: pull `diag:anon_adopt_regrant_failed:*` from a `depth=a` dispatch + fix the retarget |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.546, 07-11); agentic-frontier ≥ 0.80 (0.693, Δ 18.66 ✓); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (stranger N=0); destructive-op retry < baseline (instrumented run 38, N≈0); MCP in 3+ host apps (07-11 `scripts/mcp-hosts.sh`: 0 stranger hosts, 1 founder host — FAIL); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | every criterion instrumented; only agent-movable *pass* left is the agentic-frontier ~11 pp competence lift (`SK-LLM-017` premium chain, or the parked corrected-set); rest are stranger-dependent |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **17** (fresh grep 07-12 run 55 — count held) | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. De-prioritised as a default lever per the 07-11 /weekly (monoculture, no external yield) |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting** (07-12 run-54 reconciled-tree sweep: **116** pages, **2,858** internal links — +2 pages vs run 55's pre-#668 sweep = the `most-active-user…` + `ownership-transfer…` posts) | target 0 — `bun run build && bun run check:links` in `apps/web` |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **1 tracked gap** (run 54): `brew install nlqdb/tap/nlq` is advertised (`cli/README.md`, npm-shim fallback message, SK-CLI-002) but the tap has been empty since 2026-05-19 — the formula push 401'd on every release. Founder-blocked on the `HOMEBREW_TAP_GITHUB_TOKEN` PAT (top `blocked-by-human.md` bullet); releases no longer fail on it (run-54 fix) | claim-vs-reality on shipped surfaces + docs; target 0. Standing candidate: extend `check:links` to assert each advertised capability has shipped code |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) · picker parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal; only genuine remaining slot is the premium chain |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/20 + 12 memory `/vs` pages | tick on merge; mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — the only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; E-03…E-07 all Neon/infra-gated |
| | Memory-quality eval (`SK-QUAL-023`) | harness shipped — EX unmeasured | 15 gold-verified questions, 4 axes; a scored dispatch + the vector head-to-head are the next slices |

## Shipped distribution (live URLs)

Canonical copies on `/blog` (`SK-BLOG-001`); venue variants stay in
`research/distribution-queue.md` as pointers:

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

**2026-07-12 (run 54)** — lever (rule 6): **deploy-cli red on main → fixed
at the root.** Step 0: PRs #664–#666, #668 (run 53, `SK-ASK-023` diag sink
+ published `most-active-user…`) and #670 (run 55, suite re-dispatch →
row #15 0.50 → 0.75) merged first; this entry reconciled on top per the
second-merge rule (run 55's fresher funnel/ops/E2E numbers kept). Only
#667 (daily.md rules) remains open — different lever. **Diagnosis:**
deploy-cli had **never been
green** — 10/10 runs failed 2026-05-19 → 07-11, every one *after* the GitHub
Release published, at the Homebrew formula push to `nlqdb/homebrew-tap`
(`401 Bad credentials`: `HOMEBREW_TAP_GITHUB_TOKEN` never valid, most likely
never set — an empty env renders an empty template token). The runbook
§"CLI releases" documents the intended behavior ("Without it the GitHub
Release still creates; only the tap bump silently skips") — code wrong,
docs right (§10.2). **Change:** `cli/.goreleaser.yml` gates the tap push on
token presence (`skip_upload` template; `index .Env` keeps local snapshot
runs safe) + SK-CLI-002 amended in its canonical file. **Verification:**
goreleaser publish-pipe source confirms `skip_upload` is template-applied
before the `== "true"` check and the formula still lands in `dist/`; local
snapshot with the env var absent builds clean (`goreleaser check`: config
valid; flags only the pre-existing `brews` deprecation). The merge auto-fires
deploy-cli (`cli/**` path) → the live green run is the post-merge
re-measure; if it still 401s, the secret exists-but-revoked and the founder
bullet covers rotation. The PAT is founder-only (rule 4) → top
`blocked-by-human.md` bullet; `brew install` claim gap tracked on row #19
(0 → 1, founder-blocked). **Step-1:** funnel/ops rows keep run 55's
07-12 04:15Z pulls; link sweep re-run on the reconciled tree: 116 pages /
2,858 links / 0 dead (rows #7/#18); docs-ambiguity 17 (held, run 55 grep).
**Artifact (step 3):** published
**https://nlqdb.com/blog/ownership-transfer-outlives-least-privilege/**
(rows #6/#7: 96 surfaces, 32 posts; queue entry → venue pointer; pending
drafts 2 ⇒ < 3 ⇒ next run may draft). **KPI:**
GLOBAL-025 onboarding (the CLI release pipeline now ships green and the
dead brew install path is honestly tracked instead of silently red) +
distribution; **none degrade** (release config + docs + one post; app code,
prompts, eval baselines, CI lane config untouched).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
