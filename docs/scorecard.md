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
(07-05, run 9) lever: **live-surface claim integrity `4 → 0`** (row #19) — all
four tracked claim-vs-reality gaps fixed by softening the claim to what
shipped (details in the row). Engine (weekly focus) was **not** the lever —
the canonical BIRD re-dispatch is decision-blocked until the baseline turns
7 days old (`SK-QUAL-002`, re-seeded 07-03 ⇒ window opens **07-10**), and the
offline deterministic lever is exhausted (see below). Today's eval-free LLM
capacity went to re-arming `e2e-opencheck` instead (row #15). Step-3 artifact:
the queue action (3 drafts ⇒ publish) was owned by concurrent PR #612 (run 7,
since merged — surfaces 79) per step-0 non-overlap; this run's released
artifacts are the corrected live surfaces themselves (`/pricing`,
`docs.nlqdb.com` MCP + frameworks pages, `progress.md §0`). Earlier today run 8
(#613) took docs-ambiguity 26 → 25 (row #17) by hardening the
`agentMemoryMatrix` freshness guard against future/invalid dates.
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
| | **Funnel** (fresh 07-05 pull — CF GraphQL + remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 82 visits / 103 pageloads (06-28→07-05, raw incl. walker) | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 8 total = 4 founder/company + 4 test/dev (unchanged) |
| 3 | DBs total | 160, all with `last_queried_at`; traffic resumed — latest 07-04 18:34 UTC | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **first data: 1/1 = 100% (N=1)** — one counted `/v1/ask` since the 07-02 instrument deploy | target ≥ 95%; N=1 is directional only, reads real once row #1 traffic converts |
| 5 | Session retention (≥ 2 queries) | 0 DBs with `first10_asks ≥ 2` yet (same N=1 instrument) | share of DBs with `first10_asks ≥ 2` (row #4 counters) |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **79** (`/vs` 31 + `/solve` 33 + `/blog` 15) — +1 today via PR #612 (run 7) | leading input to rows #1–#3; `llms.txt` + sitemap auto-aggregate. **Run 7 published** — queue held **3** drafts (≥ 3 ⇒ step-3 *publish*): shipped `/blog/http-200-error-in-body` (oldest ready draft), queue 3 → 2 |
| 7 | Surface yield | posts 12; 7d external referrals = 3 (`www.google.com` + `aisearchindex.space` + `bing.com`, 1 pageload each) | CF `refererHost` — measured every run. Yield still near-zero — the standing weekly-review finding (distribution *volume* without *yield*); count grows, referrals flat |
| | **Engine** — BIRD 07-03 · Spider 07-02 · persona-bench 07-02 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.512** (256/500, 07-03 — first completed 500q canonical since 06-19; Δ −0.8 pp vs 0.520, McNemar p=0.36 statistically flat, 0 flagged regressions; [run 28640034273](https://github.com/nlqdb/nlqdb/actions/runs/28640034273)) | target 0.65 / **Phase 2 floor 0.60 — below floor ⇒ engine work ships until cleared (`SK-QUAL-005`)**. Resume loop closed (4 checkpointed windows), baseline re-seeded 07-03; pin-branch delete blocked by session push scope — any session with branch-delete rights can drop `eval/bird-resume-0e67e64`. **07-04 run 3: `SK-LLM-043` projection directive shipped** — de-concat ceiling on the real DBs flips 3/7 concat-mismatches (EX 0.512→0.518), 0/256 matches at risk; live EX re-measures on the next canonical CI run. **07-04 run 5: offline deterministic-ceiling lever exhausted** — `SK-QUAL-014` re-run vs gold shows the remaining 238 mismatches need execution/live-chain to score (join-direction/alias/DISTINCT/subquery diffs, not one deterministic transform: `drop_distinct` 0 flips, `strip_trailing_limit` 0); next engine move is a batched live re-measure on an eval-free day |
| 9 | Spider raw EX | 0.1926 (26/135, 07-02) | target 0.75; was 0.1852 (06-17). **Worst engine number.** 07-02 free lane capacity-throttled ⇒ undercounts; `SK-QUAL-017` SC smoke undispatched |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-02) | full-chain ICP EX; 1.8× BIRD, 5× Spider — the GLOBAL-026 bet; N=23 ±1 noisy. Retrieval precision@1 saturated |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 19.3 pts** (free 47.33% → agentic-frontier 66.67%, 150-q smoke seed 20260607, 07-03; single-frontier lane 20.0 pts). persona-bench 0.00 pts (07-02) | **First clean agentic smoke since the `SK-QUAL-021` hang fix (#596)** — ran the full 150-q slice end-to-end in ~15 min, status `completed`, not resumable (windows 1–4 earlier 07-03 all ceiling-cancelled at 44 min on the runaway-SQL freeze the fix removed). Lanes: free 71/150, frontier 101/150, agentic-frontier 100/150 (both frontier lanes carry 7 `openrouter:parse` no_sql ⇒ their ceiling is higher). Smoke — no baseline touch; BIRD canonical stays 0.512 (row #8). [run 28685576019](https://github.com/nlqdb/nlqdb/actions/runs/28685576019). **07-04: the 7 `openrouter:parse` root cause fixed at the source (`SK-LLM-042`)** — OpenRouter's 200-body error envelope was misclassified as engine `parse`; now `rate_limited` (capacity pause) / `provider_error` (retryable, tail-retry-covered). Deterministic proof shipped (unit tests); frontier-lane ceiling re-measures on the next agentic-frontier smoke window |
| | **Ops** — 7d, CF Workers analytics (fresh 07-05 pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 1,549 / 0 (0.00%) | mcp-server 763 req / 0 err; events-worker 3 req |
| 13 | nlqdb-api wall-time p50 / p95 | 1.0 ms / 983 ms | mcp-server p95 331.9 s = long-lived SSE, expected; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.49** — sdk ✅ 07-02 (0.65) · mcp ✅ 07-02 (0.65) · examples ✅ 07-02 (0.65) · opencheck ❌ (last ✅ 06-12 ⇒ 0) | opencheck's 07-02 failures were OpenRouter free-tier 429 (infra, not product); **07-05 is eval-free** (SK-QUAL-002 blocks a canonical BIRD dispatch until 07-10), so this run re-dispatched `e2e-opencheck` on `main` — result reads on the next pull |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** (first measurement, 07-02) — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.512, fresh 07-03); agentic-frontier ≥ 0.80 + Δ ≤ 25 pp (**measured 07-03, row #11: Δ 19.3 pp ✓ ≤ 25, but agentic 0.667 ✗ < 0.80 — 7 `openrouter:parse` no_sql suppress the frontier lanes; criterion still fails on the absolute floor**); TTFV p50 ≤ 60 s (unmeasured); first-10 ≥ 95% (no data, row #4); destructive-op retry < baseline (unmeasured); MCP in 3+ host apps (no instrument); 1 public agent product on nlqdb (0 strangers); 3 non-engineer CSV tests (CSV upload unshipped) | agent-movable next: **the 7 `openrouter:parse` root cause is now fixed at the source (`SK-LLM-042`, 07-04)** — re-measure agentic-frontier vs the 0.80 floor on the next smoke window; first-10 instrument reads with traffic; stranger-dependent criteria hang on rows #2/#6 |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **25** (07-05 run 8, was 26) | target ↓ 0. **Run 8's lever: −1** — resolved `agent-memory` *Capability-matrix freshness* by hardening the guard (`agentMemoryMatrix.test.ts` now rejects a future/invalid `MATRIX_VERIFIED_ON`; a negative age had silently passed `< 60`), not by relabeling. **Run 6's lever: −4** — resolved 4 bullets whose body already settled/parked the question but whose first line didn't reflect it (the pinned method keys off the bullet's first line): `mcp-server` Anthropic-directory-submission (engineering done + no pending human action; only external review remains ⇒ not a question we can answer), `trust-ux` SK-TRUST-001 (Parked until a P3-persona destructive-DDL test; interim = the trace block's compiled DDL is the create preview) + SK-TRUST-002 (GLOBAL-003 tracked ship-gap, parked per surface), `byo-connect` (d) `__byo_blob__` sentinel (Resolved — additive migration design). Also upgraded `quality-eval` corrected-set OQ with the P2 license finding (no count change; already parked). **Method pinned** (stops the 75↔85 drift): `- ` bullets under `## Open questions` whose text does **not** match, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed` (case-insensitive is load-bearing — a case-sensitive grep over-counts). Lever: research (P2/GLOBAL-033) → document (P4) → mark resolved |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting** (07-05 run-9 sweep: 99 pages, 2,321 internal links — post-claim-fix build incl. `/blog/http-200-error-in-body`) | target 0 — sweep is repeatable: `bun run --filter @nlqdb/web build && bun run --filter @nlqdb/web check:links` (checks hrefs + sitemap + llms.txt against dist; exits 1 on dead) |
| | **Product-readiness** — client-blocking gaps the loop was blind to (added 07-04) | | non-deferral gaps that no prior row measured, so rule 2 ("no change without a number") could never select them; now agent-movable |
| 19 | Live-surface claim integrity | **0 tracked gaps** (07-05, was 4) | claim-vs-reality on shipped user-facing surfaces; target 0. Run-9 fixes, all "soften to what shipped": (a)+(b) `/pricing` backup bullets deleted + "Export anytime" → "pull it out with plain SQL" (`architecture.md` tier table matched); (c) `progress.md §0` + the `CodePanel` surface matrix (component currently unmounted from the home2 homepage — kept honest anyway): wrappers + Swift → **Built** (npm/SPM publish gated per `.changeset/README.md`); same-family: `frameworks.mdx` caution + unpublished note in 4 `examples/*` READMEs whose `npm install @nlqdb/*` 404s; (d) `docs.nlqdb.com/mcp` rewritten to the 3 real paths (`https://mcp.nlqdb.com/mcp`, nlqdb.com buttons, env var) — fabricated `nlq mcp install` walkthrough + nonexistent `app.nlqdb.com/mcp` deep-link path removed, `nlq mcp detect` documented as-is. Review pass swept the same families further: `/agents` "one command" card `nlq mcp install` → `claude mcp add`; `examples/cli` fake verbs (`nlq export`/`connection`/`--csv`/`--region`) → real `run --json` forms + a `nlq login` not-shipped note; bare `mcp.nlqdb.com` paste-URLs → `/mcp` (docs index, `/integrations`, 3 solve pages); unpublished `@nlqdb/mcp` no longer sold as an npm binary (solve, `progress.md`, `mcp.mdx`). Next count re-audits fresh (e.g. paid-tier limit claims while billing is dark); sweep candidate stands: extend `check:links` to assert each advertised capability has shipped code |
| 20 | Hosted-premium readiness (§6 build-before-signal) | **schema ✅ · BYOLLM lanes ✅ · picker: web ✅ (`SK-PREMIUM-013`, #610: ModelPicker + `GET /v1/models` + SDK `getModels()`) · picker parity ⬜ (preset param on `/v1/ask`, SDK `model` option, CLI/elements/MCP) · premium chain ⬜ · CTA (`SK-PREMIUM-004`) ⬜ · spend-cap UI ⬜** | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is **built before** the signal (lighting it is a flag flip); only the *meter firing* (Lago→Stripe) + cost-incurring infra stay dark. The meter staying off is not a reason to leave the slot unbuilt; drive ⬜→✅ each run (first slice #610 landed 07-04) |
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

**2026-07-05 (run 9)** — lever: **live-surface claim integrity `4 → 0`**
(row #19, first fix pass after the row landed in #614). All four tracked gaps
closed by softening the claim to what shipped, never the reverse: `/pricing`
stopped selling backups that don't exist and now promises SQL read-out instead
of a nonexistent export endpoint (`architecture.md` tier table matched so the
claim can't regenerate); `progress.md §0` + the `CodePanel` surface matrix
(unmounted from the home2 homepage today, corrected against remount) moved
the 8 framework wrappers + Swift from **Shipped** to a new honest **Built**
status (npm/SPM publish gated per `.changeset/README.md`), with the same
unpublished-note added to `frameworks.mdx` and the 4 `examples/*` READMEs whose
`npm install @nlqdb/*` currently 404s; `docs.nlqdb.com/mcp` lost its fabricated
`nlq mcp install` walkthrough and nonexistent `app.nlqdb.com/mcp` deep-link
path — rewritten to the three real install paths, with the stub honestly
labelled ("`nlq mcp detect` works; `install` ships with device-flow login",
matching `cli/FEATURE.md`). **Engine (weekly focus) was not the lever:** the
canonical BIRD dispatch is decision-blocked until the baseline turns 7 days old
(`SK-QUAL-002`; window opens **07-10**) and the offline lever is exhausted, so
the eval-free capacity went to re-dispatching `e2e-opencheck` (row #15's zero).
Fresh 07-05 pulls landed the **first first-10 datapoint (1/1, N=1 — row #4)**.
Step-3 artifact: queue publish owned by concurrent PR #612 (run 7, since
merged; step-0 non-overlap); this run's released artifacts are the corrected
live surfaces themselves. Same-day runs 7 (#612, `/blog/http-200-error-in-body`,
surfaces 79) and 8 (#613, docs-ambiguity 26 → 25 via the `agentMemoryMatrix`
future-date guard) merged before this one; their rows above carry their data.
**KPI:** GLOBAL-025 onboarding — a stranger following any advertised path no
longer hits a fabricated claim; none degraded (copy/docs-only diff, no runtime
code path touched).
