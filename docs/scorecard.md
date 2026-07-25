# Scorecard — current state

Point-in-time tracker, regenerated each
[`/daily`](../.claude/commands/daily.md) run. Current state only — no changelog
(≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md` (engine).

**Weekly focus number (2026-07-19 → 07-25, founder-set):**
**Acquisition — channels live with attributable yield: 2 → ≥ 5 (row #22, now 4).**
Founder directive 2026-07-19 ([`GLOBAL-038`](decisions/GLOBAL-038-gtm-pmf-instrumentation.md)):
the operating focus is **user acquisition**, measured continuously — product
progress is secondary this cycle. Agent-movable inputs, in order: reach R-05
registry listings (list or park each), the R-04 machine-followable setup guide,
utm-tagging live channels per `SK-GTM-007`, and R-06 (the track's falsifier).
Channel truth lives in
[`research/acquisition-channels.md`](research/acquisition-channels.md); yield
truth on `/app/admin`, never estimated. Premium-chain work (`SK-LLM-017`,
row #20) is pullable only when no acquisition lever is.

**Worst number today:** **row #21 stranger-walker pass rate — true value 0/9, not the `9/9 ✅` carried
since 07-21** (live prod walk [30143764445](https://github.com/nlqdb/nlqdb/actions/runs/30143764445)).
It was never re-read because `SK-STRG-003` keeps the cron green **by design** and the walk ran
`--quiet`, so a red walk emitted zero bytes and looked identical to one nobody dispatched. Two causes,
now separated: **6 walks failed on a real product break** (the
`/solve` · `/vs` · `/agents` CTAs discarded the visitor's goal across the marketing→app origin split —
fixed this run, `SK-ANON-015`); **3 fail on Turnstile declining a headless datacenter client** (428),
an instrument limit. Row #16 Phase-2 gate stays 1/9; engine (**#9 Spider 0.2222**, **#8 BIRD 0.542**) dark + fresh
(07-19, 6 d). Row #15 rose to **0.74** unaided. **Top `blocked-by-human` bullet:** #1 fire the launch
sequence (Show HN draft **idle 42 days since 06-13**) — the only queue action that can move real
strangers off 0; its age is the company's real cycle time. Queue depth **7**: launch (#1), mcp.so /
cursor.directory / awesome-mcp / Claude-dir (#2–#5, account-walled), GLOBAL-039 zone toggle (#6),
CI-as-required-check (#7).

**Rule 6 clean** (CI + Security + Release-npm **and all 8 `deploy-*` workflows** `success` on `main`
`aad87a7` — 07-25 02:24Z). **Open PRs 4** — oldest #719 (draft Infisical, 8 d), oldest non-draft #817
(< 1 d). **Step 0:** open PRs #817 (run 139: `astro.config.mjs`, `canonical-redirects*`,
`check-links.mjs`, web-app FEATURE), #819 (reach INDEX, mcp-server FEATURE, `apps/docs`), #719 (draft
Infisical). This run touches `acquisition-health.yml`, the `/solve` · `/vs` · `/agents` · `/app/new`
pages, `lib/handoff.ts` + `lib/posthog.ts`, `client-nav-integrity` + `handoff` tests,
`tools/stranger-test`, and the anonymous-mode + stranger-test FEATUREs — **no overlap** beyond the
step-1-exempt `scorecard.md`.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (visits + users/DBs all re-measured live 07-25: CF GraphQL + remote-D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | **147 pageloads** (07-18→07-25 live, raw). Walker filter (run 12, `userAgentBrowser` cut): "Unknown" 90 + BingBot 1 ⇒ **real-browser ≈ 56** (Chrome 31 + ChromeMobile 14 + Edge 5 + Firefox 4 + MobileSafari 2) — up from ≈42 on the 07-15→07-22 window, with no row-#2 signal behind it | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (`*@example.com`, `*@preview.dev`) — re-read live remote-D1 07-25, roster byte-identical; no acquisition channel newly live to produce a signal. **Correction:** prior runs read "funnel walkers green" off the cron's *workflow conclusion*, which `SK-STRG-003` pins to success regardless — the 07-24 cron had in fact exited 1 (row #21) |
| 3 | DBs total | **254** (07-25 live remote-D1, −1 vs 07-24; synthetic — walker/preview churn; previews share prod D1) | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not yet measurable** (07-12 remote-D1; method `SK-ONBOARD-007`). Only 3/165 DBs have `first10_asks > 0` (Σok 3 / Σasks 4), all founder/test. Attribution re-verified live 07-25: `dbsWithSource` = **0** (accrues from the first attributable visit) | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12 19:41Z; founder-owned) | share of DBs with `first10_asks ≥ 2` |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **105** (`/vs` 32 + `/solve` 36 + `/blog` **37**; recount 07-19). Queue holds **2** — below the 3-deep forced-publish threshold | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **37** built; **GSC 28d (06-25→07-23, live 07-25): 6 clicks / 485 impr / avg pos 17.4** — clicks flat an 8th read; the impr/pos move is the window sliding a day. 5 click-earning pages: `/security/hall-of-fame/` (2), homepage, `/architecture/`, `/blog/bird-gold-noise-distinct/`, and the top winnable page `/solve/count-rows-per-day-including-missing-dates/` (**66 impr / pos 7.8**, on-page-maxed, now earning). Until this run every one of those pages' "Try this query" CTA dropped the visitor's goal (row #21). Run 139: 6 impressions sat on **bare-path** URLs Google indexed separately (`/agents` 4, one blog post 2) — 307 defect fixed by `SK-WEB-027`; the `http://…streak-in-sql/` variant (7 impr / pos 10.1) still needs the zone toggle (`blocked-by-human` #6). sitemap 116 submitted / 0 indexed. Internal links **2,970** + **14 cross-app**, 0 dead / 0 redirecting (row #18) | GSC via `scripts/gsc-pull.ts`. Impression breadth is the bottleneck, not per-page CTR at N≤12 impr (noise) |
| | **Engine** — BIRD 07-19 · Spider 07-19 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.542** (270/498 EA, 2 `gold_error`, 1 `exec_error`, 07-19 canonical on post-revert main `2b3e4d2`, [run 29670818828](https://github.com/nlqdb/nlqdb/actions/runs/29670818828) — 6 `SK-QUAL-013` windows, `no_sql` 0/500). Flat vs the re-seeded baseline (Δ −0.40 pp, McNemar p=0.452) — run-90 `SK-QUAL-006` trigger cleared | target 0.65 / **Phase 2 floor 0.60** — gap 5.8 pp. Offline levers exhausted; SC dead (#619); frontier-lens closed (run 15) |
| 9 | Spider raw EX | **0.2222** (30/135, 07-19 post-revert canonical on main `04fa3d0`, [29682993836](https://github.com/nlqdb/nlqdb/actions/runs/29682993836); 3 windows, `no_sql` 0/135, exec_error 5). Give-back from the reverted 0.2963 reading (run 90) on a byte-identical engine ⇒ free-lane provider-mix noise, not a regression. p50 1.52 s / p95 10.9 s | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is its source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004) — flat vs 07-02) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06 run 15, `SK-QUAL-022`). persona-bench −4.35 pts (07-09, one-question noise at N=23) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69–0.70 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers analytics (fresh 07-13 02:58Z pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | **2,169 / 0** (0.00%, 7d live 07-25) | mcp-server 851 req / 0 err; web 10,013 req / 0 err; events-worker 6 req. Zero errors on every script. Deploy health tracked in the Rule-6 line above (all `success` on `main`) |
| 13 | nlqdb-api wall-time p50 / p95 | p50 ≈ 0.61 s / p95 ≈ 1.70 s | mcp-server p95 ≈ 755 ms this window; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.74** (recomputed live 07-25; was 0.50 on 07-24). Per suite `pass × freshness`: **sdk 0.97** · **examples 0.97** (both ✅ 07-24) · **mcp 1.0** ([30139911460](https://github.com/nlqdb/nlqdb/actions/runs/30139911460) ✅ 07-25 — run 138's stub fix merged, so the suite runs its 4 tests again after 11 days of testing nothing) · **opencheck 0** ([30130304331](https://github.com/nlqdb/nlqdb/actions/runs/30130304331) ❌ Suite A 1/5 — all 4 failures are `TEST_FAILED: rate-limit error` on the agent lane after a green pre-flight: the documented NVIDIA-free-tier saturation flake, whose remedy costs money ⇒ rule 4). Now purely opencheck-limited |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.542); agentic-frontier ≥ 0.80 (0.693, Δ 18.66 ✓); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (stranger N=0); destructive-op retry < baseline (N≈0); MCP in 3+ host apps (0 stranger hosts); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 removed the 428 wall |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **8** (re-counted live 07-25 with the pinned grep; unchanged — this run's new stranger-test entry opens `Decided:` and so is a deferral, not a question) | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. De-prioritised as a default lever per the 07-11 /weekly (monoculture, no external yield); pullable only under a step-2 priority-3 waiver |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** (07-18 run-87 sweep: **121** pages, **2,970** internal + **14 cross-app** links). Bare paths now redirect **301**, not 307 (`SK-WEB-027`). Layered: built-output `href`/`src` sweep + cross-app subdomain verification + prod sitemap-200 check + `client-nav-integrity.test.ts` (SK-WEB-022) guarding `location.*` JS navigations **and** static `<a href="/literal">` source literals — dotted assets + dynamic `href={…}` skipped, negative-tested. Run 140 extended that file with the SK-ANON-015 handoff guard (row #21) | target 0 — `bun run build && bun run check:links` + `client-nav-integrity.test.ts` (in CI) |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **0 open** (claim-vs-reality on shipped surfaces + docs; target 0 **met**). Standing closed-world CI sweeps derive truth from source and name the phantom + file on failure: `mcp-tool-integrity` (`SK-MCP-002`), `cli-verb-integrity` (cobra tree), `sdk-method-integrity` (`SK-SDK-013`). All 0 phantom, negative-tested — no advertised-capability surface is web-only |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) · picker parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal; only genuine remaining slot is the premium chain |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **0/9 — the prior `9/9 ✅` was wrong, not stale** (live prod walk 07-25, [30143764445](https://github.com/nlqdb/nlqdb/actions/runs/30143764445)). verify-flows all-green · FLOW-005 walk 6/6 · stdio 22/22 — but **stranger-test 0 passed / 9 failed**, and the 07-24 cron had already exited **1** while this row read green. By cause: **FLOW-002 + FLOW-003 (6) failed at step 6** — the demo goal never reached the create input (`saveDraft` on `nlqdb.com` + a 301 to `app.nlqdb.com`; localStorage is per-origin) → **fixed this run**; **FLOW-001 (3) fail at step 5 on 428 `challenge_required`** — Turnstile declining a headless GH-Actions client, by design (prod sitekey verified live; *not* the run-56 outage). FLOW-002/003's submit step hits the same 428, so this row can't read 9/9 from CI until `RunState` gains `blocked` (decided, unbuilt — `stranger-test/FEATURE.md`) | target: 0 `failed`; instrument-blocked steps counted separately. A green *run* means nothing — `SK-STRG-003` exits 0 by design; read the per-walk lines now `tee`d into the job log |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 22 | Channels live with attributable yield | **4 live / 0 partial / 1 blocked-by-human / 16 untried** — organic search + dev.to + npm + GitHub, each carrying its ledger `utm_source` on every published URL: the dev.to read-through link (`…/blog/<slug>/?utm_source=devto`, API `canonical_url` left clean for SEO), the root README CTA, and both `examples/` README CTAs — GitHub strips referrers, so an untagged CTA there lands as `direct`; `readme-attribution-integrity.test.ts` fails on any untagged GitHub-rendered CTA. MCP official registry published 07-22 ([`com.nlqdb/nlqdb`](https://registry.modelcontextprotocol.io/v0.1/servers?search=com.nlqdb/nlqdb) v0.1.1, `websiteUrl` utm-tagged → ledger row #3 in-flight); crawl-fed Smithery/PulseMCP still not surfacing, Glama crawl-listed. First-touch attribution live since 07-19 on **both** the `/v1/ask` create arm and `POST /v1/db/connect`; `dbsWithSource` **0** (07-25 live) | **weekly focus: → ≥ 5 live.** Yield read from `/app/admin`, never estimated. Growth comes only from not-yet-live channels (registries R-05 `/reach`, human-norm venues) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/20 + 12 memory `/vs` pages | tick on merge; mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — the only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; E-03…E-07 all Neon/infra-gated |
| | Memory-quality eval (`SK-QUAL-023`) | **free-chain EX 93.33% (14/15)** — run 69, [GHA 29314389843](https://github.com/nlqdb/nlqdb/actions/runs/29314389843); p50 1168 ms / p95 7036 ms, `no_sql` 0. Per-axis: retrieval/forgetting/analytical/consolidation 3/3, **temporal 2/3** — the sole weak axis, pinned to one question (hallucinated `f.predicate='current_city'` + missing recency `ORDER BY … LIMIT 1`) | 15 gold-verified questions, 4 axes + analytical; free-only, no baseline emitted (measurement, not canonical). Analytical-vs-vector head-to-head still E-05 infra-gated |

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

**2026-07-25 (run 140)** — **Number moved: row #21 stranger-walker pass rate. The `9/9 ✅` it had
carried since 07-21 was false; measured 0/9 — and the product half is fixed.**

**How it hid.** `SK-STRG-003` keeps `acquisition-health.yml` green on purpose, and the walk also ran
`--quiet` with its summary going only to `$GITHUB_STEP_SUMMARY` (artifact download is proxy-gated from
the agent container) — so a failing walk emitted **zero bytes** into the only surface an agent can read.
The 07-24 cron exited **1**; three `/daily` runs recorded green anyway. Fixed first, so the measurement
could be trusted: no `--quiet`, summary `tee`d to stdout, each failing walk naming flow, persona, prompt
and failing steps.

**The real defect (`SK-ANON-015`, amended).** 6 of 9 walks failed because the three "Try this query"
CTAs each called `saveDraft(goal)` on `nlqdb.com` and then navigated to `/app/new/`, which **301s to
`app.nlqdb.com`** (`SK-AUTH-016`) — localStorage is per-origin, so the goal landed where the create form
can never read it. `SK-ANON-015` had shipped the `#nlq=` carrier for exactly this, but only the
*sign-in* arc was ever wired to it. `§10.2` code-wrong/decision-right: the three CTAs now navigate
through `attachHandoff`, and `app/new.astro` imports the fragment **before** `getOrMintAnonToken`, or a
fresh app-origin token wins the race and orphans the DB the visitor already started.

**Re-measure (rule 3).** Before: **0 passed / 9 failed**, FLOW-002/003 all reporting `nlqdb_draft
actual=<null>`. The prod re-walk lands after merge+deploy (the cron walks `nlqdb.com`, not a branch), so
the fix is pinned by tests that fail without it: a two-origin round-trip in `handoff.test.ts`, plus a
source sweep in `client-nav-integrity.test.ts` that fails **by filename** on a file holding prompt state
that navigates without `attachHandoff` — negative-tested by neutering each of the five senders in turn,
all five red. That guard is the point: nothing structural prevented this drift. Verified in a real
two-origin browser (marketing 301s `/app/*` to the app port): all three arcs land the goal, the fragment
is stripped, back/forward and reload hold, and a hostile-referrer `#nlq=` is rejected.

**Also closed this run.** `handoff.ts` capped prompt text on the receiver only, so any >4096-char prompt
was **silently dropped** — now one `normalize()` decides the cap for both sides, an oversize draft
truncates, and an oversize `pending` demotes to `draft` rather than replaying mangled (`SK-ANON-011`
amended). `lib/posthog.ts` strips the URL fragment from `$current_url`/`$referrer` so the anon **bearer**
cannot reach the analytics store even if capture beats the strip. FLOW-001's 3 remaining failures stay
**428 `challenge_required`** — Turnstile declining a headless Chromium on a GH-Actions IP, by design,
**not** a repeat of the run-56 fail-closed outage. Row #21 can't read 9/9 from CI until `RunState` gains
`blocked` — decided and recorded (`stranger-test/FEATURE.md`), next run's work.

**Other lanes.** GSC live: 6 clicks / 485 impr / pos 17.4, clicks flat an 8th read. Strangers **0**,
roster byte-identical. Row #15 rose 0.50 → **0.74** unaided (run 138's mcp fix merged). Engine dark +
fresh. Queue 2-deep (< 3) ⇒ no forced publish, no new draft; dev.to drip self-throttled — expected
no-op. **Gates:** `typecheck` (22 pkgs, 0 errors) · `lint` (exit 0) · `test` (20 pkgs exit 0, 992 api
tests + 9 new handoff/guard cases); web build clean, 126 pages. **D4:** `anonymous-mode/FEATURE.md` was
over cap, so `SK-ANON-015`'s body split into `decisions/SK-ANON-015-*.md` (3.8 KB) and the FEATURE
**net-shrank** 33353 → 31111 B; `scorecard.md` held under **20000 B** (strict decimal reading) by
compressing per-run prose, no rows dropped. **KPI (GLOBAL-025):** advances **onboarding** (the
first-query path now carries the goal it promised, on 69 pages) and **UX**; **degrades none**.

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
