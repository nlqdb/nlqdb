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
engine lever unparks. Row #15 is **firmly dark (rule 8)** — the founder-only
independent 3rd free-LLM pool is the confirmed durable blocker (run 70
falsified the "clean window" hypothesis; full detail + run link in row #15).
/weekly should re-point the focus off #15 while that secret is unset.

**Worst number today:** real strangers reaching a first answer = **0**
(row #2; 07-16 remote-D1 pull carried — 9 users = 4 founder/company + 5
test/dev, newest registration 07-06, none since; lagging, moved only through
agent-controllable inputs). **Run 87 pulled a surface-integrity lever (row #18,
distribution priority-2):** the built-output link sweep found **2 redirecting
links** — the legal pages cross-linked each other with bare paths (`href="/terms"`
in `privacy.astro`, `href="/privacy"` in `terms.astro`, added in the #718/#714
legal sweep) that 307-redirect under `trailingSlash:"always"`. Fixed both (row #18
**2 → 0 redirecting**) and closed the CI blind-spot that hid them: `check:links`
is not wired into CI, so `<a href>` bare paths regress silently between manual
daily sweeps — widened the SK-WEB-022 guard to catch static `<a href="/literal">`
source literals (negative-tested). UX-flow rut-blocked (rule 7, runs 80–85);
engine unmeasurable here (`SK-QUAL-023`, egress-gated). **Step 0:** open PRs #724
(reach intent-map), #723 (human-dependency audit), #719 (Infisical) are all
docs/worksheets — zero overlap with `apps/web/**`. PR #711 merged (`730e525`),
so distribution is no longer PR-owned. **Rule 6:** CI green on `main` head
`ba7bbde` (run 2552 `success`); no red-main / stale-deploy lever.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (visits 07-13 02:58Z CF GraphQL; users/DBs 07-16 remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 232 pageloads (07-06→07-13 02:58Z, raw). Walker filter (run 12, `userAgentBrowser` cut): "Unknown" 183 ⇒ **real-browser ≈ 49 pageloads** (Chrome 41, ChromeMobile 3, MobileSafari 2, Firefox 2, Edge 1) | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company (`omer@salfati.group`, `omer.hochman@{gmail,bigpanda}`, `hi@nlqdb.com`) + 5 test/dev (`*@example.com`, `*@preview.dev`) — **re-verified 07-16 remote-D1, newest registration 07-06, none since**. The 428 wall is gone (run 56); acquisition now depends on distribution yield (owned by PR #711) |
| 3 | DBs total | **251** (07-16 remote-D1; +28 vs 07-13's 223, synthetic — walker/preview traffic; previews share prod D1) | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not yet measurable** (07-12 19:41Z remote-D1; method `SK-ONBOARD-007`). Only 3/165 DBs have `first10_asks > 0` (Σok 3 / Σasks 4), all founder/test | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12 19:41Z; founder-owned) | share of DBs with `first10_asks ≥ 2` |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **100** (`/vs` 31 + `/solve` 33 + `/blog` **36**; run-79 count fix — `blog.ts` holds 36 published posts, run 78 read 35). Run 78 published the oldest queued draft (`smoke-test-walks-the-old-ui`, step 3.1 forced-publish at ≥3 depth) → live at `/blog/smoke-test-walks-the-old-ui/`, verified in sitemap + rss + llms.txt. Queue now holds **2** (`link-checker-cant-see-your-javascript` [newest], `guard-advertised-capabilities-against-code`) — below the 3-deep forced-publish threshold | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **36** built; **GSC 28d (06-18→07-16, fresh 07-18 pull): 1 click / 455 impr / avg pos 16.4**, sitemap 112 submitted / 0 err. Top query `"top 10 products by revenue" metabase` pos 6.8 (6 impr, 0 clicks — page-1 build-vs-buy intent losing the click; a reach-track R-03 solve-page candidate, not a /daily pull). 7d external referrals = 9 (bing 8, github 1 — carried 07-12). Internal links **2,970** + **14 cross-app** (run-87 build: 121 pages, 0 dead / 0 redirecting — row #18) | GSC via `scripts/gsc-pull.ts`; CF `refererHost` carried. Impressions indexing-wide but ~0 CTR — total-impression breadth is the bottleneck, not per-page CTR at N≤12 impr (noise) |
| | **Engine** — BIRD 07-11 · Spider 07-11 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.546** (272/498 EA, 2 `gold_error`, 07-11 canonical on main `2cfda39`, [run 29144102081](https://github.com/nlqdb/nlqdb/actions/runs/29144102081) — completed in ONE window, `no_sql` 0/500). Δ +2.01 pp vs 07-05, McNemar b=31/c=41, `regressions: []`. Baseline re-seeded. Measured pre-`SK-LLM-044`; next canonical re-verifies | target 0.65 / **Phase 2 floor 0.60** — gap 5.4 pp. Offline levers exhausted; SC dead (#619); frontier-lens closed (run 15) |
| 9 | Spider raw EX | **0.2963** (40/135, `no_sql` 0/135, exec_error 3, gold_error 0 — 07-11 canonical on `6e1725c` with `SK-LLM-044`, nine-window `SK-QUAL-013` resume [29160009809](https://github.com/nlqdb/nlqdb/actions/runs/29160009809) → [29164092490](https://github.com/nlqdb/nlqdb/actions/runs/29164092490)). Was 0.2741 | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is its source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004) — flat vs 07-02) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06 run 15, `SK-QUAL-022`). persona-bench −4.35 pts (07-09, one-question noise at N=23) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69–0.70 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers analytics (fresh 07-13 02:58Z pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 4,974 / 0 (0.00%) | mcp-server 473 req / 0 err; events-worker 31 req; canary 4 req / 0 err this window (secret-drift re-provisioning still tracked in `blocked-by-human.md`). **Deploy health (07-18 run 87):** CI **green on `main`** head `ba7bbde` (run 2552 `success`); merges since 07-16 (#721/#722 docs/pivot) are path-filtered away from `deploy-*`, so the run-86 all-green deploy verification (9 `deploy-*` + `release-npm` + `security`) still holds; no red-main / stale-deploy lever |
| 13 | nlqdb-api wall-time p50 / p95 | p50 ≈ 0.61 s / p95 ≈ 1.70 s | mcp-server p95 ≈ 755 ms this window; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **≈ 0.75** (sdk/mcp/examples ≈1.0 each; **opencheck's latest main run [29324716801](https://github.com/nlqdb/nlqdb/actions/runs/29324716801) (run 70) FAILED**, pass=0 zeroes it ⇒ mean 0.75). **Run 70 falsified the "clean window" hypothesis:** re-dispatched `abc` on `2b9f8a7` ~3 h after the last free-lane consumer (run 69 memory eval, 07:24Z) — all 3 suites still red, Suite A's anon 2nd `/v1/ask` 240 s-timed-out, **no product regression** (bootstrap recordings passed, no `schema_mismatch`). The free pools (NIM + OpenRouter `:free`) flap intrinsically on a minute timescale ⇒ contention timing was never the cause. **Now dark (rule 8):** only the founder-only independent 3rd free pool (its `blocked-by-human.md` bullet) lifts it | Sequencing rule (unchanged): never dispatch opencheck alongside another consumer of its lanes. Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.546, 07-11); agentic-frontier ≥ 0.80 (0.693, Δ 18.66 ✓); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (stranger N=0); destructive-op retry < baseline (instrumented run 38, N≈0); MCP in 3+ host apps (07-11: 0 stranger hosts, 1 founder host — FAIL); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 removed the 428 wall |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **15** (fresh grep 07-16 run 86; unchanged since run 78, was 17). Run 78 reclassified 2 decided-deferral ICP bullets (`icp-mining`: Reddit disable [SK-ICP-011], 10th-source refactor pin [P5]) to the canonical "Parked until `<trigger>`" form their 4 siblings already use — honest miscount correction, not a genuinely-open question resolved | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. De-prioritised as a default lever per the 07-11 /weekly (monoculture, no external yield); pullable only under a step-2 priority-3 waiver — run 86 declined the pull: the 15 bullets are genuine deferrals (see _Last change_) |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** (07-18 run-87 sweep: **121** pages, **2,970** internal + **14 cross-app** links). Coverage layered over prior runs: built-output `href`/`src` sweep + cross-app subdomain verification (run 61) + prod sitemap-200 check (run 72) + `client-nav-integrity.test.ts` guarding `location.*` JS navigations (run 77, SK-WEB-022, after 6 bare-path 307s). **Run 87 found + fixed a fresh regression:** the built sweep reported **2 redirecting** — `privacy.astro`↔`terms.astro` cross-linked with bare paths (`href="/terms"`, `href="/privacy"`, added in the #718/#714 legal sweep) that 307 under `trailingSlash:"always"`. Root cause: `check:links` is **not wired into CI**, so bare-path `<a href>` literals regress silently between manual daily sweeps (the run-77 guard covered `location.*` JS navigations, not `href`). Fixed both (**2 → 0 redirecting**) and **widened SK-WEB-022's guard with a second test sweeping static `<a href="/literal">` source literals** — negative-tested (fails on a reintroduced bare href, naming `file:line`), false-positive-free (dotted assets + dynamic `href={…}` skipped) | target 0 — `bun run build && bun run check:links` (built-output) + `client-nav-integrity.test.ts` (JS navigations **+ static `<a href>`**, in CI) |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **0 open** — run 76 verified `brew install nlqdb/tap/nlq` (advertised in `cli/README.md` + npm-shim fallback, `SK-CLI-002`) is now real: `nlqdb/homebrew-tap` carries `nlq.rb` at root (commit 07-15 02:42Z, v0.1.12; **empty since 2026-05-19** before this), the linux_x86_64 asset returns HTTP 200 with a **sha256 matching the formula exactly** (`63a9266…814a`), tarball ships the `nlq` binary. Run 73's `cli/.goreleaser.yml` token-format fix (merged) populated the tap on `deploy-cli`@`80e4aa44`; run 76 is the post-merge tap-verify the scorecard deferred. Runs 32 + 37 + 56 + 59 + 62 + 64 + 72 + 73 + 74 + **76** each found/closed 1 agent-movable gap | claim-vs-reality on shipped surfaces + docs; target 0 **met**. **Standing guards:** `mcp-tool-integrity.test.ts` (run 64) sweeps the shipped MCP catalog closed-world; `cli-verb-integrity.test.ts` (run 74) derives the 15 shipped top-level verbs from the cobra tree (first `Use:` per `cli/internal/cmd/*.go` minus `nlq`) and — **as of run 76** — sweeps every `nlq <verb>` snippet across **both** `apps/web/src` (`.ts/.tsx/.astro`) and the docs-site prose `apps/docs/src` (`.md/.mdx`), naming the phantom + file on failure (verified: fails on an injected `nlq schema` in `cli.mdx`). Next candidate: the SDK method surface (`client.*`), and a docs-prose sweep of MCP-tool names |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) · picker parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal; only genuine remaining slot is the premium chain |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **9/9 + both FLOW-005 transports** ✅ (run-60 branch dispatch [29211619838](https://github.com/nlqdb/nlqdb/actions/runs/29211619838) against prod: FLOW-001 3/3 · FLOW-002 3/3 · FLOW-003 3/3 · FLOW-005 walk + stdio both `passed`). FLOW-001's step-8 red was the walker asserting a 2nd anon `/v1/ask` 200 — impossible under `SK-ANON-012`'s message-#2 wall; step 8 now asserts the 401 cap (dt 296–337 ms). Before: main dispatch [29211269726](https://github.com/nlqdb/nlqdb/actions/runs/29211269726) FLOW-001 0/3 step-8 `status=401`. The run-59 "morph-to-chat gap" is **decided, not a gap**: the anon terminus IS the sign-in redirect (SK-ANON-011 stash → SK-ANON-003 adopt); the SK-WEB-002 chat is the post-sign-in /app surface. **Run 62 closed the step-7 false-green:** the copy-snippet conversion action was silently skipping (selector matched the accessible name, which the `aria-label` diverged from) — now the aria-label is dropped (accessible name = visible "Copy snippet", WCAG 2.5.3) and the selector widened; branch dispatch [29231826660](https://github.com/nlqdb/nlqdb/actions/runs/29231826660) walked prod **9/9 passed (exit 0)** with the new selector | target 9/9 + both FLOW-005 ✅ **met**. Per-step JSON artifact isn't downloadable from the agent container (proxy-gated); the selector→accessible-name defect is closed deterministically |
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

**2026-07-18 (run 87)** — **Surface-integrity lever (row #18, distribution
priority-2): redirecting links 2 → 0.** Built-output link sweep (`bun run build &&
bun run check:links`, 121 pages / 2,970 internal links) found **2 redirecting
links**: the legal pages cross-linked each other with bare paths — `href="/terms"`
in `privacy.astro`, `href="/privacy"` in `terms.astro` (introduced in the
#718/#714 legal sweep) — which 307-redirect under `trailingSlash:"always"`. Fixed
both to trailing-slash paths; re-swept **0 dead / 0 redirecting**. **Root cause +
guard:** `check:links` is not wired into CI, so it only runs on a manual/daily
build — bare-path `<a href>` literals regress silently between sweeps, and the
run-77 `client-nav-integrity` guard (SK-WEB-022) only covered `location.*` JS
navigations, not `href`. **Widened that guard** with a second test sweeping static
`<a href="/literal">` source literals (dotted assets + dynamic `href={…}` skipped
→ false-positive-free; negative-tested: fails on a reintroduced bare href naming
`file:line`); updated the SK-WEB-022 canonical body to record why href now needs a
source guard (P3). **Why this lever:** UX-flow rut-blocked (rule 7, runs 80–85);
engine unmeasurable here (`SK-QUAL-023`, egress-gated); distribution un-blocked now
PR #711 merged. **Step-1 refresh:** CI green `ba7bbde` (run 2552); indexable
surfaces **100** (built: /vs 31 + /solve 33 + /blog 36 — raw data-file entries
37/35 include unbuilt drafts, built count unchanged); GSC 28d **1 click / 455 impr
/ pos 16.4** (fresh 07-18); users **9** / strangers **0** carried (07-16 pull,
newest reg 07-06); docs-ambiguity **15** (fresh grep). **Artifact (step 3):** queue
**2** (< 3) → no forced publish, no new draft (lesson closely overlaps the queued
`link-checker-cant-see-your-javascript` draft); **dev.to variant drained** —
`null-timestamp-ttl-sweep-funnel-metric` posted (`SK-BLOG-003`, idempotent). **KPI
(GLOBAL-025):** **UX** + **onboarding** — dead-click-free legal surfaces + a
standing CI guard against silent href redirects; no KPI degrades.

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
