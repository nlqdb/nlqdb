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
engine lever unparks. Row #15 state (07-14 run 70): **now firmly dark
(rule 8) — the founder-only 3rd free-LLM pool is the confirmed durable
blocker, not contention timing.** Run 70 tested the last agent-movable
hypothesis — "does opencheck pass in a genuinely clean free-lane window?" —
by re-dispatching `abc` on main `2b9f8a7` ~3 h after run 69's memory eval
freed the lanes (07:24Z): run
[29324716801](https://github.com/nlqdb/nlqdb/actions/runs/29324716801) still
**failed all three suites**, Suite A's anon 2nd `/v1/ask` hitting the
240 000 ms timeout (the documented agent-lane-capacity flake — recordings
`#hero-or-cmdg`/`#create-table-anon`/`#mock-sign-in` passed, **no product
regression**: no `schema_mismatch`/`42P01`). That **falsifies "just needs a
clean window"** — the two $0 pools (NIM + OpenRouter `:free`) flap on a
minute timescale intrinsically, so #15 stays **0.75** until the founder-only
independent 3rd free pool lands (top `blocked-by-human.md` bullet). /weekly
should re-point the focus off #15 while that secret is unset.

**Worst number today:** real strangers reaching a first answer = **0**
(row #2; funnel open since run 56, lagging — moved only through its
agent-controllable inputs; the top UX-flow input, row #21, is maxed 9/9).
**Run 74 pulled a claim-integrity lever (row #19 class), not a null run.**
Step 0: three open PRs — #694 (founder model-picker sub-label), #695 (run 73:
red `deploy-cli` goreleaser fix), #696 (founder pricing-page telemetry);
run 74 touched none of their files (scorecard regen is step-0-exempt).
**Rule 6:** `deploy-cli.yml` was red on `main` (`b77f338`, goreleaser v2
homebrew-token form) — fixed by the now-merged #695, so it is not
duplicated here; every other `deploy-*` and `ci.yml` are green on `main`.
The local pre-`bun install` typecheck red is the run-71 env artifact (TS-7.0
`baseUrl` deprecation); after `bun install` (TS 5.9.3 pinned) typecheck is
green — main is green. **Lever:** run 72 found the `nlq schema` phantom by
hand and deferred "automate this CLI/SDK-verb sweep as a guard"; run 74
built it. New `apps/web/src/data/cli-verb-integrity.test.ts` (sibling of the
run-64 `mcp-tool-integrity` guard) derives the shipped top-level verbs from
the cobra tree (`cli/internal/cmd/*.go`, first `Use:` per file minus the
`nlq` root — 15 verbs) and sweeps every `nlq <verb>` snippet under
`apps/web/src` closed-world; an unshipped verb fails, naming the token +
file. Verified: passes clean (0 offenders, 27 snippet occurrences guarded)
and **fails on the re-injected run-72 `nlq schema` phantom**. Before → after:
the run-72 phantom class now **fails CI instead of shipping** (guarded
web CLI-verb snippets 0 → all).

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (fresh 07-13 02:58Z pull — CF GraphQL + remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 232 pageloads (07-06→07-13 02:58Z, raw). Walker filter (run 12, `userAgentBrowser` cut): "Unknown" 183 ⇒ **real-browser ≈ 49 pageloads** (Chrome 41, ChromeMobile 3, MobileSafari 2, Firefox 2, Edge 1) | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (re-verified 07-13 02:52Z). The 428 wall is gone (run 56, live since 13:03Z); acquisition now depends on distribution yield |
| 3 | DBs total | **223** (07-13 02:52Z; +58 vs 07-12, synthetic — walker/preview traffic; previews share prod D1) | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not yet measurable** (07-12 19:41Z remote-D1; method `SK-ONBOARD-007`). Only 3/165 DBs have `first10_asks > 0` (Σok 3 / Σasks 4), all founder/test | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12 19:41Z; founder-owned) | share of DBs with `first10_asks ≥ 2` |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **98** (`/vs` 31 + `/solve` 33 + `/blog` 34). Queue holds **2** unpublished drafts (`guard-advertised-capabilities-against-code`, `smoke-test-walks-the-old-ui`) — **< 3, so step 3.1 forced-publish does not trigger** (row #6's prior "2 → 3 ⇒ publish" count was stale; the queue file has 2). Run 74's lesson is already the queued `guard-advertised-capabilities` draft (its honest-split names "CLI subcommands"), so no new draft either | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **34**; 7d external referrals = 9 (bing 8, github 1 — carried 07-12 19:39Z pull; was 6 on 07-09, 1 on 07-06). Syndication feeds 1 (`/rss.xml`); internal links **2,908** + **14 cross-app** (run-61 build: 118 pages, 0 dead — row #18) | CF `refererHost` — carried from 19:39Z (strangers unchanged). External-referral yield holding (bing-led) as indexation lands |
| | **Engine** — BIRD 07-11 · Spider 07-11 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.546** (272/498 EA, 2 `gold_error`, 07-11 canonical on main `2cfda39`, [run 29144102081](https://github.com/nlqdb/nlqdb/actions/runs/29144102081) — completed in ONE window, `no_sql` 0/500). Δ +2.01 pp vs 07-05, McNemar b=31/c=41, `regressions: []`. Baseline re-seeded. Measured pre-`SK-LLM-044`; next canonical re-verifies | target 0.65 / **Phase 2 floor 0.60** — gap 5.4 pp. Offline levers exhausted; SC dead (#619); frontier-lens closed (run 15) |
| 9 | Spider raw EX | **0.2963** (40/135, `no_sql` 0/135, exec_error 3, gold_error 0 — 07-11 canonical on `6e1725c` with `SK-LLM-044`, nine-window `SK-QUAL-013` resume [29160009809](https://github.com/nlqdb/nlqdb/actions/runs/29160009809) → [29164092490](https://github.com/nlqdb/nlqdb/actions/runs/29164092490)). Was 0.2741 | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is its source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004) — flat vs 07-02) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06 run 15, `SK-QUAL-022`). persona-bench −4.35 pts (07-09, one-question noise at N=23) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69–0.70 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers analytics (fresh 07-13 02:58Z pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 4,974 / 0 (0.00%) | mcp-server 473 req / 0 err; events-worker 31 req; canary 4 req / 0 err this window (secret-drift re-provisioning still tracked in `blocked-by-human.md`). **Deploy health (07-14 run 73):** all deploy-* + `ci.yml` green on `main` **except `deploy-cli.yml`** (was red on `b77f338`, goreleaser token-format bug) — **fixed this run**; every other workflow green |
| 13 | nlqdb-api wall-time p50 / p95 | p50 ≈ 0.61 s / p95 ≈ 1.70 s | mcp-server p95 ≈ 755 ms this window; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **≈ 0.75** (sdk/mcp/examples ≈1.0 each; **opencheck's latest main run [29324716801](https://github.com/nlqdb/nlqdb/actions/runs/29324716801) (run 70) FAILED**, pass=0 zeroes it ⇒ mean 0.75). **Run 70 falsified the "clean window" hypothesis:** re-dispatched `abc` on `2b9f8a7` ~3 h after the last free-lane consumer (run 69 memory eval, 07:24Z) — all 3 suites still red, Suite A's anon 2nd `/v1/ask` 240 s-timed-out, **no product regression** (bootstrap recordings passed, no `schema_mismatch`). The free pools (NIM + OpenRouter `:free`) flap intrinsically on a minute timescale ⇒ contention timing was never the cause. **Now dark (rule 8):** only the founder-only independent 3rd free pool (top `blocked-by-human.md` bullet) lifts it | Sequencing rule (unchanged): never dispatch opencheck alongside another consumer of its lanes. Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.546, 07-11); agentic-frontier ≥ 0.80 (0.693, Δ 18.66 ✓); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (stranger N=0); destructive-op retry < baseline (instrumented run 38, N≈0); MCP in 3+ host apps (07-11: 0 stranger hosts, 1 founder host — FAIL); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 removed the 428 wall |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **17** (fresh grep 07-14 run 72 — held) | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. De-prioritised as a default lever per the 07-11 /weekly (monoculture, no external yield) |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** (07-13 run-61 sweep: **118** pages, **2,908** internal + **14 cross-app** links). Run 61 **added cross-app coverage** — `href`/`src` to owned subdomains (`docs./app./mcp.nlqdb.com`) were dropped by `isInternal` and never checked; the sweep now live-verifies them (4xx/5xx = dead & hard-fail; auth/method gate = alive; network error = "unverified", never red). 14 `docs.nlqdb.com` funnel links now covered (0 → 14). **Run 72 prod-verified this live:** all 110 `sitemap.xml` URLs return 200 against deployed `nlqdb.com` (built-output sweep confirmed in production) | target 0 — `bun run build && bun run check:links` in `apps/web` |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **1 open (agent-fixed, pending post-merge tap-verify)** — `brew install nlqdb/tap/nlq` advertised (`cli/README.md`, npm-shim fallback, SK-CLI-002) but the tap empty since 2026-05-19. **Run 73 (#695) corrected the diagnosis:** this was *not* a missing-PAT block (no such `blocked-by-human.md` bullet exists; CI env shows `HOMEBREW_TAP_GITHUB_TOKEN` set, `skip_upload`→false) — it was the `cli/.goreleaser.yml` token-format bug that aborted every tap push (fixed in run 73). On merge, `deploy-cli` runs `goreleaser release` with valid config against the present PAT → the tap should populate (claim becomes real; re-verify the tap repo after merge). Runs 32 + 37 + 56 + 59 + 62 + 64 + 72 + 73 + **74** each found + closed 1 agent-movable gap | claim-vs-reality on shipped surfaces + docs; target 0. **Standing guards:** `mcp-tool-integrity.test.ts` (run 64) reads the shipped MCP catalog from the server's `registerTool(...)` sites and sweeps every `apps/web/src` surface closed-world, failing on any phantom + file; **run 74 added its CLI sibling** `cli-verb-integrity.test.ts`, which derives the 15 shipped top-level verbs from the cobra tree (first `Use:` per `cli/internal/cmd/*.go` minus `nlq`) and sweeps every `nlq <verb>` snippet under `apps/web/src` closed-world (verified fails on the re-injected `nlq schema` phantom). Next candidate: extend the guard to `apps/docs` prose + the SDK method surface; post-merge, confirm the Homebrew tap actually populates from the run-73 goreleaser fix |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) · picker parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal; only genuine remaining slot is the premium chain |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **9/9 + both FLOW-005 transports** ✅ (run-60 branch dispatch [29211619838](https://github.com/nlqdb/nlqdb/actions/runs/29211619838) against prod: FLOW-001 3/3 · FLOW-002 3/3 · FLOW-003 3/3 · FLOW-005 walk + stdio both `passed`). FLOW-001's step-8 red was the walker asserting a 2nd anon `/v1/ask` 200 — impossible under `SK-ANON-012`'s message-#2 wall; step 8 now asserts the 401 cap (dt 296–337 ms). Before: main dispatch [29211269726](https://github.com/nlqdb/nlqdb/actions/runs/29211269726) FLOW-001 0/3 step-8 `status=401`. The run-59 "morph-to-chat gap" is **decided, not a gap**: the anon terminus IS the sign-in redirect (SK-ANON-011 stash → SK-ANON-003 adopt); the SK-WEB-002 chat is the post-sign-in /app surface. **Run 62 closed the step-7 false-green:** the copy-snippet conversion action was silently skipping (selector matched the accessible name, which the `aria-label` diverged from) — now the aria-label is dropped (accessible name = visible "Copy snippet", WCAG 2.5.3) and the selector widened; branch dispatch [29231826660](https://github.com/nlqdb/nlqdb/actions/runs/29231826660) walked prod **9/9 passed (exit 0)** with the new selector | target 9/9 + both FLOW-005 ✅ **met**. Per-step JSON artifact isn't downloadable from the agent container (proxy-gated); the selector→accessible-name defect is closed deterministically |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/20 + 12 memory `/vs` pages | tick on merge; mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — the only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; E-03…E-07 all Neon/infra-gated |
| | Memory-quality eval (`SK-QUAL-023`) | **free-chain EX 93.33% (14/15)** — run 69 re-measure, branch `4679180`, [GHA 29314389843](https://github.com/nlqdb/nlqdb/actions/runs/29314389843); p50 1168 ms / p95 7036 ms, `no_sql` 0. Per-axis: retrieval/forgetting/analytical/**consolidation 3/3**, **temporal 2/3** (sole weak axis). Run 68 read 86.67% (13/15) w/ consolidation 2/3 — the extra miss was N=15 free-chain noise. **Now diagnosable:** run-69 mismatch table (in the run log via `tee`) pins the sole failure — **Q3 temporal, `f.predicate='current_city'`** (hallucinated predicate + missing recency `ORDER BY … LIMIT 1`) | 15 gold-verified questions, 4 axes + analytical; free chain **is** reachable in CI (only the daily container is egress-gated); free-only (frontier lane opt-in); no baseline emitted (measurement, not canonical — SK-QUAL-023). Analytical-vs-vector head-to-head still E-05 infra-gated |

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

**2026-07-14 (run 74)** — **claim-integrity guard** (row #19 class; not a null
run). Step 0: three open PRs — #694 (founder model-picker sub-label), #695
(run 73: red `deploy-cli` goreleaser fix), #696 (founder pricing telemetry);
run 74 touched none of their files. **Rule 6:** `deploy-cli.yml` was red on
`main` (`b77f338`, goreleaser v2 homebrew-token form), fixed by the now-merged
#695 — not duplicated; every other `deploy-*` + `ci.yml` green on `main`.
Local pre-`bun install` typecheck red = the run-71 env artifact (TS-7.0
`baseUrl`); after `bun install` (TS 5.9.3 pinned) typecheck is green —
main green. **Lever:** run 72 found the `nlq schema` phantom by hand and
deferred "automate this CLI/SDK-verb sweep as a guard"; run 74 built it. New
`apps/web/src/data/cli-verb-integrity.test.ts` (sibling of the run-64
`mcp-tool-integrity` guard): derives the 15 shipped top-level verbs from the
cobra tree (first `Use:` per `cli/internal/cmd/*.go` minus the `nlq` root — no
hand-copied list to go stale) and sweeps every `nlq <verb>` snippet under
`apps/web/src` closed-world; an unshipped verb fails, naming the token + file.
**Before → after:** the run-72 phantom class goes from *hand-caught, could
recur silently* → *fails CI* (guarded web CLI-verb snippets **0 → all**, 27
occurrences / 3 distinct verbs). **Measure→change→re-measure:** guard passes
clean (0 offenders); re-injecting `nlq schema` fails it, naming
`__phantom.ts`; removing it passes again. Gates green: typecheck 0, lint 0
(38 pre-existing warnings), **api 917 + web 254 tests pass**. No FEATURE.md
block added — matches the run-64 MCP-guard precedent (self-documenting code
enforcing `SK-WEB-008`/`SK-CLI-002`; D5/P5). **Step 1:** funnel carried from
the 07-13 pulls (remote D1 / CF GraphQL + LLM egress unreachable here) —
strangers **0**; docs-ambiguity **17** (held); row #18 **0 dead**. Row #6
corrected: queue is **2** drafts (< 3), prior "≥ 3 ⇒ publish" count was stale.
**Artifact (step 3):** queue 2 (< 3) → no forced publish; this run's lesson is
already the queued `guard-advertised-capabilities-against-code` draft (its
honest-split names "CLI subcommands"), so no new draft. **KPI (GLOBAL-025):**
advances **onboarding/UX** (no dead-end CLI snippet can silently ship again);
**none degrade** — a test-only diff, zero runtime/prompt/eval-baseline change;
rows #8–#11 + #21 carried.

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
