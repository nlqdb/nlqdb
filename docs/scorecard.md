# Scorecard — current state

Point-in-time tracker, regenerated each
[`/daily`](../.claude/commands/daily.md) run. Current state only — no changelog
(≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md` (engine).

**Weekly focus number (2026-07-19 → 07-25, founder-set):**
**Acquisition — channels live with attributable yield: 2 → ≥ 5 (row #22).**
Founder directive 2026-07-19 ([`GLOBAL-038`](decisions/GLOBAL-038-gtm-pmf-instrumentation.md)):
the operating focus is **user acquisition**, measured continuously — product
progress is secondary this cycle. The agent-movable inputs, in order: reach
R-05 registry listings (0/8 → list or park each), R-04 machine-followable
setup guide (registries' prerequisite), utm-tagging the already-live channels
(dev.to, npm/GitHub READMEs) per `SK-GTM-007`, and R-06 (the track's
falsifier). Channel truth lives in
[`research/acquisition-channels.md`](research/acquisition-channels.md); yield
truth on `/app/admin` (first-touch attribution shipped 07-19 — the first
stranger cohort will be attributable from day one). This supersedes the
morning's agentic-frontier focus: premium-chain work (`SK-LLM-017`, row #20)
is pullable only when no acquisition lever is. **Row #15 stays
founder-blocked** — its only fix is arming `FALLBACK2_LLM_API_KEY`
(SambaNova, `_e2e-opencheck.yml`), the top `blocked-by-human.md` bullet.

**Worst number today:** **row #16 Phase-2 exit gate 1/9**; worst engine number is
**row #9 Spider 0.2222** and **row #8 BIRD 0.542** is resolved (run 91) + fresh
(07-19) with offline levers exhausted — both dark for a single run. The weekly-focus
number (agentic-frontier EX → 0.80 via the `SK-LLM-017` premium chain) stays
not-agent-movable this run (founder-blocked paid frontier credentials, §6-dark meter,
frontier-key + dispatch-gated smoke, `premiumEligible` never true ⇒ dead lane — same
finding as run 97). Per **step 0** every GTM/admin/chat/attribution/docs lane is held
by an open PR, so **run 98 pulled a priority-1 UX-flow lever a defect-hunt surfaced in
a free lane (not another a11y fix — continues run 97's break from the row-#4 a11y run):
`getOrMintAnonToken` was the one localStorage slot that touched `window.localStorage`
bare** while its three SK-ANON-011 companion slots all degrade through `safeStorage`.
A stranger with cookies/DOM-storage blocked (Chrome "block all cookies", Firefox DOM
storage off, sandboxed iframes) hit a **hard throw on the create path** — the bearer
every `/v1/ask` reads — surfaced as a misleading "Couldn't reach the API." Fixed to
fall back to an in-memory token (the graceful-degradation contract SK-ANON-011 already
mandates), guarded by a pure `bun:test` (rows #4/#5). **Step 0 collision map:** open PRs
#748 (PMF survey + launch kit — chat/`ChatPanel`/`PmfSurveyCard`, `index.ts`, admin,
migrations, docs), #747 (reach R-04 docs — `agent-memory.mdx`, README, `llms.txt`,
`/agents`), #746 (run 97 — `chat/Data.tsx`), #745 (attribution — `Base.astro`,
`lib/{api,attribution,admin}.ts`, `index.ts`, `.claude/commands`, admin), #744 (GTM
uniques — `db-create/**`, `db-connect`, `synthetic-ua`, `index.ts`, admin, onboarding
docs), #719 (Infisical draft). This run touched only `apps/web/src/lib/anon.ts` +
`apps/web/src/lib/anon.test.ts` + `docs/scorecard.md` — **no overlap** (scorecard
regen is overlap-exempt). **Rule 6:** CI + Security green on `main` head `c8138d5`;
deploy-api/web/canary green on `c8138d5`, deploy-docs/mcp on `04fa3d0` (recent merges
didn't touch docs/mcp paths ⇒ no new deploy); no red-main / stale-deploy lever.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (visits 07-13 02:58Z CF GraphQL; users/DBs 07-16 remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 232 pageloads (07-06→07-13 02:58Z, raw). Walker filter (run 12, `userAgentBrowser` cut): "Unknown" 183 ⇒ **real-browser ≈ 49 pageloads** (Chrome 41, ChromeMobile 3, MobileSafari 2, Firefox 2, Edge 1) | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company (`omer@salfati.group`, `omer.hochman@{gmail,bigpanda}`, `hi@nlqdb.com`) + 5 test/dev (`*@example.com`, `*@preview.dev`) — **re-verified 07-16 remote-D1, newest registration 07-06, none since**. The 428 wall is gone (run 56); acquisition now depends on distribution yield (owned by PR #711) |
| 3 | DBs total | **251** (07-16 remote-D1; +28 vs 07-13's 223, synthetic — walker/preview traffic; previews share prod D1) | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not yet measurable** (07-12 19:41Z remote-D1; method `SK-ONBOARD-007`). Only 3/165 DBs have `first10_asks > 0` (Σok 3 / Σasks 4), all founder/test | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel. The stranger create→ask→first-answer path is hardened each run (vague-goal recovery, aborted-reply settle, create-result + magic-link a11y); **run 98** stopped `getOrMintAnonToken` hard-throwing when localStorage is blocked (privacy modes) — the one anon slot bypassing the SK-ANON-011 `safeStorage` in-memory fallback, so a cookie-blocked stranger's create died on a misleading "Couldn't reach the API"; now degrades to an in-memory token (rows #4/#5). Per-run detail in `git log` |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12 19:41Z; founder-owned) | share of DBs with `first10_asks ≥ 2` |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **105** (`/vs` 32 + `/solve` 36 + `/blog` **37**; fresh recount 07-19 — `/solve` +3 & `/vs` +1 from merged reach solve/vs pages, `/blog` +1 corrects run 92's 36 undercount). Queue holds **2** (`link-checker-cant-see-your-javascript` [newest], `guard-advertised-capabilities-against-code`) — below the 3-deep forced-publish threshold | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **37** built; **GSC 28d (06-19→07-17, fresh 07-19 pull): 1 click / 452 impr / avg pos 16.3** (the 1 click is the homepage, pos 9.7), sitemap 112 submitted / 0 err. Top query `"top 10 products by revenue" metabase` pos 6.8 (6 impr, 0 clicks — page-1 build-vs-buy intent losing the click; a reach-track R-03 solve-page candidate, not a /daily pull). 7d external referrals = 9 (bing 8, github 1 — carried 07-12). Internal links **2,970** + **14 cross-app** (run-87 build: 121 pages, 0 dead / 0 redirecting — row #18) | GSC via `scripts/gsc-pull.ts`; CF `refererHost` carried. Impressions indexing-wide but ~0 CTR — total-impression breadth is the bottleneck, not per-page CTR at N≤12 impr (noise) |
| | **Engine** — BIRD 07-19 · Spider 07-19 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.542** (270/498 EA, 2 `gold_error`, 1 `exec_error`, 07-19 canonical on **post-revert** main `2b3e4d2`, [run 29670818828](https://github.com/nlqdb/nlqdb/actions/runs/29670818828) — 6 `SK-QUAL-013` windows, `no_sql` 0/500). **Recovered +2.8 pp from the 0.514 `SK-LLM-044` reading; flat vs the re-seeded baseline (Δ −0.40 pp, McNemar b=36/c=34 p=0.452, `regressions: []`) — the run-90 `SK-QUAL-006` trigger is cleared.** Baseline **re-seeded 0.5462 → 0.5422** (07-19; a flat give-back, not a ratcheted regression, `SK-QUAL-005`) | target 0.65 / **Phase 2 floor 0.60** — gap 5.8 pp. Offline levers exhausted; SC dead (#619); frontier-lens closed (run 15) |
| 9 | Spider raw EX | **0.2222** (30/135, 07-19 post-revert canonical on main `04fa3d0`, [29682993836](https://github.com/nlqdb/nlqdb/actions/runs/29682993836) → [29683450778](https://github.com/nlqdb/nlqdb/actions/runs/29683450778) → [29683911778](https://github.com/nlqdb/nlqdb/actions/runs/29683911778); 3 `SK-QUAL-013` windows, `no_sql` 0/135, gold_error 0, exec_error 5). **Give-back from the reverted 0.2963 `SK-LLM-044` reading (run 90); −5.2 pp vs pre-directive 0.2741, but post-revert `PLAN_DIRECTIVES` is byte-identical to that engine ⇒ free-lane cross-date provider-mix noise, not a regression (McNemar-flat both ways).** p50 1.52 s / p95 10.9 s. Freshness reset 07-19 | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is its source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004) — flat vs 07-02) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06 run 15, `SK-QUAL-022`). persona-bench −4.35 pts (07-09, one-question noise at N=23) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69–0.70 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers analytics (fresh 07-13 02:58Z pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 4,974 / 0 (0.00%) | mcp-server 473 req / 0 err; events-worker 31 req; canary 4 req / 0 err this window (secret-drift re-provisioning still tracked in `blocked-by-human.md`). **Deploy health (07-19 run 98):** CI + Security `success` on `main` head `c8138d5`; deploy-api/web/canary `success` on `c8138d5`, deploy-docs/mcp on `04fa3d0` (recent merges didn't touch docs/mcp paths ⇒ no new deploy); no red-main / stale-deploy lever |
| 13 | nlqdb-api wall-time p50 / p95 | p50 ≈ 0.61 s / p95 ≈ 1.70 s | mcp-server p95 ≈ 755 ms this window; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **≈ 0.75** (sdk/mcp/examples ≈1.0 each; **opencheck's latest main run [29324716801](https://github.com/nlqdb/nlqdb/actions/runs/29324716801) (run 70) FAILED**, pass=0 zeroes it ⇒ mean 0.75). Run 70 falsified the "clean window" hypothesis (re-dispatched 3 h after the last free-lane consumer, still all-red, Suite A anon 2nd `/v1/ask` timed out, **no product regression**): the free pools (NIM + OpenRouter `:free`) flap on a minute timescale, so contention timing was never the cause. **Now dark (rule 8):** only the founder-only 3rd free pool (its `blocked-by-human.md` bullet) lifts it | Never dispatch opencheck alongside another consumer of its lanes. Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.542, 07-19 post-revert, flat vs baseline — the run-90 regression is cleared); agentic-frontier ≥ 0.80 (0.693, Δ 18.66 ✓); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (stranger N=0); destructive-op retry < baseline (instrumented run 38, N≈0); MCP in 3+ host apps (07-11: 0 stranger hosts, 1 founder host — FAIL); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 removed the 428 wall |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **16** (fresh grep 07-19 run 98; +1 vs run 86's 15 — #742's merged `gtm-metrics` "Loop integration" bullet, already owned by open PR #744) | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. De-prioritised as a default lever per the 07-11 /weekly (monoculture, no external yield); pullable only under a step-2 priority-3 waiver |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** (07-18 run-87 sweep: **121** pages, **2,970** internal + **14 cross-app** links). Layered coverage: built-output `href`/`src` sweep + cross-app subdomain verification (run 61) + prod sitemap-200 check (run 72) + `client-nav-integrity.test.ts` (SK-WEB-022) guarding both `location.*` JS navigations (run 77) **and** static `<a href="/literal">` source literals (run 87, after legal-page bare-path 307s) — dotted assets + dynamic `href={…}` skipped, negative-tested | target 0 — `bun run build && bun run check:links` (built-output) + `client-nav-integrity.test.ts` (in CI) |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **0 open** (claim-vs-reality on shipped surfaces + docs; target 0 **met**). **Standing guards — all three advertised-capability surfaces closed-world CI-swept across web *and* docs**, each deriving truth from source (never hand-copied) and naming the phantom + file on failure: `mcp-tool-integrity.test.ts` (`registerTool(...)` sites, `SK-MCP-002`), `cli-verb-integrity.test.ts` (cobra tree), `sdk-method-integrity.test.ts` (shipped `NlqClient` type, `SK-SDK-013`). All 0 phantom live, negative-tested. **Trilogy complete** — no advertised-capability surface remains web-only |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) · picker parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal; only genuine remaining slot is the premium chain |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **9/9 + both FLOW-005 transports** ✅ (run-62 branch dispatch [29231826660](https://github.com/nlqdb/nlqdb/actions/runs/29231826660) against prod, exit 0: FLOW-001 3/3 · FLOW-002 3/3 · FLOW-003 3/3 · FLOW-005 walk + stdio both `passed`). The run-59 "morph-to-chat gap" is **decided, not a gap** (anon terminus IS the sign-in redirect; SK-WEB-002 chat is post-sign-in) | target 9/9 + both FLOW-005 ✅ **met**. Per-step JSON artifact proxy-gated from the agent container |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 22 | Channels live with attributable yield | **2 live / 2 partial / 17 untried** (07-19 ledger v1: organic search + dev.to live; GitHub/npm partial — links untagged; MCP registries 0/8). First-touch attribution live 07-19: `databases.source_json` + `/app/admin` sources; `dbsWithSource` accrues from next deploy (needs prod migration 0024, see `blocked-by-human.md`) | **weekly focus: → ≥ 5 live.** Every published URL carries its ledger `utm_source`; yield read from `/app/admin`, never estimated |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/20 + 12 memory `/vs` pages | tick on merge; mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — the only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; E-03…E-07 all Neon/infra-gated |
| | Memory-quality eval (`SK-QUAL-023`) | **free-chain EX 93.33% (14/15)** — run 69 re-measure, branch `4679180`, [GHA 29314389843](https://github.com/nlqdb/nlqdb/actions/runs/29314389843); p50 1168 ms / p95 7036 ms, `no_sql` 0. Per-axis: retrieval/forgetting/analytical/**consolidation 3/3**, **temporal 2/3** (sole weak axis). Run 68 read 86.67% (13/15) w/ consolidation 2/3 — the extra miss was N=15 free-chain noise. **Now diagnosable:** run-69 mismatch table (in the run log via `tee`) pins the sole failure — **Q3 temporal, `f.predicate='current_city'`** (hallucinated predicate + missing recency `ORDER BY … LIMIT 1`) | 15 gold-verified questions, 4 axes + analytical; free chain **is** reachable in CI (only the daily container is egress-gated); free-only (frontier lane opt-in); no baseline emitted (measurement, not canonical — SK-QUAL-023). Analytical-vs-vector head-to-head still E-05 infra-gated |

## Shipped distribution (live URLs)

Canonical copies on `/blog` (`SK-BLOG-001`); venue variants stay in
`research/distribution-queue.md` as pointers:

- https://nlqdb.com/blog/smoke-test-walks-the-old-ui/ (run 78 — e2e/measurement lesson, the run-58 walker re-true: pinned-literal acceptance walkers are a regression detector, but a red mixing product-breakage with test-drift costs a full triage — make the fail detail name element + expectation, triage reds on a clock, and gate "re-run the walker on PRs touching a walked surface")
- https://nlqdb.com/blog/green-checkmark-has-a-half-life/ (run 60 — CI/measurement lesson, the row #15 freshness method: when an expensive suite can't run on every push, "passing" is an event not a state — score `pass × freshness` with a linear decay so the number rots until someone re-runs it)
- https://nlqdb.com/blog/ephemeral-staging-persistent-registry/ (run 56 — CI/test-infra lesson, the SK-E2E-007 spin-up purge: an environment is only as ephemeral as the most persistent store that references it)
- https://nlqdb.com/blog/ownership-transfer-outlives-least-privilege/ (run 54 — Postgres multi-tenancy lesson, the SK-ANON-003 adoption ACL gap: an ownership transfer must retarget every authorization store; a catch-all must log the code it swallows)
- https://nlqdb.com/blog/most-active-user-is-your-test-suite/ (run 53 — measurement-hygiene lesson, the funnel bot-filter: a metric that doesn't name its population is measuring your robots; filter at read time)
- https://nlqdb.com/blog/five-fallback-models-one-provider/ (run 51 — CI/engine lesson, the opencheck lane swap: redundancy must cross the failure-domain boundary; the lane, not the model, is the fallback unit)
- …and 30 more posts — full 36-post registry in `apps/web/src/data/blog.ts` (row #6), live under `/blog/`.

## Last change

**2026-07-19 (run 98)** — **Priority-1 UX-flow lever (rows #4/#5): the anonymous
create path no longer hard-throws when localStorage is blocked.** Weekly-focus number
(agentic-frontier → 0.80 via the `SK-LLM-017` premium chain) is not agent-movable this
run — founder-blocked paid frontier credentials, §6-dark meter, dispatch-gated smoke,
`premiumEligible` never true (dead lane, same as run 97). Both engine lanes dark + fresh
(07-19); per **step 0** every GTM/admin/chat/attribution/docs lane is held by an open PR
(#748 PMF+launch, #747 reach docs, #746 run 97 chat, #745 attribution, #744 GTM uniques,
#719 Infisical). A defect-hunt over the free stranger-path files (not another a11y fix)
surfaced a genuine functional bug: **`getOrMintAnonToken` (`lib/anon.ts`) read/wrote
`window.localStorage` bare** — the one anon slot bypassing the `safeStorage` in-memory
fallback its three SK-ANON-011 companion slots (`nlqdb_draft/pending/history`) all use.
In privacy modes where touching `localStorage` throws (Chrome "block all cookies",
Firefox DOM storage off, sandboxed iframes) or on quota-over write, minting the bearer
every `/v1/ask` reads **threw hard on the create path**; `CreateForm.submit`'s catch
surfaced it as "Couldn't reach the API — try again" (misleading; the API is reachable),
and retry never helps. **Change (2 files):** wrapped the read/write in try/catch with a
module-level in-memory token fallback — the exact graceful-degradation SK-ANON-011
already mandates ("fall back to in-memory state without throwing"); SSR guard + the
"no DB-recovery path" invariant unchanged. Guarded by a pure `bun:test`
(`anon.test.ts`): blocked-storage returns a stable `anon_` token instead of throwing,
quota-over write keeps the token in memory, happy-path still persists. **Number moved —
rows #4/#5:** guard-the-guard confirmed — reverting `readStored` to the bare call fails
the regression test; web suite **308 → 313 pass** (+5). No new decision doc (D5 — the
fix conforms the token slot to the already-documented SK-ANON-011 contract). **Gates:**
astro check **0 errors**; `bun run lint` exit 0 (0 findings on touched files); web
**313 pass / 0 fail**. **Step-1:** docs-ambiguity **16**; surfaces **105**, queue **2**;
users **9** / strangers **0** (07-16); GSC 28d **1/452/16.3** carried (row #7); engine
BIRD 0.542 / Spider 0.2222 fresh 07-19. **Artifact:** queue **2** (< 3) → no forced
publish; dev.to drip throttled (15.0h < 20h — no-op, no queue-line edit); no new draft
(queue ~19.2 KB, near the D4 cap). **KPI (GLOBAL-025):** **onboarding + UX** — a
cookie-blocked stranger can now create + ask instead of dead-ending on a misleading
error; **no KPI degrades** (one try/catch + in-memory fallback; no engine/API/funnel
logic touched).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
