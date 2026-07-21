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
**row #9 Spider 0.2222** and **row #8 BIRD 0.542** — both dark + fresh (07-19), offline
levers exhausted. **Run 106 pulled a priority-2 UX-flow lever (row #4):** the create→
first-answer funnel silently emptied the stranger's seeded demo for auto-PK schemas —
`SK-HDC-019` pruning dropped sample rows that omit a `SK-HDC-015` auto-generated PK
(int/bigint IDENTITY, uuid `gen_random_uuid()`) as `not_null_violation`, though the INSERT
would succeed; entirely empty for uuid PKs. Mechanism + fix in **Last change** below.
**Step 0 collision map:** open PRs #759 (self-labeled run 105, row #7 — `apps/api/src/
{index,marketing-mirror}.ts` + web-app docs), #760 (reach R-05, row #22 — acquisition
ledger + reach INDEX + `blocked-by-human.md`), #719 (Infisical draft — founder). This run
touched only `apps/api/src/db-create/sample-rows.{ts,test.ts}` +
`hosted-db-create/decisions/SK-HDC-019…md` + `docs/scorecard.md` — **no overlap** (scorecard
regen exempt); row #7 + row #22 daily levers are taken, so per step 2 priority order the
pullable lever is priority-2 UX-flow. **Rule 6:** CI + Security + Deploy web/docs/MCP/API +
Release npm all `success` on `main` head `7808cd4` (07-20T18:26Z); Canary `success`; no
red-main / stale-deploy lever.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (visits 07-13 02:58Z CF GraphQL; users/DBs 07-16 remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 232 pageloads (07-06→07-13 02:58Z, raw). Walker filter (run 12, `userAgentBrowser` cut): "Unknown" 183 ⇒ **real-browser ≈ 49 pageloads** (Chrome 41, ChromeMobile 3, MobileSafari 2, Firefox 2, Edge 1) | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company (`omer@salfati.group`, `omer.hochman@{gmail,bigpanda}`, `hi@nlqdb.com`) + 5 test/dev (`*@example.com`, `*@preview.dev`) — **re-verified 07-16 remote-D1, newest registration 07-06, none since**. The 428 wall is gone (run 56); acquisition now depends on distribution yield (owned by PR #711) |
| 3 | DBs total | **251** (07-16 remote-D1; +28 vs 07-13's 223, synthetic — walker/preview traffic; previews share prod D1) | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not yet measurable** (07-12 19:41Z remote-D1; method `SK-ONBOARD-007`). Only 3/165 DBs have `first10_asks > 0` (Σok 3 / Σasks 4), all founder/test | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel. The stranger create→ask→first-answer path is hardened each run (vague-goal recovery, aborted-reply settle, create-result schema truth, localStorage-blocked create, run-104 first-answer error-copy overflow hint); **run 106** fixed the seeded first-value demo — `SK-HDC-019` pruning dropped sample rows that omit a `SK-HDC-015` auto-generated PK (int/bigint IDENTITY, uuid `gen_random_uuid()`), emptying the demo entirely for uuid-PK schemas though the INSERT would succeed; now kept when the key is absent. Per-run detail in `git log` |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12 19:41Z; founder-owned) | share of DBs with `first10_asks ≥ 2` |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **105** (`/vs` 32 + `/solve` 36 + `/blog` **37**; fresh recount 07-19 — `/solve` +3 & `/vs` +1 from merged reach solve/vs pages, `/blog` +1 corrects run 92's 36 undercount). Queue holds **2** (`link-checker-cant-see-your-javascript` [newest], `guard-advertised-capabilities-against-code`) — below the 3-deep forced-publish threshold | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **37** built; **GSC 28d (06-20→07-18, fresh 07-20 pull): 1 click / 472 impr / avg pos 16.6** (the 1 click is the homepage, 72 impr / pos 9.6), sitemap 115 submitted / 0 err. Top query `"top 10 products by revenue" metabase` pos 6.8 (6 impr, 0 clicks — page-1 build-vs-buy intent losing the click; a reach-track R-03 solve-page candidate, not a /daily pull). 7d external referrals = 9 (bing 8, github 1 — carried 07-12). Internal links **2,970** + **14 cross-app** (run-87 build: 121 pages, 0 dead / 0 redirecting — row #18) | GSC via `scripts/gsc-pull.ts`; CF `refererHost` carried. Impressions indexing-wide but ~0 CTR — total-impression breadth is the bottleneck, not per-page CTR at N≤12 impr (noise) |
| | **Engine** — BIRD 07-19 · Spider 07-19 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.542** (270/498 EA, 2 `gold_error`, 1 `exec_error`, 07-19 canonical on **post-revert** main `2b3e4d2`, [run 29670818828](https://github.com/nlqdb/nlqdb/actions/runs/29670818828) — 6 `SK-QUAL-013` windows, `no_sql` 0/500). **Recovered +2.8 pp from the 0.514 `SK-LLM-044` reading; flat vs the re-seeded baseline (Δ −0.40 pp, McNemar b=36/c=34 p=0.452, `regressions: []`) — the run-90 `SK-QUAL-006` trigger is cleared.** Baseline **re-seeded 0.5462 → 0.5422** (07-19; a flat give-back, not a ratcheted regression, `SK-QUAL-005`) | target 0.65 / **Phase 2 floor 0.60** — gap 5.8 pp. Offline levers exhausted; SC dead (#619); frontier-lens closed (run 15) |
| 9 | Spider raw EX | **0.2222** (30/135, 07-19 post-revert canonical on main `04fa3d0`, [29682993836](https://github.com/nlqdb/nlqdb/actions/runs/29682993836) → [29683450778](https://github.com/nlqdb/nlqdb/actions/runs/29683450778) → [29683911778](https://github.com/nlqdb/nlqdb/actions/runs/29683911778); 3 `SK-QUAL-013` windows, `no_sql` 0/135, gold_error 0, exec_error 5). **Give-back from the reverted 0.2963 `SK-LLM-044` reading (run 90); −5.2 pp vs pre-directive 0.2741, but post-revert `PLAN_DIRECTIVES` is byte-identical to that engine ⇒ free-lane cross-date provider-mix noise, not a regression (McNemar-flat both ways).** p50 1.52 s / p95 10.9 s. Freshness reset 07-19 | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is its source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004) — flat vs 07-02) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06 run 15, `SK-QUAL-022`). persona-bench −4.35 pts (07-09, one-question noise at N=23) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69–0.70 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers analytics (fresh 07-13 02:58Z pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 4,974 / 0 (0.00%) | mcp-server 473 req / 0 err; events-worker 31 req; canary 4 req / 0 err this window (secret-drift re-provisioning still tracked in `blocked-by-human.md`). **Deploy health (07-20 run 103):** CI + Security + Deploy web/docs/MCP/API + Release npm all `success` on `main` head `a833cf4`; Canary `success` on `a833cf4`; no red-main / stale-deploy lever |
| 13 | nlqdb-api wall-time p50 / p95 | p50 ≈ 0.61 s / p95 ≈ 1.70 s | mcp-server p95 ≈ 755 ms this window; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **≈ 0.75** (sdk/mcp/examples ≈1.0 each; **opencheck's latest main run [29324716801](https://github.com/nlqdb/nlqdb/actions/runs/29324716801) (run 70) FAILED**, pass=0 zeroes it ⇒ mean 0.75). Run 70 falsified the "clean window" hypothesis (re-dispatched 3 h after the last free-lane consumer, still all-red, Suite A anon 2nd `/v1/ask` timed out, **no product regression**): the free pools (NIM + OpenRouter `:free`) flap on a minute timescale, so contention timing was never the cause. **Now dark (rule 8):** only the founder-only 3rd free pool (its `blocked-by-human.md` bullet) lifts it | Never dispatch opencheck alongside another consumer of its lanes. Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.542, 07-19 post-revert, flat vs baseline — the run-90 regression is cleared); agentic-frontier ≥ 0.80 (0.693, Δ 18.66 ✓); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (stranger N=0); destructive-op retry < baseline (instrumented run 38, N≈0); MCP in 3+ host apps (07-11: 0 stranger hosts, 1 founder host — FAIL); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 removed the 428 wall |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **16** (fresh grep 07-20 run 102; flat vs run 100) | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. De-prioritised as a default lever per the 07-11 /weekly (monoculture, no external yield); pullable only under a step-2 priority-3 waiver |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** (07-18 run-87 sweep: **121** pages, **2,970** internal + **14 cross-app** links). Layered coverage: built-output `href`/`src` sweep + cross-app subdomain verification (run 61) + prod sitemap-200 check (run 72) + `client-nav-integrity.test.ts` (SK-WEB-022) guarding both `location.*` JS navigations (run 77) **and** static `<a href="/literal">` source literals (run 87, after legal-page bare-path 307s) — dotted assets + dynamic `href={…}` skipped, negative-tested | target 0 — `bun run build && bun run check:links` (built-output) + `client-nav-integrity.test.ts` (in CI) |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **0 open** (claim-vs-reality on shipped surfaces + docs; target 0 **met**). **Standing guards — all three advertised-capability surfaces closed-world CI-swept across web *and* docs**, each deriving truth from source (never hand-copied) and naming the phantom + file on failure: `mcp-tool-integrity.test.ts` (`registerTool(...)` sites, `SK-MCP-002`), `cli-verb-integrity.test.ts` (cobra tree), `sdk-method-integrity.test.ts` (shipped `NlqClient` type, `SK-SDK-013`). All 0 phantom live, negative-tested. **Trilogy complete** — no advertised-capability surface remains web-only |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) · picker parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal; only genuine remaining slot is the premium chain |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **9/9 + both FLOW-005 transports** ✅ (run-62 branch dispatch [29231826660](https://github.com/nlqdb/nlqdb/actions/runs/29231826660) against prod, exit 0: FLOW-001 3/3 · FLOW-002 3/3 · FLOW-003 3/3 · FLOW-005 walk + stdio both `passed`). The run-59 "morph-to-chat gap" is **decided, not a gap** (anon terminus IS the sign-in redirect; SK-WEB-002 chat is post-sign-in) | target 9/9 + both FLOW-005 ✅ **met**. Per-step JSON artifact proxy-gated from the agent container |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 22 | Channels live with attributable yield | **4 live / 0 partial / 1 blocked-by-human / 16 untried** (07-20 run 103: **dev.to's `live` was really a partial — now genuinely attributable.** The syndication read-through link carried no key, so dev.to→nlqdb.com visits fell back to the `ref: dev.to` referrer (readers/RSS/webviews strip it); tagging the link `…/blog/<slug>/?utm_source=devto` (API `canonical_url` stays clean for SEO) makes them `utm_source`-attributable via `captureFirstTouch`. Now **all 4 live channels** (organic search + dev.to + npm + GitHub) satisfy rule 1's utm-key requirement — the summary's "every published channel's yield is attributable" is finally true. MCP registries 0/8 live — official registry payload parked → `blocked-by-human` (#751)). First-touch attribution live 07-19: `databases.source_json` + `/app/admin` sources; `dbsWithSource` accrues from next deploy (needs prod migration 0024, see `blocked-by-human.md`) | **weekly focus: → ≥ 5 live.** Every published URL carries its ledger `utm_source`; yield read from `/app/admin`, never estimated. Further live-count growth now comes only from the not-yet-live channels (registries R-05 `/reach`, human-norm venues) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/20 + 12 memory `/vs` pages | tick on merge; mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — the only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; E-03…E-07 all Neon/infra-gated |
| | Memory-quality eval (`SK-QUAL-023`) | **free-chain EX 93.33% (14/15)** — run 69 re-measure, branch `4679180`, [GHA 29314389843](https://github.com/nlqdb/nlqdb/actions/runs/29314389843); p50 1168 ms / p95 7036 ms, `no_sql` 0. Per-axis: retrieval/forgetting/analytical/**consolidation 3/3**, **temporal 2/3** (sole weak axis). Run 68 read 86.67% (13/15) w/ consolidation 2/3 — the extra miss was N=15 free-chain noise. **Now diagnosable:** run-69 mismatch table (in the run log via `tee`) pins the sole failure — **Q3 temporal, `f.predicate='current_city'`** (hallucinated predicate + missing recency `ORDER BY … LIMIT 1`) | 15 gold-verified questions, 4 axes + analytical; free chain **is** reachable in CI (only the daily container is egress-gated); free-only (frontier lane opt-in); no baseline emitted (measurement, not canonical — SK-QUAL-023). Analytical-vs-vector head-to-head still E-05 infra-gated |

## Shipped distribution (live URLs)

Canonical copies on `/blog` (`SK-BLOG-001`); venue variants + full lesson gists
stay in `research/distribution-queue.md` (and `apps/web/src/data/blog.ts`):

- https://nlqdb.com/blog/smoke-test-walks-the-old-ui/ (run 78)
- https://nlqdb.com/blog/green-checkmark-has-a-half-life/ (run 60)
- https://nlqdb.com/blog/ephemeral-staging-persistent-registry/ (run 56)
- https://nlqdb.com/blog/ownership-transfer-outlives-least-privilege/ (run 54)
- https://nlqdb.com/blog/most-active-user-is-your-test-suite/ (run 53)
- https://nlqdb.com/blog/five-fallback-models-one-provider/ (run 51)
- …and 31 more posts — full 37-post registry in `apps/web/src/data/blog.ts` (row #6), live under `/blog/`.

## Last change

**2026-07-20 (run 106)** — **Priority-2 UX-flow lever (row #4): the create→first-answer
funnel no longer silently empties a stranger's seeded demo for auto-PK schemas.** Row #7 (the
priority-1 distribution lever) and row #22 (weekly-focus acquisition) are both taken by open
PRs #759 and #760; per step 2's priority order the pullable daily-sized lever is priority-2
UX-flow. Defect-hunt over the `apps/api/src/db-create/**` create pipeline found a genuine
contradiction between two decisions: `SK-HDC-019`'s `pruneUninsertableSampleRows` drops seed
rows it can *prove* won't insert and promises it "never [drops] a row that might insert" —
but its NOT-NULL check computed `hasDefault` from the LLM-authored `col.default` only, so it
never modelled `SK-HDC-015`'s compiler-injected auto-generator (`GENERATED BY DEFAULT AS
IDENTITY` for a single-column `integer`/`bigint` PK, `DEFAULT gen_random_uuid()` for `uuid`).
LLM sample rows normally *omit* the auto-PK, and `neon-provision.ts` names only the provided
columns in the INSERT, so those inserts succeed — yet pruning dropped every such row as
`not_null_violation`. For a `uuid` PK (LLMs never author raw UUIDs) it empties the seed
**entirely** → the create response returns 0 sample rows and the stranger sees "Provisioned
with 0 sample rows" on a DB that would have seeded fine. Code wrong / decision right (§10.2):
the fix aligns pruning with `SK-HDC-015`. **Change (P5 — narrow):** in the NOT-NULL loop,
treat a single-column int/bigint/uuid PK with no plan default as defaulted **only when the
key is absent** from the row (an explicit null still drops — an IDENTITY column rejects it);
kept the SK-HDC-019 soundness-contract doc in sync. **Number moved — row #4:** guard-the-guard
confirmed — the two new omit-auto-PK tests (integer + uuid) **fail** against the pre-fix source
(2 failed on stash), **pass** after; api **974 → 977 pass** (+3: integer-omit, uuid-omit,
text-PK narrowness guard; existing explicit-`id: null` drop still passes). No new decision
(D5 — bug fix inferable from SK-HDC-015 + code). **Gates:** typecheck exit 0; lint exit 0;
touched files biome-clean; api **977**, full `bun run test` exit 0 (983 total, 6 skipped).
**Step-1:** docs-ambiguity **16** (flat); surfaces **105**, queue **2**; users **9** /
strangers **0** (07-16 carried); GSC 28d **1/472/16.6** (07-20); BIRD 0.542 / Spider 0.2222
(07-19); CI + all deploys `success` on `main` `7808cd4`. **Artifact:** queue **2** (< 3) →
no publish; dev.to drip **throttled** (last post <24h ago); no new draft (queue at 20 KB
D4 cap). **KPI (GLOBAL-025):** **onboarding** — the seeded first-value demo (the first-10-queries
KPI's on-ramp) now survives the whole auto-PK schema class; **no KPI degrades** (pruning only
ever *kept more* provably-insertable rows; the happy path and every other drop reason are
byte-unchanged; no engine/funnel/API-contract logic touched).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
