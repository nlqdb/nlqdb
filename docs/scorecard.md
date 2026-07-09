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
lagging metric, moved through its agent-movable inputs (distribution
surfaces/yield). **Run 31 lever: indexable surfaces 86 → 87 (rows #6/#7)** —
published the oldest ready queue draft `blog-without-a-feed-is-a-dead-end`
(distribution lesson: a blog with no RSS feed is sealed to every machine that
would redistribute it — feed readers + dev.to/Medium/Hashnode import-from-RSS
with `rel=canonical`; count the doors into your content, not the pages). Queue
was **3 (≥ 3) ⇒ step 3 mandates publish, not draft**; posts 22 → 23, built
pages 106 → 107, aggregated into `rss.xml`/`sitemap.xml`/`llms.txt` (build-verified).
Onboarding row #4 / hosted-premium row #20 owned this cycle by open PR #641 (run 30)
⇒ picked a non-overlapping surface lever (step 0). Detail in *Last change*.
**Row #8 (weekly focus) standing:** dark for the lever (rule 8) + engine anti-rut-blocked
(rule 7); 0.526 is a floor whose only live move is the parked corrected-set (license,
P2). Phase 2 exit gate **1/9 pass** (row #16).

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (fresh 07-06 pull — CF GraphQL + remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 83 visits / 104 pageloads (06-29→07-06, raw). **New walker filter (run 12):** grouping by `userAgentBrowser` splits out the walker UA (parses as "Unknown": 70 visits) ⇒ **real-browser ≈ 13 visits** (12 excl. ChromeHeadless) | account-level RUM can't split per-path, but the browser-dimension cut is a usable walker filter going forward; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 8 total = 4 founder/company + 4 test/dev (unchanged) |
| 3 | DBs total | 162, all with `last_queried_at`; latest 07-06 00:32 UTC | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not yet measurable** (run 16, `SK-ONBOARD-007`, remote-D1 07-07). Unfiltered counters read 3/8 = **37.5%** but a `tenant_id → user.email` join shows all 3 rows are founder (`omer.hochman@gmail.com`) + `test@example.com` — the 35–37% previously reported was 100% non-stranger | target ≥ 95%. **Attribution gap fixed** (was "the instrument's next fix"): write-side skips the stranger-test walker UA (`isSyntheticUserAgent`, anon case the join can't see); read-side joins `user` + excludes founder/test. Honest read is now N=0 (matches row #2), not a placebo rate. **Run 30 lever — agent-controllable input:** the anon create surface (`CreateForm`, live `/app/new` + `/vs`/`/solve`/`/agents`) previously offered only a placeholder; because `SK-ANON-012` caps the device at **one** create call, a vague first goal burns it. Added 6 one-click starter build-goal chips (`SK-ONBOARD-008`, `home.starter_clicked` GLOBAL-024 signal, fill-never-submit) — **starter examples on the one-shot surface 0 → 6** — the highest-leverage input to this KPI |
| 5 | Session retention (≥ 2 queries) | 3 DBs with `first10_asks ≥ 2` (same attribution caveat as row #4) | share of DBs with `first10_asks ≥ 2` (row #4 counters) |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **87** (`/vs` 31 + `/solve` 33 + `/blog` 23) — **run-31 lever: published `blog-without-a-feed-is-a-dead-end`** (run-22 distribution lesson; build-verified `dist/blog/blog-without-a-feed-is-a-dead-end/index.html`, in `rss.xml` + `llms.txt` + `sitemap.xml`, 106 → 107 built pages). Queue was 3 (≥ 3) ⇒ published the oldest ready draft, per step 3. Pending drafts now **2** (`text-to-sql-planner-told-wrong-dialect` [run 29] + `postgres-validator-rejects-valid-clickhouse-sql` [run 26]; queue < 3 ⇒ **next run drafts** one, per step 3) | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts 23 (run 31: +`blog-without-a-feed-is-a-dead-end`, the canonical copy of the run-22 RSS lesson — now self-syndicating via `/rss.xml`); 7d external referrals = **1** (`bing.com`, 1 pageload). **Run 22: syndication feeds 0 → 1** — shipped `/rss.xml` (hand-rolled RSS 2.0 over `data/blog.ts`, site-wide autodiscovery; `rss.xml.test.ts` 5 invariants) so feed readers + dev.to/Medium/Hashnode can auto-import the canonical copy (`rel=canonical` back). **Run 19: internal-link reciprocity 0 → 10** — reciprocal "Further reading" backlink on all 10 anchored `/solve`+`/vs` pages. Internal links 2605 → 2630 (run-31 build). | CF `refererHost` — measured every run. Attacks "volume without yield" at its SEO/UX input; external-referral re-measure lags indexation |
| | **Engine** — BIRD 07-05 · Spider 07-08 · persona-bench 07-02 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.526** (262/498 EA, 2 `gold_error`, 07-05 canonical, [run 28742006051](https://github.com/nlqdb/nlqdb/actions/runs/28742006051)). **`SK-QUAL-017` SC verdict (run 12, 07-06):** first N≥2 dispatch (N=3, temp 0.7, 150q smoke, [run 28761582097](https://github.com/nlqdb/nlqdb/actions/runs/28761582097)) = **79/150 = 0.5267, exactly flat vs the same-directive-set greedy comparator** (canonical run restricted to the identical 150 qids: 79/150; b=8/c=8, p=1.0; SC `no_sql` 1/150) — majority-vote at 3× quota buys 0 on the free chain; the 8↔8 swaps are provider-mix noise | target 0.65 / **Phase 2 floor 0.60 — below floor ⇒ engine work ships until cleared (`SK-QUAL-005`)**. Baseline re-seeded 07-05. `SK-LLM-043` live-verified (run 11): `\|\|` concats 7 → 3 run-wide. Offline deterministic-ceiling lever exhausted; **SC lever dead (#619); frontier-lens levers closed (run 15, `SK-QUAL-022`)** — only live BIRD-free move is the parked corrected-set (license, P2) |
| 9 | Spider raw EX | **0.2444** (33/135, 07-08 capacity-honest full run, [run 28959809497](https://github.com/nlqdb/nlqdb/actions/runs/28959809497), resumed from [28958045313](https://github.com/nlqdb/nlqdb/actions/runs/28958045313) per `SK-QUAL-013`, gold_error 0) | target 0.75; **run-27 lever: capacity-honest re-measure 0.1926 → 0.2444 (26 → 33/135, +7q / +5.19 pp).** The 07-02 0.1926 was free-lane capacity-throttled ⇒ undercount; this run waited out throttles (`--capacity-wait-ms 65000`, 2 windows to `resumable:false`) on `main` 6e6b486. Still worst engine number (target 0.75). Spider has no baseline file (BIRD-only, `SK-QUAL-018`) — this row is Spider's source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-02) | full-chain ICP EX; 1.8× BIRD, 5× Spider — the GLOBAL-026 bet; N=23 ±1 noisy. Retrieval precision@1 saturated |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic-frontier 69.33%, 150-q smoke seed 20260607, 07-06 run 15, `SK-QUAL-022`; single-frontier lane 18.00 pts). persona-bench 0.00 pts (07-02) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69–0.70 unclamped < the 0.80 floor (row #16 fails on competence, not the instrument — run 15 `SK-QUAL-022` removed the 5 s frontier-plan clamp that had understated it). Smoke, no baseline touch; run history in git + `progress/quality-score-verification-log.md` |
| | **Ops** — 7d, CF Workers analytics (fresh 07-06 pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 2,281 / 0 (0.00%) | mcp-server 425 req / 0 err; events-worker 4 req |
| 13 | nlqdb-api wall-time p50 / p95 | 10.1 ms / 1.35 s | mcp-server p95 331.5 s = long-lived SSE, expected; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.75** — sdk ✅ 07-06 (1.00) · mcp ✅ 07-06 (1.00) · examples ✅ 07-06 (1.00) · opencheck ❌ (**Suite A 4/5, best since the 06-12 green** — [run 28768099957](https://github.com/nlqdb/nlqdb/actions/runs/28768099957)) | run 13 shipped the pre-flight-over-ordered-free-model-list fix + re-dispatched sdk/mcp/examples. Run 18 fixed Suite A's sole failure (cold-start `db_unreachable`, 2× trace-verified) via `SK-ASK-013` exec-stage backoff (`300 ms × 2^(n−1)`, ≤900 ms; verified in `retry.test.ts`). Suite B 0/8 = weakest-candidate capacity (4 stronger pools 429 at pick time), not a regression. Full triage: `e2e-coverage/opencheck-operations.md` (git preserves the run-13/18 detail) |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** (first measurement, 07-02) — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.526, fresh 07-05); agentic-frontier ≥ 0.80 + Δ ≤ 25 pp (**honestly re-measured 07-06 run 15 post-`SK-QUAL-022` clamp fix, row #11: Δ 18.66 pp ✓ ≤ 25, agentic 0.693 ✗ < 0.80 — the clamp is removed, so this now fails on a genuine competence gap, not the instrument; confirms run 14's ≤ 0.70 ceiling**); TTFV p50 ≤ 60 s (unmeasured); first-10 ≥ 95% (35.3% walker-dominated, N=17 — row #4); destructive-op retry < baseline (unmeasured); MCP in 3+ host apps (no instrument); 1 public agent product on nlqdb (0 strangers); 3 non-engineer CSV tests (CSV upload unshipped) | agent-movable next: the agentic-frontier criterion is now **measurement-clean** (clamp fixed) — closing the remaining ~11 pp to 0.80 is a real engine-competence lift (multi-model frontier chain `SK-LLM-017`, or the parked corrected-set); first-10 instrument reads with traffic; stranger-dependent criteria hang on rows #2/#6 |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **22** (07-09; run 29 lever: −1, resolved `byo-connect` OQ **(b)** planner-emits-Postgres-SQL-for-a-CH-DB — Decided: dialect-aware prompting (extend the existing `Dialect:` planner param to `clickhouse`, `SK-LLM-018`), NOT a transpile layer (SQLGlot/ANTLR bust the `GLOBAL-013` Workers budget — same constraint as OQ (a)); scoped code fix — add `"clickhouse"` to `PlanRequest.dialect`, map `db.engine → dialect` at the two hardcoded `orchestrate.ts` plan sites — is **coupled with OQ (a)**'s engine-aware `validateSql` and ships in a dedicated live-CH-fixture PR; genuine resolution, not a relabel; detail in *Last change*). **Prior levers** (git preserves full detail): run 26 −1 (OQ (a) CH-SQL-on-PG-validator); run 23 −1 (OQ (c) DNS-rebind TOCTOU); run 21 −1 (`e2e-coverage` cold-start OQ → run 18 `SK-ASK-013`); run 17 −2 (`premium-tier` router contracts). | target ↓ 0. **Method pinned** (stops the 75↔85 drift): `- ` bullets under `## Open questions` whose text does **not** match, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed` (case-insensitive is load-bearing — a case-sensitive grep over-counts). Lever: research (P2/GLOBAL-033) → document (P4) → mark resolved |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting** (07-09 run-31 sweep: **107** pages, **2,630** internal links — +1 page / +25 links vs run 28 = the new `blog-without-a-feed-is-a-dead-end` post + its inbound nav/index/sitemap/llms/rss links) | target 0 — sweep is repeatable: `bun run build && bun run check:links` (checks hrefs + sitemap + llms.txt against dist; exits 1 on dead) |
| | **Product-readiness** — client-blocking gaps the loop was blind to (added 07-04) | | non-deferral gaps that no prior row measured, so rule 2 ("no change without a number") could never select them; now agent-movable |
| 19 | Live-surface claim integrity | **0 tracked gaps** (run 28 found + closed 1) | claim-vs-reality on shipped surfaces + docs; target 0. **Run 28 lever:** `elements/FEATURE.md` advertised that `<nlq-data>` *"exposes the trace via the `el.trace` JS property"* — the code had **no such property** (verified: full `element.ts` read), and `trust-ux/FEATURE.md` correctly listed it as a not-yet-shipped `SK-TRUST-002` gap ⇒ the two features **contradicted** each other. Closed by *implementing* the missing feature (not just re-wording): `el.trace` + `trace` on the `nlq-data:load` event (`packages/elements`), making elements the 5th/5 shipped surface to carry the trace (SDK/CLI/MCP/web already did). Found+closed same run ⇒ net 0 (run-9/25 pattern), but this time by shipping code. Also fixed a same-breath bug: the load event's `cached` came from a phantom top-level field (always `undefined`) — now from `trace.cache_hit`. Standing candidate: extend `check:links` to assert each advertised capability has shipped code |
| 20 | Hosted-premium readiness (§6 build-before-signal) | **schema ✅ · BYOLLM lanes ✅ · picker: web ✅ (`SK-PREMIUM-013`, #610) · picker parity ✅ (`SK-PREMIUM-014`, run 10) · CTA ✅ (`SK-PREMIUM-004` `FreeModelNudge`, #630 — was stale-⬜; corrected run 28, and its cross-surface signal now rides all surfaces incl. `<nlq-data>` `el.trace` per run 28) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked)** | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is **built before** the signal (lighting it is a flag flip); only the *meter firing* (Lago→Stripe) + cost-incurring infra stay dark. Drive ⬜→✅ each run; only genuine remaining slot is the premium chain (`SK-LLM-017`, flag-dark) — spend-cap UI is Lago-gated |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/20 + 12 memory `/vs` pages | tick on merge; mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — the only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; E-03…E-07 (per-agent RLS, TTL, hybrid recall, authed on-ramp, ClickHouse) all Neon/infra-gated |

## Shipped distribution (live URLs)

Canonical copies on `/blog` (`SK-BLOG-001`); venue variants stay in
`research/distribution-queue.md` as pointers:

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

**2026-07-09 (run 31)** — lever: **indexable surfaces 86 → 87 (rows #6/#7)** by
publishing the oldest ready queue draft as the canonical `/blog` post
`blog-without-a-feed-is-a-dead-end`. Weekly-focus row #8 dark (rule 8) + engine
anti-rut-blocked (rule 7); onboarding row #4 / hosted-premium row #20 owned by
open PR #641 (run 30) ⇒ per step 0 picked a non-overlapping surface lever, and
step 3 **mandated a publish (not a draft)** because the queue was at 3 (≥ 3).
**Artifact:** the run-22 distribution lesson — a blog with no RSS feed is sealed
to every machine that would redistribute it (feed readers + dev.to/Medium/Hashnode
import-from-RSS with `rel=canonical`); the fix is a ~40-line no-dependency RSS
endpoint over the same typed `data/blog.ts` the sitemap already reads; count the
doors into your content, not the pages. This is the canonical copy of the feature
run 22 actually shipped (`/rss.xml`), so the post now self-syndicates via that
feed. **Measured (build-verified):** posts **22 → 23**, built pages **106 → 107**,
`dist/blog/blog-without-a-feed-is-a-dead-end/index.html` present and auto-included
in `rss.xml` (2 refs) + `sitemap.xml` + `llms.txt`; link sweep **0 dead / 0
redirecting** over 107 pages / **2,605 → 2,630** internal links (row #18). Queue
depth **3 → 2** (< 3 ⇒ next run drafts one); queue held **19,685 B < 20,480** (D4).
**KPI:** GLOBAL-025 **onboarding/UX via distribution yield** — the daily loop's
released artifact, adding one indexable+syndicatable surface. **None degrade:**
web-only additive data edit — zero engine/API/prompt code or eval baselines
touched; `bun test src/data/blog.test.ts` 17 pass, root `typecheck` green,
`bun run build` clean (107 pages), `check:links` exit 0.

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
