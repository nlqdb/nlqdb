# Scorecard — current state

Point-in-time tracker, regenerated each
[`/daily`](../.claude/commands/daily.md) run. Current state only — no changelog
(≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md` (engine).

**Weekly focus number (2026-07-04 → 07-11):** **BIRD raw EX 0.512 → ≥ 0.60**
(row #8). The only pillar below a hard [`GLOBAL-025`](decisions/GLOBAL-025-north-star.md)
Phase-2 floor, and `SK-QUAL-005` mandates engine work until it clears — so it
outranks the distribution lever this week regardless of anti-rut. Agent-movable
via `SK-QUAL-014` loss-bucket → planner-directive mining (`SK-LLM-043` shipped a
+0.6 pp offline ceiling this cycle). **Rider:** land the *live* CI re-measure of
each directive, not just offline de-concat ceilings — the loop is accruing
unverified-live deltas. Distribution volume holds (yield near-zero; see
`weekly-review.md`).

**Worst number today:** real strangers reaching a first answer = **0** — a
lagging metric; the daily **lever** targets its agent-movable inputs. Today's
(07-05, run 7) lever: **indexable surfaces `78 → 79`** (row #6) — the queue held
**3** unpublished drafts, hitting step 3's ≥ 3 → *publish* threshold, so this run
published the oldest ready draft as a canonical `/blog` post:
[`/blog/http-200-error-in-body`](https://nlqdb.com/blog/http-200-error-in-body/)
(engine-lesson honesty post: a gateway commits `200 OK` before the upstream model
fails, so the error rides in the 200 body; a `res.ok`-only client miscounts it as
a wrong answer — the `SK-LLM-042` classifier finding, generalized). Web build now
99 pages (was 98), link-check 0 dead / 0 redirecting, new slug auto-included in
`llms.txt` + sitemap. Engine (weekly focus) was **not** the lever — its only live
sub-lever needs a dedicated eval-free day (see below), incompatible with shipping
any PR today (merging moves main's SHA + breaks the SHA-keyed multi-window
resume).
**Engine finding (row #8), re-confirmed independently this run:** BIRD 0.512 is
below the ≥ 0.60 Phase 2 floor and the **offline deterministic-ceiling lever is
exhausted** — `SK-LLM-043` (#605) took the last mechanically-provable bucket.
Re-downloaded the real BIRD gold + re-ran the `SK-QUAL-014` analyzer here: 0
`literal_only` / 0 `date_literal_only` clean directive-recoverable buckets
remain; the largest single-tag buckets are **`extra_DISTINCT` (46/238) and
`other_predicate_or_value` (21)** — the DISTINCT mass is dominated by BIRD
gold-annotation noise / semantic-equivalence (several cases the model is *more*
correct than gold, e.g. `COUNT(DISTINCT id)` after a fan-out join), so a
directive there would **overfit to wrong gold** and degrade real-world quality.
This corroborates the parked **corrected-set** lever (quality-eval OQ): the Kang
VLDB-2026 corrected set (52.8% BIRD annotation errors) exists as git-JSON our
loader parses — a ~50-LOC scorer patch — but **the repo states no license**
(P2), so it stays parked pending a license issue upstream. Net: **0.512 is a
floor, not a ceiling**; the next engine move is a batched live re-measure on an
eval-free day, not this run. Phase 2 exit gate: **1/9 criteria pass** (row #16).

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (fresh 07-03 pull — CF GraphQL + remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 93 / 118 pageloads (raw, incl. walker) | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 8 total = 4 founder/company + 4 test/dev (unchanged) |
| 3 | DBs total | 160, all with `last_queried_at` (anon + walker) | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | no data — instrument live (migration 0020 applied), counters all zero | target ≥ 95%; still zero `/v1/ask` since the 07-02 deploy (latest `last_queried_at` = 07-02 09:25 UTC, 28h+ quiet) — reads on next pull with traffic |
| 5 | Session retention (≥ 2 queries) | no data yet — same instrument, awaiting traffic | share of DBs with `first10_asks ≥ 2` (row #4 counters) |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **79** (`/vs` 31 + `/solve` 33 + `/blog` 15) — **+1 this run** | leading input to rows #1–#3; `llms.txt` + sitemap auto-aggregate. **Run 7 published** — queue held **3** drafts (≥ 3 ⇒ step-3 *publish*): shipped `/blog/http-200-error-in-body` (oldest ready draft), queue 3 → 2. Web build 99 pages (was 98); link-check 0 dead |
| 7 | Surface yield | posts 12; 7d external referrals = 3 (`www.google.com` + `aisearchindex.space` + `bing.com`, 1 pageload each) | CF `refererHost` — measured every run. Yield still near-zero — the standing weekly-review finding (distribution *volume* without *yield*); count grows, referrals flat |
| | **Engine** — BIRD 07-03 · Spider 07-02 · persona-bench 07-02 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.512** (256/500, 07-03 — first completed 500q canonical since 06-19; Δ −0.8 pp vs 0.520, McNemar p=0.36 statistically flat, 0 flagged regressions; [run 28640034273](https://github.com/nlqdb/nlqdb/actions/runs/28640034273)) | target 0.65 / **Phase 2 floor 0.60 — below floor ⇒ engine work ships until cleared (`SK-QUAL-005`)**. Resume loop closed (4 checkpointed windows), baseline re-seeded 07-03; pin-branch delete blocked by session push scope — any session with branch-delete rights can drop `eval/bird-resume-0e67e64`. **07-04 run 3: `SK-LLM-043` projection directive shipped** — de-concat ceiling on the real DBs flips 3/7 concat-mismatches (EX 0.512→0.518), 0/256 matches at risk; live EX re-measures on the next canonical CI run. **07-04 run 5: offline deterministic-ceiling lever exhausted** — `SK-QUAL-014` re-run vs gold shows the remaining 238 mismatches need execution/live-chain to score (join-direction/alias/DISTINCT/subquery diffs, not one deterministic transform: `drop_distinct` 0 flips, `strip_trailing_limit` 0); next engine move is a batched live re-measure on an eval-free day |
| 9 | Spider raw EX | 0.1926 (26/135, 07-02) | target 0.75; was 0.1852 (06-17). **Worst engine number.** 07-02 free lane capacity-throttled ⇒ undercounts; `SK-QUAL-017` SC smoke undispatched |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-02) | full-chain ICP EX; 1.8× BIRD, 5× Spider — the GLOBAL-026 bet; N=23 ±1 noisy. Retrieval precision@1 saturated |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 19.3 pts** (free 47.33% → agentic-frontier 66.67%, 150-q smoke seed 20260607, 07-03; single-frontier lane 20.0 pts). persona-bench 0.00 pts (07-02) | **First clean agentic smoke since the `SK-QUAL-021` hang fix (#596)** — ran the full 150-q slice end-to-end in ~15 min, status `completed`, not resumable (windows 1–4 earlier 07-03 all ceiling-cancelled at 44 min on the runaway-SQL freeze the fix removed). Lanes: free 71/150, frontier 101/150, agentic-frontier 100/150 (both frontier lanes carry 7 `openrouter:parse` no_sql ⇒ their ceiling is higher). Smoke — no baseline touch; BIRD canonical stays 0.512 (row #8). [run 28685576019](https://github.com/nlqdb/nlqdb/actions/runs/28685576019). **07-04: the 7 `openrouter:parse` root cause fixed at the source (`SK-LLM-042`)** — OpenRouter's 200-body error envelope was misclassified as engine `parse`; now `rate_limited` (capacity pause) / `provider_error` (retryable, tail-retry-covered). Deterministic proof shipped (unit tests); frontier-lane ceiling re-measures on the next agentic-frontier smoke window |
| | **Ops** — 7d, CF Workers analytics (fresh 07-03 pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 1,949 / 0 (0.00%) | mcp-server 816 req / 0 err; events-worker 2 req |
| 13 | nlqdb-api wall-time p50 / p95 | 1.0 ms / 876 ms | mcp-server p95 331.8 s = long-lived SSE, expected; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.64** (natural 1-day decay from 0.75) — sdk ✅ 07-02 · mcp ✅ 07-02 · examples ✅ 07-02 · opencheck ❌ (last ✅ 06-12 ⇒ freshness 0) | opencheck failed twice 07-02 on OpenRouter free-tier 429 (driver LLM throttled — infra, not product); its driver shares free-LLM capacity with the eval lanes (BIRD burned it again 07-03) — dispatch opencheck on an eval-free day |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** (first measurement, 07-02) — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.512, fresh 07-03); agentic-frontier ≥ 0.80 + Δ ≤ 25 pp (**measured 07-03, row #11: Δ 19.3 pp ✓ ≤ 25, but agentic 0.667 ✗ < 0.80 — 7 `openrouter:parse` no_sql suppress the frontier lanes; criterion still fails on the absolute floor**); TTFV p50 ≤ 60 s (unmeasured); first-10 ≥ 95% (no data, row #4); destructive-op retry < baseline (unmeasured); MCP in 3+ host apps (no instrument); 1 public agent product on nlqdb (0 strangers); 3 non-engineer CSV tests (CSV upload unshipped) | agent-movable next: **the 7 `openrouter:parse` root cause is now fixed at the source (`SK-LLM-042`, 07-04)** — re-measure agentic-frontier vs the 0.80 floor on the next smoke window; first-10 instrument reads with traffic; stranger-dependent criteria hang on rows #2/#6 |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **26** (07-04 run 6, was 30) | target ↓ 0. **This run's lever: −4** — resolved 4 bullets whose body already settled/parked the question but whose first line didn't reflect it (the pinned method keys off the bullet's first line): `mcp-server` Anthropic-directory-submission (engineering done + no pending human action; only external review remains ⇒ not a question we can answer), `trust-ux` SK-TRUST-001 (Parked until a P3-persona destructive-DDL test; interim = the trace block's compiled DDL is the create preview) + SK-TRUST-002 (GLOBAL-003 tracked ship-gap, parked per surface), `byo-connect` (d) `__byo_blob__` sentinel (Resolved — additive migration design). Also upgraded `quality-eval` corrected-set OQ with the P2 license finding (no count change; already parked). **Method pinned** (stops the 75↔85 drift): `- ` bullets under `## Open questions` whose text does **not** match, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed` (case-insensitive is load-bearing — a case-sensitive grep over-counts). Lever: research (P2/GLOBAL-033) → document (P4) → mark resolved |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting** (07-05 run-7 sweep: 99 pages, 2,321 internal links — new `/blog/http-200-error-in-body` page included) | target 0 — sweep is repeatable: `bun run --filter @nlqdb/web build && bun run --filter @nlqdb/web check:links` (checks hrefs + sitemap + llms.txt against dist; exits 1 on dead) |
| | **Product-readiness** — client-blocking gaps the loop was blind to (added 07-04) | | non-deferral gaps that no prior row measured, so rule 2 ("no change without a number") could never select them; now agent-movable |
| 19 | Live-surface claim integrity | **4 gaps** (07-04, first count) | claim-vs-reality on shipped user-facing surfaces; target 0. (a) `/pricing` sells "7-/30-day backups" — none exist, only `.envrc` is backed up (`blindspot-analysis.md:120`); (b) `/pricing` "Export anytime, free" — no export endpoint in `apps/api`; (c) `progress.md §0` labels 8 framework wrappers + Swift "Shipped" — all `private:true`/`0.0.0`, 404 on npm/SPM; (d) `docs.nlqdb.com/mcp` walks `nlq mcp install` as working — the CLI flow is stubbed (contradicts the live `/cli` page). Fix = ship the backing or soften the claim; sweep candidate: extend `check:links` to assert each priced/advertised capability has shipped code |
| 20 | Hosted-premium readiness (§6 build-before-signal) | **schema ✅ · BYOLLM lanes ✅ · picker: web ✅ (`SK-PREMIUM-013`, #610: ModelPicker + `GET /v1/models` + SDK `getModels()`) · picker parity ⬜ (preset param on `/v1/ask`, SDK `model` option, CLI/elements/MCP) · premium chain ⬜ · CTA (`SK-PREMIUM-004`) ⬜ · spend-cap UI ⬜** | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is **built before** the signal (lighting it is a flag flip); only the *meter firing* (Lago→Stripe) + cost-incurring infra stay dark. The meter staying off is not a reason to leave the slot unbuilt; drive ⬜→✅ each run (first slice #610 landed 07-04) |
=======
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting** (07-05 run-7 sweep: 99 pages, 2,321 internal links — new `/blog/http-200-error-in-body` page included) | target 0 — sweep is repeatable: `bun run --filter @nlqdb/web build && bun run --filter @nlqdb/web check:links` (checks hrefs + sitemap + llms.txt against dist; exits 1 on dead) |
>>>>>>> 80aef90 (daily: publish /blog/http-200-error-in-body — surfaces 78 → 79 (run 7))
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/20 + 12 memory `/vs` pages | tick on merge; mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — the only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; E-03…E-07 (per-agent RLS, TTL, hybrid recall, authed on-ramp, ClickHouse) all Neon/infra-gated |

## Shipped distribution (live URLs)

Canonical copies on `/blog` (`SK-BLOG-001`); venue variants stay in
`research/distribution-queue.md` as pointers:

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

## Last change

**2026-07-05 (run 7)** — lever: **indexable surfaces `78 → 79`** (row #6). The
distribution queue held **3** unpublished drafts, hitting step 3's ≥ 3 →
*publish* threshold, so this run published the oldest ready draft as a canonical
`/blog` post rather than drafting a fourth:
[`/blog/http-200-error-in-body`](https://nlqdb.com/blog/http-200-error-in-body/)
— the engine-lesson honesty post generalizing the `SK-LLM-042` finding: an LLM
gateway commits `200 OK` before the upstream provider fails, so the real error
rides in the 200 body; a `res.ok`-only client scores it as a wrong answer,
inflating an eval's error rate and hiding a capacity problem. Fix = inspect the
body for a top-level `error` before trusting `choices`; `res.ok` is necessary,
not sufficient. Queue 3 → 2; draft deleted, venue variant (dev.to + r/LocalLLaMA
+ lobste.rs) kept as a pointer to the canonical URL. **Verification:** web build
99 pages (was 98), `check:links` 0 dead / 0 redirecting over 2,321 internal
links, `blog.test.ts` 6/6 pass (slug/date/length/copy-rule/renderer guards), new
slug auto-included in `llms.txt` + sitemap; full gates green (typecheck ✓, lint ✓
exit 0, test ✓ 872 API + all packages). **Engine (weekly focus) was not the
lever:** its only live sub-lever needs a dedicated eval-free day — merging any PR
moves main's SHA and breaks the SHA-keyed multi-window resume — incompatible with
shipping today; 0.512 remains a floor, not a ceiling (offline deterministic lever
exhausted, run 5). **KPI:** GLOBAL-025 distribution-yield / onboarding — one live
indexable surface added (78 → 79), engine-honesty narrative advanced; no KPI
degrades (funnel/engine/ops numbers carry from the < 72 h-old 07-03 pull; the new
page adds a surface without touching any engine or product code path).
