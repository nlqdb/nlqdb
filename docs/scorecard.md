# Scorecard — current state

Point-in-time tracker, regenerated each
[`/daily`](../.claude/commands/daily.md) run. Current state only — no changelog
(≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md` (engine).

**Weekly focus number (2026-07-04 → 07-11):** **BIRD raw EX → ≥ 0.60**
(row #8) — **0.526, unmoved this run (07-06)**, still the only pillar below a
hard [`GLOBAL-025`](decisions/GLOBAL-025-north-star.md) Phase-2 floor;
`SK-QUAL-005` mandates engine work until it clears. **Run 12 killed a
sub-lever honestly:** the first `SK-QUAL-017` self-consistency N≥2 dispatch
(N=3, temp 0.7, seed-20260607 150q smoke) is **exactly flat vs greedy on the
same-directive-set paired comparator** — 79/150 both, discordant b=8/c=8,
McNemar p=1.0 — at 3× quota cost; SC stays an eval-harness knob, never a
live-chain promotion. Remaining live sub-lever: the post-`SK-LLM-042`
agentic-frontier re-measure. Distribution volume holds (yield near-zero; see
`weekly-review.md`).

**Worst number today:** real strangers reaching a first answer = **0** — a
lagging metric; the daily **lever** targets its agent-movable inputs. Today's
(07-06, run 12) lever: **the weekly focus's named `SK-QUAL-017` sub-lever,
measured to a verdict** (details row #8 + verification log). Attribution
trap avoided: vs the 07-03 greedy slice (71/150, pre-`SK-LLM-043` SHA) the SC
run reads +5.33 pp — but restricted to the 07-05 canonical run's same 150
questions (same directive set) the delta is exactly 0.0; naive cross-SHA
smoke comparison would have shipped a 3×-cost placebo.
**Engine finding (row #8), standing:** the **offline deterministic-ceiling
lever is exhausted** — `SK-LLM-043` (#605) took the last mechanically-provable
bucket; the dominant residual bucket (`extra_DISTINCT`) is BIRD gold-annotation
noise a directive would overfit to, corroborating the parked **corrected-set**
lever (Kang VLDB-2026; repo states no license, P2). With SC also dead (this
run), **0.526 is a floor whose next live moves are the agentic-frontier
re-measure + the parked corrected-set**. Phase 2 exit gate: **1/9 criteria
pass** (row #16).

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (fresh 07-06 pull — CF GraphQL + remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 83 visits / 104 pageloads (06-29→07-06, raw). **New walker filter (run 12):** grouping by `userAgentBrowser` splits out the walker UA (parses as "Unknown": 70 visits) ⇒ **real-browser ≈ 13 visits** (12 excl. ChromeHeadless) | account-level RUM can't split per-path, but the browser-dimension cut is a usable walker filter going forward; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 8 total = 4 founder/company + 4 test/dev (unchanged) |
| 3 | DBs total | 162, all with `last_queried_at`; latest 07-06 00:32 UTC | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **6/17 = 35.3%** across 4 DBs with `first10_asks ≥ 1` (was 1/1) — but the late-night `db_users_*` creations look synthetic; counters carry no principal column, so walker vs stranger can't be split in-table | target ≥ 95%; attribution gap is the instrument's next fix (a principal/UA tag on the counters) — until then the rate is walker-dominated, not a stranger read |
| 5 | Session retention (≥ 2 queries) | 3 DBs with `first10_asks ≥ 2` (same attribution caveat as row #4) | share of DBs with `first10_asks ≥ 2` (row #4 counters) |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **80** (`/vs` 31 + `/solve` 33 + `/blog` 16) — +1 this run: published `/blog/llm-concatenates-columns-text-to-sql` (queue was 3 ≥ 3 ⇒ publish; oldest draft) | leading input to rows #1–#3; `llms.txt` + sitemap auto-aggregate. Queue back at 3 after run 13's same-day `llm-preflight-probe-health` draft (≥ 3 ⇒ next run publishes) |
| 7 | Surface yield | posts 16; 7d external referrals = **1** (`bing.com`, 1 pageload; google + aisearchindex.space fell out of the window) | CF `refererHost` — measured every run. Yield still near-zero — the standing weekly-review finding (distribution *volume* without *yield*); count grows, referrals flat |
| | **Engine** — BIRD 07-05 · Spider 07-02 · persona-bench 07-02 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.526** (262/498 EA, 2 `gold_error`, 07-05 canonical, [run 28742006051](https://github.com/nlqdb/nlqdb/actions/runs/28742006051)). **`SK-QUAL-017` SC verdict (run 12, 07-06):** first N≥2 dispatch (N=3, temp 0.7, 150q smoke, [run 28761582097](https://github.com/nlqdb/nlqdb/actions/runs/28761582097)) = **79/150 = 0.5267, exactly flat vs the same-directive-set greedy comparator** (canonical run restricted to the identical 150 qids: 79/150; b=8/c=8, p=1.0; SC `no_sql` 1/150) — majority-vote at 3× quota buys 0 on the free chain; the 8↔8 swaps are provider-mix noise | target 0.65 / **Phase 2 floor 0.60 — below floor ⇒ engine work ships until cleared (`SK-QUAL-005`)**. Baseline re-seeded 07-05. `SK-LLM-043` live-verified (run 11): `\|\|` concats 7 → 3 run-wide. Offline deterministic-ceiling lever exhausted (07-04); **SC lever dead (this run)** — remaining: agentic-frontier re-measure + parked corrected-set. Pin-branch delete still 403-blocked (`eval/bird-resume-0e67e64` + `-8d3d7c5`) |
| 9 | Spider raw EX | 0.1926 (26/135, 07-02) | target 0.75; was 0.1852 (06-17). **Worst engine number.** 07-02 free lane capacity-throttled ⇒ undercounts; Spider SC smoke now presumptively skippable — BIRD's SC verdict (row #8) came back flat, so re-measuring Spider capacity-honestly matters more than SC |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-02) | full-chain ICP EX; 1.8× BIRD, 5× Spider — the GLOBAL-026 bet; N=23 ±1 noisy. Retrieval precision@1 saturated |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 19.3 pts** (free 47.33% → agentic-frontier 66.67%, 150-q smoke seed 20260607, 07-03; single-frontier lane 20.0 pts). persona-bench 0.00 pts (07-02) | **First clean agentic smoke since the `SK-QUAL-021` hang fix (#596)** — ran the full 150-q slice end-to-end in ~15 min, status `completed`, not resumable (windows 1–4 earlier 07-03 all ceiling-cancelled at 44 min on the runaway-SQL freeze the fix removed). Lanes: free 71/150, frontier 101/150, agentic-frontier 100/150 (both frontier lanes carry 7 `openrouter:parse` no_sql ⇒ their ceiling is higher). Smoke — no baseline touch; canonical BIRD is row #8. [run 28685576019](https://github.com/nlqdb/nlqdb/actions/runs/28685576019). **07-04: the 7 `openrouter:parse` root cause fixed at the source (`SK-LLM-042`)** — OpenRouter's 200-body error envelope was misclassified as engine `parse`; now `rate_limited` (capacity pause) / `provider_error` (retryable, tail-retry-covered). Deterministic proof shipped (unit tests); frontier-lane ceiling re-measures on the next agentic-frontier smoke window |
| | **Ops** — 7d, CF Workers analytics (fresh 07-06 pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 2,281 / 0 (0.00%) | mcp-server 425 req / 0 err; events-worker 4 req |
| 13 | nlqdb-api wall-time p50 / p95 | 10.1 ms / 1.35 s | mcp-server p95 331.5 s = long-lived SSE, expected; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.75** — sdk ✅ 07-06 (1.00) · mcp ✅ 07-06 (1.00) · examples ✅ 07-06 (1.00) · opencheck ❌ (**Suite A 4/5, best since the 06-12 green** — [run 28768099957](https://github.com/nlqdb/nlqdb/actions/runs/28768099957)) | run 13 owns this row: the named fix (pre-flight over an ordered free-model list) shipped + trace-triaged suite fixes; sdk/mcp/examples re-dispatched same run (were staring at a 07-09 freshness cliff). Suite A's sole failure = app-side cold-start `db_unreachable` (2× trace-verified ⇒ e2e-coverage open question, **next lever for whichever run owns this row**); Suite B 0/8 = weakest-candidate capacity (4 stronger pools simultaneously 429 at pick time), not a fix regression. Full triage: `e2e-coverage/opencheck-operations.md` 2026-07-06 rows |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** (first measurement, 07-02) — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.526, fresh 07-05); agentic-frontier ≥ 0.80 + Δ ≤ 25 pp (**measured 07-03, row #11: Δ 19.3 pp ✓ ≤ 25, but agentic 0.667 ✗ < 0.80 — 7 `openrouter:parse` no_sql suppress the frontier lanes; criterion still fails on the absolute floor**); TTFV p50 ≤ 60 s (unmeasured); first-10 ≥ 95% (35.3% walker-dominated, N=17 — row #4); destructive-op retry < baseline (unmeasured); MCP in 3+ host apps (no instrument); 1 public agent product on nlqdb (0 strangers); 3 non-engineer CSV tests (CSV upload unshipped) | agent-movable next: **the 7 `openrouter:parse` root cause is now fixed at the source (`SK-LLM-042`, 07-04)** — re-measure agentic-frontier vs the 0.80 floor on the next smoke window; first-10 instrument reads with traffic; stranger-dependent criteria hang on rows #2/#6 |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **28** (07-06; run 12 re-count 27 = 25 + run 10's 2 review-pass bullets, +1 run 13's e2e-coverage cold-start bullet) | target ↓ 0. **Run 8's lever: −1** — resolved `agent-memory` *Capability-matrix freshness* by hardening the guard (`agentMemoryMatrix.test.ts` now rejects a future/invalid `MATRIX_VERIFIED_ON`; a negative age had silently passed `< 60`), not by relabeling. **Run 6's lever: −4** — resolved 4 bullets whose body already settled/parked the question but whose first line didn't reflect it (the pinned method keys off the bullet's first line): `mcp-server` Anthropic-directory-submission (engineering done + no pending human action; only external review remains ⇒ not a question we can answer), `trust-ux` SK-TRUST-001 (Parked until a P3-persona destructive-DDL test; interim = the trace block's compiled DDL is the create preview) + SK-TRUST-002 (GLOBAL-003 tracked ship-gap, parked per surface), `byo-connect` (d) `__byo_blob__` sentinel (Resolved — additive migration design). Also upgraded `quality-eval` corrected-set OQ with the P2 license finding (no count change; already parked). **Method pinned** (stops the 75↔85 drift): `- ` bullets under `## Open questions` whose text does **not** match, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed` (case-insensitive is load-bearing — a case-sensitive grep over-counts). Lever: research (P2/GLOBAL-033) → document (P4) → mark resolved |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting** (07-06 run-12 sweep: 100 pages, 2,345 internal links — build incl. `/blog/llm-concatenates-columns-text-to-sql`) | target 0 — sweep is repeatable: `bun run --filter @nlqdb/web build && bun run --filter @nlqdb/web check:links` (checks hrefs + sitemap + llms.txt against dist; exits 1 on dead) |
| | **Product-readiness** — client-blocking gaps the loop was blind to (added 07-04) | | non-deferral gaps that no prior row measured, so rule 2 ("no change without a number") could never select them; now agent-movable |
| 19 | Live-surface claim integrity | **0 tracked gaps** (07-05, was 4) | claim-vs-reality on shipped user-facing surfaces; target 0. Run-9 fixes, all "soften to what shipped": (a)+(b) `/pricing` backup bullets deleted + "Export anytime" → "pull it out with plain SQL" (`architecture.md` tier table matched); (c) `progress.md §0` + the `CodePanel` surface matrix (component currently unmounted from the home2 homepage — kept honest anyway): wrappers + Swift → **Built** (npm/SPM publish gated per `.changeset/README.md`); same-family: `frameworks.mdx` caution + unpublished note in 4 `examples/*` READMEs whose `npm install @nlqdb/*` 404s; (d) `docs.nlqdb.com/mcp` rewritten to the 3 real paths (`https://mcp.nlqdb.com/mcp`, nlqdb.com buttons, env var) — fabricated `nlq mcp install` walkthrough + nonexistent `app.nlqdb.com/mcp` deep-link path removed, `nlq mcp detect` documented as-is. Review pass swept the same families further: `/agents` "one command" card `nlq mcp install` → `claude mcp add`; `examples/cli` fake verbs (`nlq export`/`connection`/`--csv`/`--region`) → real `run --json` forms + a `nlq login` not-shipped note; bare `mcp.nlqdb.com` paste-URLs → `/mcp` (docs index, `/integrations`, 3 solve pages); unpublished `@nlqdb/mcp` no longer sold as an npm binary (solve, `progress.md`, `mcp.mdx`). Second review pass, same families: root-README table + `stdio.ts` no-key hint paste-URLs → `/mcp`; `examples/README.md` fake `nlq keys create` verb + stale "runtime not wired yet" status → dashboard-mint path + live status; `walkthrough.sh` fabricated `nlq login` success output → anonymous-first (the stub exits non-zero, so the script also aborted under `set -e`); `architecture.md` §3.3/§3.4 stale `nlq connection` / `nlq mcp install` / three-tools prose → shipped verbs + `SK-MCP-002` ref; `SK-WEB-003` consequence re-pointed at the live two-door proof, `CodePanel` recorded as unmounted (GLOBAL-033 resolution of the feature-vs-code gap). Next count re-audits fresh (e.g. paid-tier limit claims while billing is dark); sweep candidate stands: extend `check:links` to assert each advertised capability has shipped code |
| 20 | Hosted-premium readiness (§6 build-before-signal) | **schema ✅ · BYOLLM lanes ✅ · picker: web ✅ (`SK-PREMIUM-013`, #610) · picker parity ✅ (`SK-PREMIUM-014`, run 10: `model` preset + routing on `/v1/ask` — `fast` pins free, `best` 409s `model_unavailable` sans frontier lane — + SDK `model`, CLI `--model`, MCP `model`, `<nlq-data model>`; residual gaps tracked: `nlq model set`, per-provider key storage) · premium chain ⬜ · CTA (`SK-PREMIUM-004`) ⬜ · spend-cap UI ⬜** | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is **built before** the signal (lighting it is a flag flip); only the *meter firing* (Lago→Stripe) + cost-incurring infra stay dark. The meter staying off is not a reason to leave the slot unbuilt; drive ⬜→✅ each run (#610 07-04, run 10 07-05); next slot: the premium chain (`SK-LLM-017`, flag-dark) or the CTA |
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
- https://nlqdb.com/blog/llm-concatenates-columns-text-to-sql/ (run 12 — engine lesson, SK-LLM-043 projection directive / positional-tuple EX)

## Last change

**2026-07-06 (run 13)** — lever: **row #15, the opencheck E2E root-cause fix
this row has named since run 9 — E2E freshness 0.49 → 0.75**. Adopted the
abandoned 07-05 iteration branch (`claude/keen-turing-425eac`): ordered
`candidate_models` pre-flight — 3× tool-call probes, SK-LLM-042 HTTP-200
error-envelope body check, `__MODEL__` substitution, `maxRetries: 6` backoff —
then Playwright-trace-triaged the residual 2/5 Suite-A failures
([28760320317](https://github.com/nlqdb/nlqdb/actions/runs/28760320317)) into
three causes, all fixed: **(a)** `#add-row-redirects-to-auth` still hunted the
hero input after the create form moved to `/app/new/` → repointed; **(b)**
app-side Neon cold-start — `/v1/ask` plans at confidence 1 then SSE
`db_unreachable` after ~5.7 min staging idle → the test absorbs exactly one
retry, product-side question filed in e2e-coverage's Open questions; **(c)**
nemotron-3-super probe-healthy but agent-broken (collapses to text-format
tool calls mid-loop) → banned, replacements re-verified live against
OpenRouter `/models` `supported_parameters` (P2, 2026-07-06). Verification:
sdk ✅ + mcp ✅ + examples ✅ re-dispatched green 07-06 (07-09 freshness cliff
killed); opencheck run
([28768099957](https://github.com/nlqdb/nlqdb/actions/runs/28768099957)):
**Suite A 4/5, best since the 06-12 green** — on the WEAKEST candidate
(`gpt-oss-20b`, after the pre-flight honestly walked past four
simultaneously-saturated stronger pools), sole failure = the 2×-reproduced
cold-start; Suite B 0/8 is that model's documented capacity class, so the
workflow stays red until a 120b-class pool is healthy at dispatch or the
cold-start fix lands (full triage: `e2e-coverage/opencheck-operations.md`
2026-07-06 rows). Same-day run 12 (PR #619) owned the SC verdict (row #8),
the blog publish (row #6), and the 07-06 funnel/ops pulls; this run drafted
`llm-preflight-probe-health` into the queue (probe-health ≠ agent-health).
**KPI:** GLOBAL-025 onboarding + UX — the opencheck suites are the only
automated proof of the stranger journey (anon create → auth wall → adoption
→ queryable table), dark since 06-12; engine-quality measurement integrity
advanced via the capacity-vs-competence split. None degrade: zero prod code
touched (workflows + test specs + docs only).
