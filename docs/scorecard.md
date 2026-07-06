# Scorecard — current state

Point-in-time tracker, regenerated each
[`/daily`](../.claude/commands/daily.md) run. Current state only — no changelog
(≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md` (engine).

**Weekly focus number (2026-07-04 → 07-11):** **BIRD raw EX → ≥ 0.60**
(row #8) — **0.512 → 0.526 this run (07-05)**, still the only pillar below a
hard [`GLOBAL-025`](decisions/GLOBAL-025-north-star.md) Phase-2 floor;
`SK-QUAL-005` mandates engine work until it clears. **Rider (landed for
`SK-LLM-043`, run 11):** the live CI re-measure confirmed the directive
directionally (`||` concats 7 → 3; 2/3 offline targets flipped) inside a
statistically-flat run. Remaining live sub-levers: `SK-QUAL-017` SC N≥2 smoke +
the post-`SK-LLM-042` agentic-frontier re-measure. Distribution volume holds
(yield near-zero; see `weekly-review.md`).

**Worst number today:** real strangers reaching a first answer = **0** — a
lagging metric; the daily **lever** targets its agent-movable inputs. Today's
(07-05, run 11) lever: **the weekly focus itself — BIRD raw EX `0.512 → 0.526`**
(row #8). The founder's 07-04 canonical dispatch had budget-stopped at 487/500
(`resumable: true`); run 11 resumed it per the `SK-QUAL-013` loop (pin branch
`eval/bird-resume-8d3d7c5`, one 2-min window) to completion, re-seeded the
baseline, and live-verified `SK-LLM-043` (details row #8 + verification log).
**Distribution (step 3) is owned by concurrent PR #617 (run 10)** — it holds the
queue action for this cycle (queued `model-preset-fail-loud`, queue → 3); per
step-0 non-overlap run 11 touched neither queue nor blog.
**Engine finding (row #8), standing:** the **offline deterministic-ceiling
lever is exhausted** — `SK-LLM-043` (#605) took the last mechanically-provable
bucket; the dominant residual bucket (`extra_DISTINCT`) is BIRD gold-annotation
noise a directive would overfit to, corroborating the parked **corrected-set**
lever (Kang VLDB-2026; repo states no license, P2). Net: **0.526 is a floor, not
a ceiling**; next engine moves are the live sub-levers in the weekly-focus line.
Phase 2 exit gate: **1/9 criteria pass** (row #16).

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (fresh 07-05 pull — CF GraphQL + remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 82 visits / 103 pageloads (06-28→07-05, raw incl. walker) | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 8 total = 4 founder/company + 4 test/dev (unchanged) |
| 3 | DBs total | 160, all with `last_queried_at`; traffic resumed — latest 07-04 18:34 UTC | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **first data: 1/1 = 100% (N=1)** — one counted `/v1/ask` since the 07-02 instrument deploy | target ≥ 95%; N=1 is directional only, reads real once row #1 traffic converts |
| 5 | Session retention (≥ 2 queries) | 0 DBs with `first10_asks ≥ 2` yet (same N=1 instrument) | share of DBs with `first10_asks ≥ 2` (row #4 counters) |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **79** (`/vs` 31 + `/solve` 33 + `/blog` 15) — unchanged this run (+1 earlier today via #612, run 7) | leading input to rows #1–#3; `llms.txt` + sitemap auto-aggregate. **Run 10 drafted** (queue 2 < 3 ⇒ step-3 *draft*): queued `model-preset-fail-loud` (queue 2 → 3, straight from this run's lever); next run hits the ≥ 3 ⇒ publish threshold |
| 7 | Surface yield | posts 12; 7d external referrals = 3 (`www.google.com` + `aisearchindex.space` + `bing.com`, 1 pageload each) | CF `refererHost` — measured every run. Yield still near-zero — the standing weekly-review finding (distribution *volume* without *yield*); count grows, referrals flat |
| | **Engine** — BIRD 07-05 · Spider 07-02 · persona-bench 07-02 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.526** (262/498 EA, 2 `gold_error`, 07-05 — canonical 500q completed by resuming the founder's 07-04 dispatch on pinned SHA `8d3d7c5`; Δ +1.41 pp vs 0.512, McNemar b=32/c=38 statistically flat, 0 flagged regressions; [runs 28716772086](https://github.com/nlqdb/nlqdb/actions/runs/28716772086) → [28742006051](https://github.com/nlqdb/nlqdb/actions/runs/28742006051)) | target 0.65 / **Phase 2 floor 0.60 — below floor ⇒ engine work ships until cleared (`SK-QUAL-005`)**. Baseline re-seeded 07-05. **`SK-LLM-043` live-verified (run 11):** predicted-SQL `\|\|` concats 7 → 3 run-wide; offline-ceiling targets qid 1381 + 898 flipped mismatch→match live (1002 residual). Offline deterministic-ceiling lever stays exhausted (07-04 run-5 finding; residual mismatches 233 need execution/live-chain to score). Pin-branch delete still 403-blocked — any session with branch-delete rights can drop `eval/bird-resume-0e67e64` + `eval/bird-resume-8d3d7c5` |
| 9 | Spider raw EX | 0.1926 (26/135, 07-02) | target 0.75; was 0.1852 (06-17). **Worst engine number.** 07-02 free lane capacity-throttled ⇒ undercounts; `SK-QUAL-017` SC smoke undispatched |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-02) | full-chain ICP EX; 1.8× BIRD, 5× Spider — the GLOBAL-026 bet; N=23 ±1 noisy. Retrieval precision@1 saturated |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 19.3 pts** (free 47.33% → agentic-frontier 66.67%, 150-q smoke seed 20260607, 07-03; single-frontier lane 20.0 pts). persona-bench 0.00 pts (07-02) | **First clean agentic smoke since the `SK-QUAL-021` hang fix (#596)** — ran the full 150-q slice end-to-end in ~15 min, status `completed`, not resumable (windows 1–4 earlier 07-03 all ceiling-cancelled at 44 min on the runaway-SQL freeze the fix removed). Lanes: free 71/150, frontier 101/150, agentic-frontier 100/150 (both frontier lanes carry 7 `openrouter:parse` no_sql ⇒ their ceiling is higher). Smoke — no baseline touch; canonical BIRD is row #8. [run 28685576019](https://github.com/nlqdb/nlqdb/actions/runs/28685576019). **07-04: the 7 `openrouter:parse` root cause fixed at the source (`SK-LLM-042`)** — OpenRouter's 200-body error envelope was misclassified as engine `parse`; now `rate_limited` (capacity pause) / `provider_error` (retryable, tail-retry-covered). Deterministic proof shipped (unit tests); frontier-lane ceiling re-measures on the next agentic-frontier smoke window |
| | **Ops** — 7d, CF Workers analytics (fresh 07-05 pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 1,549 / 0 (0.00%) | mcp-server 763 req / 0 err; events-worker 3 req |
| 13 | nlqdb-api wall-time p50 / p95 | 1.0 ms / 983 ms | mcp-server p95 331.9 s = long-lived SSE, expected; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **PENDING_ROW15** — sdk ✅ 07-06 (1.00) · mcp ✅ 07-06 (1.00) · examples ✅ 07-06 (1.00) · opencheck PENDING_OC | run 13 owns this row: the named fix (pre-flight over an ordered free-model list) shipped + two trace-triaged suite fixes on top; sdk/mcp/examples re-dispatched same run (were staring at a 07-09 freshness cliff). Full triage in `e2e-coverage/opencheck-operations.md` (2026-07-06 row); residual app-side finding = Neon cold-start `db_unreachable`, logged as an e2e-coverage open question |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** (first measurement, 07-02) — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.526, fresh 07-05); agentic-frontier ≥ 0.80 + Δ ≤ 25 pp (**measured 07-03, row #11: Δ 19.3 pp ✓ ≤ 25, but agentic 0.667 ✗ < 0.80 — 7 `openrouter:parse` no_sql suppress the frontier lanes; criterion still fails on the absolute floor**); TTFV p50 ≤ 60 s (unmeasured); first-10 ≥ 95% (N=1 only, row #4); destructive-op retry < baseline (unmeasured); MCP in 3+ host apps (no instrument); 1 public agent product on nlqdb (0 strangers); 3 non-engineer CSV tests (CSV upload unshipped) | agent-movable next: **the 7 `openrouter:parse` root cause is now fixed at the source (`SK-LLM-042`, 07-04)** — re-measure agentic-frontier vs the 0.80 floor on the next smoke window; first-10 instrument reads with traffic; stranger-dependent criteria hang on rows #2/#6 |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **25** (07-05 run 8, was 26) | target ↓ 0. **Run 8's lever: −1** — resolved `agent-memory` *Capability-matrix freshness* by hardening the guard (`agentMemoryMatrix.test.ts` now rejects a future/invalid `MATRIX_VERIFIED_ON`; a negative age had silently passed `< 60`), not by relabeling. **Run 6's lever: −4** — resolved 4 bullets whose body already settled/parked the question but whose first line didn't reflect it (the pinned method keys off the bullet's first line): `mcp-server` Anthropic-directory-submission (engineering done + no pending human action; only external review remains ⇒ not a question we can answer), `trust-ux` SK-TRUST-001 (Parked until a P3-persona destructive-DDL test; interim = the trace block's compiled DDL is the create preview) + SK-TRUST-002 (GLOBAL-003 tracked ship-gap, parked per surface), `byo-connect` (d) `__byo_blob__` sentinel (Resolved — additive migration design). Also upgraded `quality-eval` corrected-set OQ with the P2 license finding (no count change; already parked). **Method pinned** (stops the 75↔85 drift): `- ` bullets under `## Open questions` whose text does **not** match, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed` (case-insensitive is load-bearing — a case-sensitive grep over-counts). Lever: research (P2/GLOBAL-033) → document (P4) → mark resolved |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting** (07-05 run-9 sweep, re-confirmed run 10: 99 pages, 2,321 internal links — post-claim-fix build incl. `/blog/http-200-error-in-body`) | target 0 — sweep is repeatable: `bun run --filter @nlqdb/web build && bun run --filter @nlqdb/web check:links` (checks hrefs + sitemap + llms.txt against dist; exits 1 on dead) |
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

## Last change

**2026-07-06 (run 13)** — lever: **row #15, the opencheck E2E root-cause fix
this row has named since run 9 — E2E freshness PENDING_DELTA.** Adopted the
abandoned 07-05 iteration branch (`claude/keen-turing-425eac`: ordered
`candidate_models` pre-flight — 3× tool-call probes, SK-LLM-042 HTTP-200
error-envelope body check, `__MODEL__` substitution, `maxRetries: 6` backoff;
4 dispatches, session died before opening a PR) and finished it with a
Playwright-trace triage of its last run
([28760320317](https://github.com/nlqdb/nlqdb/actions/runs/28760320317)),
which split the residual 2/5 Suite-A failures into three distinct causes:
**(a)** a deterministic test bug — `#add-row-redirects-to-auth` still hunted
the hero input on the two-door homepage after the 07-05 wave moved the create
form to `/app/new/` (agent looped null DOM queries for 240s) → repointed;
**(b)** app-side Neon cold-start — `/v1/ask` planned at confidence 1 then SSE
`db_unreachable` after ~5.7 min staging idle → the test absorbs exactly one
retry (second failure still fails) and the product-side question is logged in
e2e-coverage's Open questions; **(c)** nemotron-3-super is probe-healthy but
agent-broken — across two runs it collapsed to text-format tool calls
(`<function=…></tool_call>` as plain text, read as a final answer) → banned
from the list, replacements re-verified live against OpenRouter `/models`
`supported_parameters` (P2, 2026-07-06): gpt-oss-120b leads (only model with
a full green run; flap double-covered by probe gate + backoff), then
qwen3-coder / qwen3-next-80b / llama-3.3-70b / gpt-oss-20b. Verification:
sdk ✅ + mcp ✅ + examples ✅ re-dispatched and green 07-06 (killing the 07-09
freshness cliff); opencheck verification run PENDING_VERDICT. **Step-0
non-overlap:** open PR #619 (run 12) owns the SC verdict (row #8), the blog
publish (row #6), and the 07-06 funnel/ops pulls — this run touched none of
them; funnel/ops/engine numbers carry. **Step-3 artifact:** the queue ≥ 3
publish action is #619's this cycle ⇒ this run drafted
`llm-preflight-probe-health` into the queue (the probe-vs-agent-health lesson,
straight from the lever; queue net unchanged after #619's publish). **KPI:**
GLOBAL-025 onboarding + UX — the opencheck suites are the only automated
proof of the stranger journey (anon create → auth wall → adoption →
queryable table), dark since 06-12; engine-quality measurement integrity
advanced via the honest capacity-vs-competence split. None degrade: zero
prod code touched (workflows + test specs + docs only).
