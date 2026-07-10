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
onboarding). The distribution queue held **3** unpublished drafts (≥ 3), so
[`/daily`](../.claude/commands/daily.md) step 3 mandates *publish, don't draft*.
**Run 35 lever: publish `postgres-validator-rejects-valid-clickhouse-sql` — the
oldest ready draft (run-26 gist, `SK-MULTIENG-004`) — indexable surfaces 87 → 88
(row #6), the leading input to the worst number.** Publishing is both the mandated
artifact (step 3) and the measured lever (rows #6/#7/#18). Not anti-rut: 1 of the
last 5 merged daily PRs was a publish (#642). Detail in *Last change*.
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
| 6 | Indexable surfaces | **88** (`/vs` 31 + `/solve` 33 + `/blog` 24) — **run-35 lever: published `postgres-validator-rejects-valid-clickhouse-sql`** (engine/security lesson `SK-MULTIENG-004`, the run-26 draft; build-verified `dist/blog/postgres-validator-rejects-valid-clickhouse-sql/index.html`, in `rss.xml` + `llms.txt` + `sitemap.xml`, 107 → 108 built pages). Queue was 3 (≥ 3) ⇒ published the **oldest** ready draft per step 3 (recovered the run-26 collapsed gist body from git; its twin `text-to-sql-planner-told-wrong-dialect` explicitly pairs with it). Pending drafts **3 → 2** (KEK-rotation + planner-dialect remain) ⇒ < 3 ⇒ **next run drafts**, per step 3 | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts 24 (run 35: +`postgres-validator-rejects-valid-clickhouse-sql`); 7d external referrals = **1** (`bing.com`). Syndication feeds = **1** (`/rss.xml`, run 22, auto-import via `rel=canonical`); internal-link reciprocity done (10 anchored `/solve`+`/vs` pages, run 19). Internal links **2,655** (run-35 build). | CF `refererHost` — measured every run. Attacks "volume without yield" at its SEO/UX input; external-referral re-measure lags indexation |
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
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** (first measurement, 07-02) — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.526, fresh 07-05); agentic-frontier ≥ 0.80 + Δ ≤ 25 pp (**honestly re-measured 07-06 run 15 post-`SK-QUAL-022` clamp fix, row #11: Δ 18.66 pp ✓ ≤ 25, agentic 0.693 ✗ < 0.80 — the clamp is removed, so this now fails on a genuine competence gap, not the instrument; confirms run 14's ≤ 0.70 ceiling**); TTFV p50 ≤ 60 s (**run 34: instrumented** — `onboarding.first_answer.ttfv_ms` emitted from the anon create surface, `SK-ONBOARD-005`; p50 reads from LogSnag, stranger N ~0 like row #4 so not yet strangerly-readable, but the meter now exists); first-10 ≥ 95% (35.3% walker-dominated, N=17 — row #4); destructive-op retry < baseline (unmeasured); MCP in 3+ host apps (no instrument); 1 public agent product on nlqdb (0 strangers); 3 non-engineer CSV tests (CSV upload unshipped) | agent-movable next: the agentic-frontier criterion is now **measurement-clean** (clamp fixed) — closing the remaining ~11 pp to 0.80 is a real engine-competence lift (multi-model frontier chain `SK-LLM-017`, or the parked corrected-set); first-10 instrument reads with traffic; stranger-dependent criteria hang on rows #2/#6 |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **21** (07-09; run 33 lever: −1, resolved `byo-connect` **KEK-rotation** OQ — scoped in its canonical home `GLOBAL-031` (shared envelope): KEK version travels *in* the envelope (`nbe1.` → `nbe2.<v>.`), **not** a `key_version` column; two-KEK overlap + lazy re-wrap; ships when a rotation is first scheduled (`GLOBAL-033`); web-checked vs GCP/AWS KMS (P2) — genuine resolution, not a relabel. **Prior levers** (git preserves full detail): run 29 −1 (OQ (b) planner-told-wrong-dialect, `SK-LLM-018` dialect-aware prompting); run 26 −1 (OQ (a) CH-SQL-on-PG-validator); run 23 −1 (OQ (c) DNS-rebind TOCTOU); run 21 −1 (`e2e-coverage` cold-start OQ → run 18 `SK-ASK-013`); run 17 −2 (`premium-tier` router contracts). | target ↓ 0. **Method pinned** (stops the 75↔85 drift): `- ` bullets under `## Open questions` whose text does **not** match, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed` (case-insensitive is load-bearing — a case-sensitive grep over-counts). Lever: research (P2/GLOBAL-033) → document (P4) → mark resolved |
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

**2026-07-09 (run 35)** — lever: **publish `postgres-validator-rejects-valid-clickhouse-sql`
— indexable surfaces 87 → 88 (row #6).** Step 0: no open PRs (runs 33/34 merged);
branch reset to `origin/main` e4a708d; tree green after `bun install`. Row #8 (BIRD)
dark (rule 8) + engine anti-rut-blocked (rule 7). **Why:** the queue held 3 drafts
(≥ 3) ⇒ step 3 mandates *publish, don't draft*, and publishing moves rows #6/#7/#18
— the leading agent-movable input to the worst number (real strangers = 0, row #2).
Anti-rut clear: 1 of the last 5 merged daily PRs was a publish (#642). **Change:**
took the **oldest** ready draft (run-26 gist, `SK-MULTIENG-004`; body recovered from
git — its twin `text-to-sql-planner-told-wrong-dialect` explicitly pairs with it, so
oldest-first = narrative order). One `BLOG_POSTS` entry in `apps/web/src/data/blog.ts`
(SK-BLOG-001/002: one-file edit, typed blocks), deleted the queue draft, added the
venue pointer + live URL. The post: a Postgres-pinned `node-sql-parser` validator
false-rejects valid ClickHouse grammar as `parse_failed`; the fix splits the
dialect-agnostic destructive-verb allowlist (authoritative on every engine) from the
best-effort per-engine AST walk. **Measured:** indexable surfaces **87 → 88** (`/blog`
23 → 24); posts 23 → 24 (row #7); pages 107 → 108, links 2,630 → 2,655, **0 dead / 0
redirecting** (row #18). Queue **3 → 2** ⇒ next run drafts. **Verification:**
`bun test src` **240 pass / 0 fail** (6 `blog.test.ts` invariants); build green (108
pages); page + `sitemap.xml`/`rss.xml`/`llms.txt` presence verified. **KPI:**
GLOBAL-025 onboarding/UX via distribution yield — the canonical `/blog` copy accrues
indexation; CTA → anon `/app/new`. **None degrade:** `typecheck`/`lint` exit 0 (35
pre-existing warnings, none added); web/docs-only diff, no engine/API/prompt/eval
touched. D4: both edited docs < 20 KB.

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
