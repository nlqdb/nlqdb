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
engine lever unparks. Row #15 state (07-14 run 68): the run-65 plan-cache fix
(#684) merged; **open PR #686 (run 67) now owns row #15** — its re-dispatch
[29298056709](https://github.com/nlqdb/nlqdb/actions/runs/29298056709) confirmed
the fix holds (zero `schema_mismatch`) but the overall run failed on a standing
**agent-lane-capacity flake** (no healthy free model on NIM *or* OpenRouter),
so #15 stays 0.75 — now **dark for a single run** until the founder-only 3rd
free-LLM secret lands (top `blocked-by-human.md` bullet). Run 68 avoided that
lever + PR #686's files per step 0. With #15 owned + infra-blocked and row #21
maxed 9/9, run 68 pulled the pre-named **engine-lane / pivot** lever: **land
the first memory-quality EX** (`SK-QUAL-023`, the GLOBAL-036 wedge) — see
*Worst number* and *Last change*.

**Worst number today:** real strangers reaching a first answer = **0**
(row #2; funnel open since run 56, lagging — moved only through its
agent-controllable inputs; the top UX-flow input, row #21, is maxed 9/9).
With row #21 maxed, row #15 owned by open PR #686 *and* infra-blocked, and no
open live-UX bug (the run-65 plan-cache 42P01 fix + run-65's #683 model-picker
CORS both merged), run 68's agent-movable lever was the pre-named **engine
lane on the active pivot**: the run-66 `SK-QUAL-023` workflow was now on
`main`, so its first EX was measurable via `workflow_dispatch`. **Run 68
finding + lever:** dispatched `quality-eval-memory.yml` on main `a5e72e6`
([29305503755](https://github.com/nlqdb/nlqdb/actions/runs/29305503755)), free
chain — **first-ever memory-quality EX = 86.67% (13/15)**, p50 949 ms,
`no_sql` 0, a real measurement (`transport_failed:null`); this also
**overturns run 66's read** that the free chain is CI-unreachable (it ran
clean in Actions; only the daily container is egress-gated). Per-axis:
retrieval/forgetting/analytical 3/3, **temporal 2/3 · consolidation 2/3**.
Memory-quality EX **unmeasured → 86.67%** (GLOBAL-036 wedge headline now
exists). Not anti-rut-blocked (last 5 merged = plan-cache, memory-dispatch,
KV-diag, systemic-guard, phantom-fix — this is a *measurement* on the pivot,
a distinct move). Next agent-movable lever: an engine run targeting the two
weakest memory axes (temporal + consolidation), then distribution yield
(rows #6/#7) or row #9 Spider.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (fresh 07-13 02:58Z pull — CF GraphQL + remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 232 pageloads (07-06→07-13 02:58Z, raw). Walker filter (run 12, `userAgentBrowser` cut): "Unknown" 183 ⇒ **real-browser ≈ 49 pageloads** (Chrome 41, ChromeMobile 3, MobileSafari 2, Firefox 2, Edge 1) | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (re-verified 07-13 02:52Z). The 428 wall is gone (run 56, live since 13:03Z); acquisition now depends on distribution yield |
| 3 | DBs total | **223** (07-13 02:52Z; +58 vs 07-12, synthetic — walker/preview traffic; previews share prod D1) | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not yet measurable** (07-12 19:41Z remote-D1; method `SK-ONBOARD-007`). Only 3/165 DBs have `first10_asks > 0` (Σok 3 / Σasks 4), all founder/test | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12 19:41Z; founder-owned) | share of DBs with `first10_asks ≥ 2` |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **98** (`/vs` 31 + `/solve` 33 + `/blog` 34). Run 60 published the oldest queued draft (`green-checkmark-has-a-half-life`, step 3); pending drafts **2 → 3** (run 64 added `guard-advertised-capabilities-against-code`; queue now ≥ 3 ⇒ next non-null run publishes) | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
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
| 15 | E2E manual-suite freshness | **≈ 0.75** (sdk/mcp/examples ≈1.0 each; **opencheck's latest main run [29298056709](https://github.com/nlqdb/nlqdb/actions/runs/29298056709) FAILED**, pass=0 zeroes it ⇒ mean 0.75). **Run-67 re-dispatch measured the SK-ASK-025 fix holding** — zero `schema_mismatch` recurrence, Suite C green — but Suite A 240 s-timed-out (mid-run NIM flap) + Suite B aborted at pre-flight (both free agent pools saturated): the standing **agent-lane-capacity** flake, not the product. → 1.0 needs a clean A+B+C in a fresh free-pool window (or the 3rd-lane secret, `blocked-by-human.md`) | Sequencing rule (unchanged): never dispatch opencheck alongside another consumer of its lanes. Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.546, 07-11); agentic-frontier ≥ 0.80 (0.693, Δ 18.66 ✓); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (stranger N=0); destructive-op retry < baseline (instrumented run 38, N≈0); MCP in 3+ host apps (07-11: 0 stranger hosts, 1 founder host — FAIL); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 removed the 428 wall |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **17** (fresh grep 07-14 run 67 — held) | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. De-prioritised as a default lever per the 07-11 /weekly (monoculture, no external yield) |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** (07-13 run-61 sweep: **118** pages, **2,908** internal + **14 cross-app** links). Run 61 **added cross-app coverage** — `href`/`src` to owned subdomains (`docs./app./mcp.nlqdb.com`) were dropped by `isInternal` and never checked; the sweep now live-verifies them (4xx/5xx = dead & hard-fail; auth/method gate = alive; network error = "unverified", never red). 14 `docs.nlqdb.com` funnel links now covered (0 → 14) | target 0 — `bun run build && bun run check:links` in `apps/web` |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **1 open (founder-blocked)** — `brew install nlqdb/tap/nlq` advertised (`cli/README.md`, npm-shim fallback, SK-CLI-002) but the tap empty since 2026-05-19; blocked on the `HOMEBREW_TAP_GITHUB_TOKEN` PAT (top `blocked-by-human.md` bullet); releases no longer fail on it (run-54 fix, #669). Runs 32 + 37 + 56 + 59 + 62 + **64** each found + closed 1 agent-movable gap | claim-vs-reality on shipped surfaces + docs; target 0. **Run 64 built the standing candidate** (assert each advertised capability has shipped code): run 62 fixed `nlqdb_recall` by hand but the recurrence guard (`competitors.test.ts` SK-MCP-002) scanned 1 of ~6 surfaces (the two the phantom shipped to were unguarded) + pinned a stale hand-copied tool set (missing `nlqdb_connect_database`). Replaced by `mcp-tool-integrity.test.ts`: reads the shipped catalog from the MCP server's `registerTool(...)` sites, sweeps every `apps/web/src` surface closed-world, fails naming any phantom + file. Verified: passes clean (0 offenders), fails on the injected run-62 phantom. Next candidate: extend the sweep to the CLI/SDK advertised-verb surfaces |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) · picker parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal; only genuine remaining slot is the premium chain |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **9/9 + both FLOW-005 transports** ✅ (run-60 branch dispatch [29211619838](https://github.com/nlqdb/nlqdb/actions/runs/29211619838) against prod: FLOW-001 3/3 · FLOW-002 3/3 · FLOW-003 3/3 · FLOW-005 walk + stdio both `passed`). FLOW-001's step-8 red was the walker asserting a 2nd anon `/v1/ask` 200 — impossible under `SK-ANON-012`'s message-#2 wall; step 8 now asserts the 401 cap (dt 296–337 ms). Before: main dispatch [29211269726](https://github.com/nlqdb/nlqdb/actions/runs/29211269726) FLOW-001 0/3 step-8 `status=401`. The run-59 "morph-to-chat gap" is **decided, not a gap**: the anon terminus IS the sign-in redirect (SK-ANON-011 stash → SK-ANON-003 adopt); the SK-WEB-002 chat is the post-sign-in /app surface. **Run 62 closed the step-7 false-green:** the copy-snippet conversion action was silently skipping (selector matched the accessible name, which the `aria-label` diverged from) — now the aria-label is dropped (accessible name = visible "Copy snippet", WCAG 2.5.3) and the selector widened; branch dispatch [29231826660](https://github.com/nlqdb/nlqdb/actions/runs/29231826660) walked prod **9/9 passed (exit 0)** with the new selector | target 9/9 + both FLOW-005 ✅ **met**. Per-step JSON artifact isn't downloadable from the agent container (proxy-gated); the selector→accessible-name defect is closed deterministically |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/20 + 12 memory `/vs` pages | tick on merge; mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — the only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; E-03…E-07 all Neon/infra-gated |
| | Memory-quality eval (`SK-QUAL-023`) | **free-chain EX 86.67% (13/15)** — first canonical dispatch, run 68, main `a5e72e6`, [GHA 29305503755](https://github.com/nlqdb/nlqdb/actions/runs/29305503755); p50 949 ms / p95 1999 ms, `no_sql` 0, real measurement (`transport_failed:null`). Per-axis: retrieval/forgetting/analytical 3/3, **temporal 2/3 · consolidation 2/3** (weakest → next-run lever) | 15 gold-verified questions, 4 axes + analytical; free chain **is** reachable in CI (only the daily container is egress-gated); free-only (frontier lane opt-in); no baseline emitted (measurement, not canonical — SK-QUAL-023). Analytical-vs-vector head-to-head still E-05 infra-gated |

## Shipped distribution (live URLs)

Canonical copies on `/blog` (`SK-BLOG-001`); venue variants stay in
`research/distribution-queue.md` as pointers:

- https://nlqdb.com/blog/green-checkmark-has-a-half-life/ (run 60 — CI/measurement lesson, the row #15 freshness method: when an expensive suite can't run on every push, "passing" is an event not a state — score `pass × freshness` with a linear decay so the number rots until someone re-runs it)
- https://nlqdb.com/blog/ephemeral-staging-persistent-registry/ (run 56 — CI/test-infra lesson, the SK-E2E-007 spin-up purge: an environment is only as ephemeral as the most persistent store that references it)
- https://nlqdb.com/blog/ownership-transfer-outlives-least-privilege/ (run 54 — Postgres multi-tenancy lesson, the SK-ANON-003 adoption ACL gap: an ownership transfer must retarget every authorization store; a catch-all must log the code it swallows)
- https://nlqdb.com/blog/most-active-user-is-your-test-suite/ (run 53 — measurement-hygiene lesson, the funnel bot-filter: a metric that doesn't name its population is measuring your robots; filter at read time)
- https://nlqdb.com/blog/five-fallback-models-one-provider/ (run 51 — CI/engine lesson, the opencheck lane swap: redundancy must cross the failure-domain boundary; the lane, not the model, is the fallback unit)
- …and 25 earlier posts — full live-URL list in `research/distribution-queue.md` § Published (canonical `/blog` copies).

## Last change

**2026-07-14 (run 68)** — lever: **land the first-ever agent-memory-quality
EX (engine lane / GLOBAL-036 agent-memory pivot).** Step 0: one open PR —
#686 (run 67), a docs-only null run owning row #15's opencheck re-dispatch
finding + `opencheck-operations.md` + `blocked-by-human.md`. Run 68 avoided
that lever + those files (scorecard regen is step-0-exempt). Rule-6 health
clean — deploy-api/web/docs all ✅ on main (HEAD `a5e72e6`); `bun run
typecheck` exit 0 after `bun install`, `bun run lint` exit 0 (38 pre-existing
warnings), `bun run test` 916 pass / 6 skip. **Why this lever:** row #21
maxed 9/9; weekly-focus row #15 owned by open PR #686 and now infra-blocked
(agent-lane capacity flake needing a founder-only 3rd free-LLM secret —
dark for a single run); the run-66 scorecard pre-named "the memory EX
dispatch itself" as the next agent-movable lever, and the run-66 workflow is
now on `main`. **The change (measurement run):** dispatched
`quality-eval-memory.yml` on main `a5e72e6` ([GHA 29305503755](https://github.com/nlqdb/nlqdb/actions/runs/29305503755)),
free chain, and recorded the result. **Measured:** memory-quality EX
**unmeasured → 86.67% (13/15)**, p50 949 ms / p95 1999 ms, `no_sql` 0,
`transport_failed:null` / `resumable:null` — a real measurement (SK-QUAL-020),
which also **falsifies the run-66 read that the free chain is CI-unreachable**
(it ran clean in Actions; only the daily container is egress-gated). Per-axis
(free): retrieval/forgetting/analytical 3/3, **temporal 2/3 · consolidation
2/3** — the two weakest axes are the named lever for a future engine run. No
baseline emitted (a measurement, never canonical — SK-QUAL-023). Δ > 0 (the
pivot's headline quality number now exists) — keep. **Artifact (step 3):**
null step — queue is 2 unpublished drafts (< 3), so no auto-publish; no new
draft (P5 — this run's lesson is eval-measurement, thin for a stranger-facing
post). **Step 1:** funnel carried from the run-62/66 02:52–02:58Z pulls
(remote D1 / CF GraphQL + LLM egress all unreachable from this container,
re-confirmed) — strangers **0**; docs-ambiguity 17 (held; SK-QUAL-023 edit
isn't an open-question bullet); row #18 0 dead (no page/link touched); row
#15 ≈0.75 (opencheck red, PR #686 owns). **KPI:** GLOBAL-025 engine-quality
(pillar #1) on the GLOBAL-036 wedge — **none degrade** (docs-only diff; zero
runtime/prompt/eval-baseline change; BIRD/Spider/persona rows #8–#11 + #15 +
walker #21 all carried; no new consumer of opencheck's lanes).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
