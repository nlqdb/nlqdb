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
lagging metric moved only through its agent-movable inputs (distribution,
onboarding). The distribution queue reached 3 unpublished drafts (run 38), so
step 3 mandated **publish, don't draft**, and that is **run 40's lever:
indexable surfaces 89 → 90 (row #6) — published the oldest ready draft,
`text-to-sql-planner-told-wrong-dialect`** (byo-connect OQ (b), the run-35
validator twin; lesson + honesty check in *Last change*). Reconciles a stale
row-#6 count (was 88; true pre-run 89 = blog 25 not 24).
**Row #8 (weekly focus) standing:** dark for the lever (rule 8) + engine
anti-rut-blocked (rule 7); 0.526 is a floor, only live move the parked corrected-set
(license, P2). Phase 2 exit gate **1/9 pass** (row #16) — every criterion is now
instrumented; remaining fails are competence (BIRD/agentic-frontier) or
stranger-dependent, not blind spots.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (fresh 07-09 pull — CF GraphQL + remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 100 visits / 123 pageloads (07-02→07-09, raw). Walker filter (run 12, `userAgentBrowser` cut): "Unknown" = 67 visits ⇒ **real-browser ≈ 33 visits** (32 excl. ChromeHeadless) — up from ≈ 13 on 07-06 | account-level RUM can't split per-path, but the browser-dimension cut is a usable walker filter; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (+1 test `myuser@example.com`) |
| 3 | DBs total | 160, all with `last_queried_at`; latest 07-07 20:49 UTC | −2 vs 07-06; stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not yet measurable** (fresh 07-09 remote-D1; method `SK-ONBOARD-007`: write-side skips the walker UA, read-side joins `user` + excludes founder/test). Unfiltered counters 4/11 ok across 5 DBs — all founder/test per the email join | target ≥ 95%. Leading agent-controllable input shipped run 30: 6 one-click starter build-goal chips on the one-shot anon create surface (`SK-ONBOARD-008`, `home.starter_clicked` signal) |
| 5 | Session retention (≥ 2 queries) | 3 DBs with `first10_asks ≥ 2` (07-09, same attribution caveat as row #4) | share of DBs with `first10_asks ≥ 2` (row #4 counters) |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **90** (`/vs` 31 + `/solve` 33 + `/blog` 26) — **run-40 lever: published `text-to-sql-planner-told-wrong-dialect`** (engine/architecture lesson, byo-connect OQ (b), the run-35 validator twin; 110 built pages, in rss/llms/sitemap). Was recorded 88 but the true pre-run count was 89 (blog 25 not 24 — one prior post never bumped the row); +1 this run ⇒ 90. Pending drafts **3 → 2** (`emit-metrics-where-the-distinction-is-certain` + `rotate-encryption-key-without-a-version-column` remain) ⇒ < 3 ⇒ **next run drafts** one new artifact, per step 3 | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts 26 (run 40: +`text-to-sql-planner-told-wrong-dialect`); 7d external referrals = **6** (bing 5, github 1 — 07-09 pull; was 1 on 07-06). Syndication feeds = **1** (`/rss.xml`, run 22, auto-import via `rel=canonical`); internal-link reciprocity done (10 anchored `/solve`+`/vs` pages, run 19). Internal links **2,708** (run-40 build). | CF `refererHost` — measured every run. External-referral yield is finally ticking (bing 1 → 5) as indexation lands |
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
| 15 | E2E manual-suite freshness | **0.75** — sdk ✅ · mcp ✅ · examples ✅ 07-09 (1.00 each, re-dispatched run 39) · opencheck ❌ 0 ([29049928985](https://github.com/nlqdb/nlqdb/actions/runs/29049928985): OpenRouter free-pool 429 from same-key contention with the persona-bench dispatch) | freshness decays 1.0 → 0 over 7d by design — forces a re-dispatch cadence. **Sequencing rule: never dispatch opencheck alongside another OpenRouter-free consumer.** Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** (first measurement, 07-02) — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.526, fresh 07-05); agentic-frontier ≥ 0.80 + Δ ≤ 25 pp (**honestly re-measured 07-06 run 15 post-`SK-QUAL-022` clamp fix, row #11: Δ 18.66 pp ✓ ≤ 25, agentic 0.693 ✗ < 0.80 — the clamp is removed, so this now fails on a genuine competence gap, not the instrument; confirms run 14's ≤ 0.70 ceiling**); TTFV p50 ≤ 60 s (instrumented run 34, `SK-ONBOARD-005`; reads once stranger traffic arrives); first-10 ≥ 95% (stranger N=0 — row #4); destructive-op retry < baseline (**instrumented run 38, `SK-TRUST-004`: `feature.destructive.preview_rendered`/`.committed` on the preview/commit boundary in `orchestrateAsk`, sliced by surface; reads once destructive-op traffic arrives, N≈0 today** — was the last criterion with no instrument); **MCP in 3+ host apps (measured 07-09 run 36, new instrument `scripts/mcp-hosts.sh`: 0 stranger hosts, 1 founder-only host — cursor, 2 grants, 0 with a query — FAIL)**; 1 public agent product on nlqdb (0 strangers); 3 non-engineer CSV tests (CSV upload unshipped) | agent-movable next: with every criterion now instrumented (destructive-op shipped run 38), the only agent-movable *pass* left is the agentic-frontier ~11 pp engine-competence lift (`SK-LLM-017` premium chain, or the parked corrected-set); the rest are stranger-dependent (rows #2/#6) |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **20** (07-10 run 39: −1, `elements` `<nlq-data>`-vs-SDK `GLOBAL-001` debt resolved via a bounded inline-client exception; last moved run 33: −1, `byo-connect` KEK-rotation into `GLOBAL-031`. Prior levers in `git log`) | target ↓ 0. **Method pinned** (stops the 75↔85 drift): `- ` bullets under `## Open questions` whose text does **not** match, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed` (case-insensitive is load-bearing — a case-sensitive grep over-counts). Lever: research (P2/GLOBAL-033) → document (P4) → mark resolved |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting** (07-10 run-40 sweep: **110** pages, **2,708** internal links — +2 pages / +53 links vs run-35's 108/2,655 = the new `text-to-sql-planner-told-wrong-dialect` post + one prior post that never bumped this row, plus their inbound nav/index/sitemap/llms/rss links) | target 0 — sweep is repeatable: `bun run build && bun run check:links` (checks hrefs + sitemap + llms.txt against dist; exits 1 on dead) |
| | **Product-readiness** — client-blocking gaps the loop was blind to (added 07-04) | | non-deferral gaps that no prior row measured, so rule 2 ("no change without a number") could never select them; now agent-movable |
| 19 | Live-surface claim integrity | **0 tracked gaps** (run 32 found + closed 1; run 37 found + closed 1) | claim-vs-reality on shipped surfaces + docs; target 0. **Run 37 lever (§10.3 doc-vs-canonical):** run 33 resolved BYO KEK rotation in the canonical `GLOBAL-031` (version in the `nbe1.`→`nbe2.<v>.` envelope prefix, **not** a `key_version` column) and updated byo-connect's copy, but its P3 cross-reference sweep missed `db-adapter/FEATURE.md`, whose OQ still asserted a "version column on `databases` … not yet designed" — a security-sensitive contradiction (it would steer an implementer to build the exact column `GLOBAL-031` rejected). Completed the sweep: rewrote that bullet to Resolved→`GLOBAL-031`. Found+closed same run ⇒ net 0. **Run 32 lever:** implemented the missing `feature.requested.larger_account` demand-signal (`packages/events` type + logsnag sink; authed per-account 429s → it, anon per-IP → `heavier_tier`) + superseded `SK-EVENTS-010`, closing a doc-vs-doc contradiction (full detail in git). Standing candidate: extend `check:links` to assert each advertised capability has shipped code |
| 20 | Hosted-premium readiness (§6 build-before-signal) | **schema ✅ · BYOLLM lanes ✅ · picker: web ✅ (`SK-PREMIUM-013`, #610) · picker parity ✅ (`SK-PREMIUM-014`, run 10) · CTA ✅ (`SK-PREMIUM-004` `FreeModelNudge`, #630 — was stale-⬜; corrected run 28, and its cross-surface signal now rides all surfaces incl. `<nlq-data>` `el.trace` per run 28) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked)** | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is **built before** the signal (lighting it is a flag flip); only the *meter firing* (Lago→Stripe) + cost-incurring infra stay dark. Drive ⬜→✅ each run; only genuine remaining slot is the premium chain (`SK-LLM-017`, flag-dark) — spend-cap UI is Lago-gated |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/20 + 12 memory `/vs` pages | tick on merge; mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — the only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; E-03…E-07 (per-agent RLS, TTL, hybrid recall, authed on-ramp, ClickHouse) all Neon/infra-gated |
| | Memory-quality eval (`SK-QUAL-023`) | harness shipped — EX unmeasured | 15 gold-verified questions across 4 axes (retrieval / temporal / forgetting / consolidation) + analytical, wired as `--dataset memory-quality`; a scored dispatch + the vector head-to-head are the next slices |

## Shipped distribution (live URLs)

Canonical copies on `/blog` (`SK-BLOG-001`); venue variants stay in
`research/distribution-queue.md` as pointers:

- https://nlqdb.com/blog/text-to-sql-planner-told-wrong-dialect/ (run 40 — engine/architecture lesson, byo-connect OQ (b): a text-to-SQL planner emits whatever dialect you name it, so a second engine's bug is one hardcoded `dialect: "postgres"` literal + a `"postgres" | "sqlite"` union that never grew a `clickhouse` member; thread the row's real engine into the field and widen the type so the compiler flags every hardcoded call site — not a transpile layer. Twin of the run-35 validator post: generator + validator both assume engine #1, fix them together)
- https://nlqdb.com/blog/postgres-validator-rejects-valid-clickhouse-sql/ (run 35 — engine/security lesson SK-MULTIENG-004: a Postgres-pinned AST validator silently false-rejects valid ClickHouse SQL as `parse_failed`; split the dialect-agnostic destructive-verb allowlist (authoritative on every engine) from the best-effort per-engine AST walk — a wrong-dialect parse means "wrong parser," not "dangerous query")
- https://nlqdb.com/blog/agent-memory-benchmarks-measure-recall-not-analysis/ (agent-memory-quality initiative — `SK-QUAL-023` research finding; anchors `/solve/analytical-queries-over-agent-memory`)
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

**2026-07-10 (run 40)** — lever: **indexable surfaces 89 → 90 (row #6) — publish the
oldest ready distribution draft.** Step 0: no open PRs; branch was at merged run-39
main (#652). Step 3 rule 1 fired — the queue held 3 unpublished drafts (run 38 drafted
the 3rd), so this run **publishes, not drafts**. Took the oldest,
`text-to-sql-planner-told-wrong-dialect` (byo-connect OQ (b), the run-35 validator
twin). Row #8 (BIRD, weekly focus) stays dark for the lever (rule 8) + engine
anti-rut-blocked (rule 7); anti-rut clear — of the last 5 merged daily PRs only run 35
pulled distribution. **Honesty check (P2):** the lesson is real — `orchestrate.ts`
hardcodes `dialect: "postgres"` at both plan sites (lines 242/428) while `db.engine`
(clickhouse-capable) sits one field away, and `PlanRequest.dialect` is typed
`"postgres" | "sqlite"`; byo-connect OQ (b) is *Decided* but the code fix "lands as one
PR with (a)" (unshipped), so the post is framed as a general engineering lesson +
"honest split: architecture lesson, not a product feature," never as shipped code.
**Change:** prepended the post to `BLOG_POSTS` (one-file edit, `SK-BLOG-002`); deleted
the queue draft; added the venue pointer + § Shipped distribution URL. **Measured:**
built count 90 surfaces (`/vs` 31 + `/solve` 33 + `/blog` 26); reconciled a stale row-#6
value (recorded 88, true pre-run 89 — a prior post never bumped it). Row #18 sweep 110
pages / 2,708 links, 0 dead / 0 redirecting; new slug present in blog index + its page +
sitemap + llms.txt + rss.xml. **Verification:** `bun test blog.test.ts` 6/6 pass;
`bunx biome lint` clean on the changed files; `bun run build` + `check:links` green.
**Artifact (step 3):** the published post is the released artifact. **KPI:** GLOBAL-025
onboarding/UX via distribution yield (row #6/#7 leading input to rows #1–#3); **none
degrade** (no engine/API/prompt/eval-baseline touched — data + docs only).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
