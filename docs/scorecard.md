# Scorecard — current state

Point-in-time tracker, regenerated each
[`/daily`](../.claude/commands/daily.md) run. Current state only — no changelog
(≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md` (engine).

**Weekly focus number (2026-07-04 → 07-11):** **BIRD raw EX → ≥ 0.60**
(row #8) — 0.526 (07-05 canonical), still the only pillar below a hard
[`GLOBAL-025`](decisions/GLOBAL-025-north-star.md) Phase-2 floor;
`SK-QUAL-005` mandates engine work until it clears. Every agent-movable
sub-lever is now measured to a verdict (SC N≥2 flat #619; the run-15
frontier-clamp fix lifted agentic-frontier to 0.693, still < the 0.80 floor,
confirming run 14's ≤ 0.70 ceiling call); the only live BIRD-free move left is
the parked **corrected-set** (license, P2) — so row #8 is a floor this week
(**dark for the lever**, rule 8) and engine is also anti-rut-blocked (3 of the
last 5 merged daily PRs pulled it, rule 7).

**Worst number today:** real strangers reaching a first answer = **0** — a
lagging metric moved only through its agent-movable inputs. Run 35 (#646,
merged) took the distribution/`/blog` publish lever; #647 owns
quality-eval/agent-memory docs. **Run 36 lever: first measurement of the
Phase-2 gate's MCP-hosts criterion (row #16) — shipped
`scripts/mcp-hosts.sh`; "MCP installed in 3+ host apps" moves unmeasured →
measured (0 stranger hosts; 1 founder-only host).** Step-1 freshness
restore rode along: e2e sdk/mcp/examples re-dispatched → all ✅ 07-09
(row #15), persona-bench re-dispatched at its 7-day staleness edge.
Detail in *Last change*.
**Row #8 (weekly focus) standing:** dark for the lever (rule 8) + engine anti-rut-blocked
(rule 7); 0.526 is a floor whose only live move is the parked corrected-set (license,
P2). Phase 2 exit gate **1/9 pass** (row #16).

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (fresh 07-09 pull — CF GraphQL + remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 100 visits / 123 pageloads (07-02→07-09, raw). Walker filter (run 12, `userAgentBrowser` cut): "Unknown" = 67 visits ⇒ **real-browser ≈ 33 visits** (32 excl. ChromeHeadless) — up from ≈ 13 on 07-06 | account-level RUM can't split per-path, but the browser-dimension cut is a usable walker filter; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (+1 test `myuser@example.com`) |
| 3 | DBs total | 160, all with `last_queried_at`; latest 07-07 20:49 UTC | −2 vs 07-06; stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not yet measurable** (fresh 07-09 remote-D1; method `SK-ONBOARD-007`: write-side skips the walker UA, read-side joins `user` + excludes founder/test). Unfiltered counters 4/11 ok across 5 DBs — all founder/test per the email join | target ≥ 95%. Leading agent-controllable input shipped run 30: 6 one-click starter build-goal chips on the one-shot anon create surface (`SK-ONBOARD-008`, `home.starter_clicked` signal) |
| 5 | Session retention (≥ 2 queries) | 3 DBs with `first10_asks ≥ 2` (07-09, same attribution caveat as row #4) | share of DBs with `first10_asks ≥ 2` (row #4 counters) |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **88** (`/vs` 31 + `/solve` 33 + `/blog` 24) — **run-35 lever: published `postgres-validator-rejects-valid-clickhouse-sql`** (engine/security lesson `SK-MULTIENG-004`, the run-26 draft; build-verified `dist/blog/postgres-validator-rejects-valid-clickhouse-sql/index.html`, in `rss.xml` + `llms.txt` + `sitemap.xml`, 107 → 108 built pages). Queue was 3 (≥ 3) ⇒ published the **oldest** ready draft per step 3 (recovered the run-26 collapsed gist body from git; its twin `text-to-sql-planner-told-wrong-dialect` explicitly pairs with it). Pending drafts **3 → 2** (KEK-rotation + planner-dialect remain) ⇒ < 3 ⇒ **next run drafts**, per step 3 | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts 24 (run 35: +`postgres-validator-rejects-valid-clickhouse-sql`); 7d external referrals = **6** (bing 5, github 1 — 07-09 pull; was 1 on 07-06). Syndication feeds = **1** (`/rss.xml`, run 22, auto-import via `rel=canonical`); internal-link reciprocity done (10 anchored `/solve`+`/vs` pages, run 19). Internal links **2,655** (run-35 build). | CF `refererHost` — measured every run. External-referral yield is finally ticking (bing 1 → 5) as indexation lands |
| | **Engine** — BIRD 07-05 · Spider 07-08 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.526** (262/498 EA, 2 `gold_error`, 07-05 canonical, [run 28742006051](https://github.com/nlqdb/nlqdb/actions/runs/28742006051)). **`SK-QUAL-017` SC verdict (run 12, 07-06):** first N≥2 dispatch (N=3, temp 0.7, 150q smoke, [run 28761582097](https://github.com/nlqdb/nlqdb/actions/runs/28761582097)) = **79/150 = 0.5267, exactly flat vs the same-directive-set greedy comparator** (canonical run restricted to the identical 150 qids: 79/150; b=8/c=8, p=1.0; SC `no_sql` 1/150) — majority-vote at 3× quota buys 0 on the free chain; the 8↔8 swaps are provider-mix noise | target 0.65 / **Phase 2 floor 0.60 — below floor ⇒ engine work ships until cleared (`SK-QUAL-005`)**. Baseline re-seeded 07-05. `SK-LLM-043` live-verified (run 11): `\|\|` concats 7 → 3 run-wide. Offline deterministic-ceiling lever exhausted; **SC lever dead (#619); frontier-lens levers closed (run 15, `SK-QUAL-022`)** — only live BIRD-free move is the parked corrected-set (license, P2) |
| 9 | Spider raw EX | **0.2444** (33/135, 07-08 capacity-honest full run, [run 28959809497](https://github.com/nlqdb/nlqdb/actions/runs/28959809497), resumed from [28958045313](https://github.com/nlqdb/nlqdb/actions/runs/28958045313) per `SK-QUAL-013`, gold_error 0) | target 0.75; **run-27 lever: capacity-honest re-measure 0.1926 → 0.2444 (26 → 33/135, +7q / +5.19 pp).** The 07-02 0.1926 was free-lane capacity-throttled ⇒ undercount; this run waited out throttles (`--capacity-wait-ms 65000`, 2 windows to `resumable:false`) on `main` 6e6b486. Still worst engine number (target 0.75). Spider has no baseline file (BIRD-only, `SK-QUAL-018`) — this row is Spider's source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, re-measured 07-09 at the 7-day staleness edge, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004) — flat vs 07-02) | full-chain ICP EX; 1.8× BIRD, 5× Spider — the GLOBAL-026 bet; N=23 ±1 noisy. Retrieval precision@1 saturated |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic-frontier 69.33%, 150-q smoke seed 20260607, 07-06 run 15, `SK-QUAL-022`; single-frontier lane 18.00 pts). persona-bench **−4.35 pts** (07-09: frontier 21/23 vs free 22/23 — free beats the single-frontier lane on the ICP shape; one-question noise at N=23, was 0.00 on 07-02) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69–0.70 unclamped < the 0.80 floor (row #16 fails on competence, not the instrument — run 15 `SK-QUAL-022` removed the 5 s frontier-plan clamp that had understated it). Smoke, no baseline touch; run history in git + `progress/quality-score-verification-log.md` |
| | **Ops** — 7d, CF Workers analytics (fresh 07-09 pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 4,185 / 0 (0.00%) | mcp-server 439 req / 0 err; events-worker 6 req |
| 13 | nlqdb-api wall-time p50 / p95 | 10.3 ms / 1.26 s | mcp-server p95 759 s = long-lived SSE, expected; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.75** — sdk ✅ 07-09 ([29049916362](https://github.com/nlqdb/nlqdb/actions/runs/29049916362)) · mcp ✅ 07-09 ([29049918217](https://github.com/nlqdb/nlqdb/actions/runs/29049918217)) · examples ✅ 07-09 ([29049927201](https://github.com/nlqdb/nlqdb/actions/runs/29049927201)) — 1.00 each, re-dispatched this run (had decayed to 0.47) · opencheck ❌ 0 ([29049928985](https://github.com/nlqdb/nlqdb/actions/runs/29049928985): A/B died at *pre-flight model-pick*, 4/5 OpenRouter free pools 429 — self-inflicted contention with the simultaneous persona-bench dispatch on the same key; Suite C's pre-flight passed once it finished. Clean re-dispatch queued) | freshness decays 1.0 → 0 over 7d by design — the row forces a re-dispatch cadence. **Sequencing rule learned: never dispatch opencheck alongside another OpenRouter-free consumer.** Suite B 0/8 weakest-candidate capacity + Suite A 4/5 (best since 06-12) triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** (first measurement, 07-02) — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.526, fresh 07-05); agentic-frontier ≥ 0.80 + Δ ≤ 25 pp (**honestly re-measured 07-06 run 15 post-`SK-QUAL-022` clamp fix, row #11: Δ 18.66 pp ✓ ≤ 25, agentic 0.693 ✗ < 0.80 — the clamp is removed, so this now fails on a genuine competence gap, not the instrument; confirms run 14's ≤ 0.70 ceiling**); TTFV p50 ≤ 60 s (instrumented run 34, `SK-ONBOARD-005`; reads once stranger traffic arrives); first-10 ≥ 95% (stranger N=0 — row #4); destructive-op retry < baseline (unmeasured — last criterion with no instrument); **MCP in 3+ host apps (measured 07-09 run 36, new instrument `scripts/mcp-hosts.sh`: 0 stranger hosts, 1 founder-only host — cursor, 2 grants, 0 with a query — FAIL)**; 1 public agent product on nlqdb (0 strangers); 3 non-engineer CSV tests (CSV upload unshipped) | agent-movable next: the destructive-op-retry instrument (only unmeasured criterion left); the agentic-frontier ~11 pp is a real engine-competence lift (`SK-LLM-017` premium chain, or the parked corrected-set); stranger-dependent criteria hang on rows #2/#6 |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **21** (07-09, re-counted this run — unchanged; last moved run 33: −1, `byo-connect` KEK-rotation resolved into `GLOBAL-031`. Prior levers in `git log`) | target ↓ 0. **Method pinned** (stops the 75↔85 drift): `- ` bullets under `## Open questions` whose text does **not** match, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed` (case-insensitive is load-bearing — a case-sensitive grep over-counts). Lever: research (P2/GLOBAL-033) → document (P4) → mark resolved |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting** (07-09 run-35 sweep: **108** pages, **2,655** internal links — +1 page / +25 links vs run 31 = the new `postgres-validator-rejects-valid-clickhouse-sql` post + its inbound nav/index/sitemap/llms/rss links) | target 0 — sweep is repeatable: `bun run build && bun run check:links` (checks hrefs + sitemap + llms.txt against dist; exits 1 on dead) |
| | **Product-readiness** — client-blocking gaps the loop was blind to (added 07-04) | | non-deferral gaps that no prior row measured, so rule 2 ("no change without a number") could never select them; now agent-movable |
| 19 | Live-surface claim integrity | **0 tracked gaps** (run 32 found + closed 1) | claim-vs-reality on shipped surfaces + docs; target 0. **Run 32 lever:** `rate-limit/FEATURE.md` (GLOBAL-024 commentary) claimed per-account 429s fire a distinct `feature.requested.larger_account` demand-signal — but the code emitted `heavier_tier` for **both** anon and authed 429s, the named event **did not exist** in `ProductEvent`, and the *canonical* `SK-EVENTS-010` (events-pipeline) contradicted the claim ("any /v1/ask 429 → heavier_tier"). A doc-vs-doc contradiction (§10.3). Closed by *implementing* the missing variant (run-28 pattern, not a reword): added `feature.requested.larger_account` (`packages/events` type + `defaultId` dedup + logsnag sink), routed the authed per-account trips (`/v1/ask`+`/v1/chat` via `emitFeatureSignal`, `/v1/run` inline) to it, kept anon per-IP on `heavier_tier`, and superseded `SK-EVENTS-010` (P3) to define the two distinct signals — restoring the §6-trigger granularity GLOBAL-024 mandates. Found+closed same run ⇒ net 0. Standing candidate: extend `check:links` to assert each advertised capability has shipped code |
| 20 | Hosted-premium readiness (§6 build-before-signal) | **schema ✅ · BYOLLM lanes ✅ · picker: web ✅ (`SK-PREMIUM-013`, #610) · picker parity ✅ (`SK-PREMIUM-014`, run 10) · CTA ✅ (`SK-PREMIUM-004` `FreeModelNudge`, #630 — was stale-⬜; corrected run 28, and its cross-surface signal now rides all surfaces incl. `<nlq-data>` `el.trace` per run 28) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked)** | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is **built before** the signal (lighting it is a flag flip); only the *meter firing* (Lago→Stripe) + cost-incurring infra stay dark. Drive ⬜→✅ each run; only genuine remaining slot is the premium chain (`SK-LLM-017`, flag-dark) — spend-cap UI is Lago-gated |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/20 + 12 memory `/vs` pages | tick on merge; mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — the only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; E-03…E-07 (per-agent RLS, TTL, hybrid recall, authed on-ramp, ClickHouse) all Neon/infra-gated |

## Shipped distribution (live URLs)

Canonical copies on `/blog` (`SK-BLOG-001`); venue variants stay in
`research/distribution-queue.md` as pointers:

- https://nlqdb.com/blog/postgres-validator-rejects-valid-clickhouse-sql/ (run 35 — engine/security lesson SK-MULTIENG-004: a Postgres-pinned AST validator silently false-rejects valid ClickHouse SQL as `parse_failed`; split the dialect-agnostic destructive-verb allowlist (authoritative on every engine) from the best-effort per-engine AST walk — a wrong-dialect parse means "wrong parser," not "dangerous query")
- https://nlqdb.com/blog/blog-without-a-feed-is-a-dead-end/ (run 31 — distribution lesson: a blog with no RSS feed is sealed to every machine that would redistribute it; count the doors into your content, not the pages)
- https://nlqdb.com/blog/one-way-internal-links-leak-yield/ (run 28 — distribution lesson: invert the `anchor` field into a reciprocal backlink; measure the link graph, not the page count)
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
- https://nlqdb.com/blog/llm-concatenates-columns-text-to-sql/ (run 12 — engine lesson, SK-LLM-043 projection directive / positional-tuple EX)
- https://nlqdb.com/blog/bird-gold-noise-distinct/ (run 14 — engine lesson, SK-QUAL-014 loss-bucketing before prompt directives)
- https://nlqdb.com/blog/model-preset-fail-loud/ (run 16 — engine/product lesson, SK-PREMIUM-014 honest model knob / fail-loud 409)
- https://nlqdb.com/blog/llm-preflight-probe-health/ (run 17 — CI/engine lesson, SK-LLM-042 probe-health ≠ agent-competence)
- https://nlqdb.com/blog/serverless-db-cold-start-retry/ (run 24 — engine/ops lesson, SK-ASK-013 per-stage retry backoff / scale-to-zero cold start ≠ db_unreachable)
- https://nlqdb.com/blog/llm-timeout-looks-like-hallucination/ (run 20 — engine lesson, SK-QUAL-022 eval-budget ≠ prod SLA; abort ≠ parse failure; latency fingerprint)

## Last change

**2026-07-09 (run 36)** — lever: **first measurement of the Phase-2 gate's
"MCP installed in 3+ distinct host apps" criterion (row #16): unmeasured (no
instrument) → measured — 0 stranger hosts.** Step 0: run 35 (#646, merged) took
the distribution queue + `/blog`; #647 owns quality-eval/agent-memory docs; row #8
dark (rule 8). **Change:** the data was in D1 all along — `sk_mcp` keys carry a
per-host claim (`mcp_host`, `SK-MCP-004`) and the principal middleware stamps
`last_used_at` on real calls — so the criterion needed a pinned query, not new
telemetry (P5: no new events). Shipped `scripts/mcp-hosts.sh` (active grants
per host; stranger vs founder/test via the row-#4 email-join method; installed
vs used split): today's honest read = **1 host ever connected (cursor, 2
founder OAuth grants, 2026-06-28), 0 grants ever used for a query, 0 stranger
hosts ⇒ criterion FAILs but is now measured** — the gate stops carrying an
unmeasurable cell, and the sharper finding (even the founder's own MCP installs
never ran a query) is now on the record. **Step-1 freshness restore
(measurement hygiene, not the lever):** e2e sdk/mcp/examples re-dispatched →
all ✅ 07-09 (row #15 had silently decayed 0.75 → 0.35 since 07-06); opencheck
A/B hit pre-flight 429s — contention with our own simultaneous persona-bench
dispatch on the shared OpenRouter key (sequencing rule now in row #15) — clean
re-dispatch queued; persona-bench re-run at its 7-day staleness edge with the
frontier lane — free flat 22/23, frontier 21/23 ⇒ ICP delta 0.00 →
**−4.35 pts** (row #11). Fresh funnel/ops pulls landed in
rows #1–#5, #7, #12–#13; notable: real-browser visits ≈ 13 → 33 and external
referrals 1 → 6 (bing 5) — the first visible yield from the indexation push.
**Artifact (step 3):** the shipped instrument (run 35's distribution lever
merged as #646; run-34 precedent). **KPI:** GLOBAL-025 onboarding — a gate
criterion becomes a live meter. **None degrade:** script + docs diff only; no
engine/API/prompt/eval-baseline touched; typecheck/lint/test green. D4:
scorecard net-shrunk.

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
