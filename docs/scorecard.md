# Scorecard — current state

Point-in-time tracker, regenerated each
[`/daily`](../.claude/commands/daily.md) run. Current state only — no changelog
(≤20 KB cap). History: `git log` + `progress/quality-score-verification-log.md`.

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

**Worst number today:** **row #7's referral half was never measured — this run's lever.**
The row has carried "account-level RUM can't split per-path" for nine runs; it is false.
`rumPageloadEventsAdaptiveGroups` exposes `requestHost`, `requestPath`, `refererHost`,
`requestScheme` and `bot`, so `scripts/rum-pull.ts` (new, the `gsc-pull.ts` counterpart) now
reads referral yield live: **9 referral pageloads / 3 referrers / 5 landing surfaces, 7d.**
**Named next target, straight out of it:** **5 of those 9 land on `/security/hall-of-fame/`**, which
GSC independently ranks the site's **top click-earner (4 of 8 clicks, 28d)** — and that page renders
**2 internal links where peer pages render 21–22**, missing the site chrome entirely. The single
best-converting organic surface dead-ends.
Row #22 stays **4**; npm is fixed in-repo and un-broken for users only when `0.2.2` publishes
(release PR **#826**, open) — row #19 stays **1 open**. **Top `blocked-by-human` bullet:**
#1 fire the launch sequence (Show HN draft **idle 42 days since 06-13**) — the only queue
action that can move real strangers off 0; its age is the company's real cycle time. Queue depth
**9**, nothing added this run (no secret, console click or money was needed); cite queue bullets
by number — the roster lives only in [`blocked-by-human.md`](blocked-by-human.md).
**Dark (rule 8, reported not pulled):** engine **#9 Spider 0.2222** / **#8 BIRD 0.542** (offline
levers exhausted; the 7-day re-dispatch trigger fires **07-26**); rows **#4/#5/#16**'s
stranger-dependent criteria (N = 0 until queue bullet #1 fires); row **#15**'s opencheck arm
(free-lane saturation, remedy costs money ⇒ rule 4).

**Rule 6 clean** — CI + Security + Release-npm + all **9** `deploy-*` green as their latest `main`
run (each path-filtered, so its green sits on the last SHA that touched it).
Open PRs **3** — **#826** (changesets, `@nlqdb/sdk@0.2.2`), **#828** (Renovate never watched
`tests/`) and draft **#719** (oldest, **8 days**). **#824 merged mid-run**, so row #21 carries its
shipped `RunState.blocked` split re-read from `main` instead of pointing at an open PR; this run's
diff is otherwise `scripts/` + docs, and none of those six files is touched by any open PR.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (all re-measured live 07-25 ~17:26Z: CF GraphQL + remote-D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF RUM) | **237 pageloads / 227 visits** raw (07-18→07-25 live, `bun scripts/rum-pull.ts`, unsampled). **Real-browser floor 54 pl / 44 vis**; synthetic 183 pl. Flat vs ≈57, with no row-#2 signal behind it | the cut is now a printed rule, not a hand-computed one: `bot=1` or `userAgentBrowser ∈ {Unknown, ChromeHeadless}`, with **every removed row listed** so a real visitor it swallows is visible. Conservative ⇒ real-browser is a floor. Read this row at **7d**: a 28d pull comes back sampled (interval 10) and its counts are interval-quantised estimates, not exact |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (`*@example.com`, `*@preview.dev`) — live remote-D1 07-25, roster byte-identical; no channel newly live to produce a signal |
| 3 | DBs total | **254** (07-25 live remote-D1, flat vs run 143; synthetic — walker/preview churn) | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not measurable** (`SK-ONBOARD-007`). Attribution re-verified live 07-25: `databases.source_json is not null` = **0** | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12; founder-owned) | share ≥ 2 asks |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **104** content pages (`/solve` 37 + `/vs` 31 + `/blog` 36), re-counted from the live prod sitemap 07-25; **116** sitemap URLs total, **all 200** on a live sweep this run. Queue holds **2** — below the 3-deep forced-publish threshold | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **36**. **Google (GSC 28d, 06-25→07-23, live): 8 clicks / 503 impr / pos 17.5** — **clicks 6 → 8, the first move in 10 reads**; 101 pages / 590 impr. Strengthen-next, top 3 of 52 qualifying pages (impressions, pos > 10): **`/solve/running-total-cumulative-sum-in-sql/` 64 impr / pos 35.9 ← top target** · `/vs/wrenai` 49 / 15.9 · `/solve/find-rows-with-no-match-in-another-table/` 25 / 14.8. **First-party referral yield, new this run and previously unmeasurable: 9 pageloads / 3 referrers** — google 6, baidu 2, bing 1 — landing on **5** surfaces: `/security/hall-of-fame/` ×5, `/blog/bird-gold-noise-distinct/`, `/blog/`, `/blog/smoke-test-walks-the-old-ui/`, `/`. Sitemap 116 submitted / 0 indexed (a deprecated GSC field, always 0 — not a coverage signal) | `scripts/gsc-pull.ts` (Google side) + `scripts/rum-pull.ts` (first-party side). Total-impression breadth is still the bottleneck, not per-page CTR at N ≤ 12 impr (noise). **Both instruments agree on the anomaly** — see the hall-of-fame finding above |
| | **Engine** — BIRD 07-19 · Spider 07-19 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.542** (270/498 EA, 07-19 canonical on `2b3e4d2`, [run 29670818828](https://github.com/nlqdb/nlqdb/actions/runs/29670818828) — 6 `SK-QUAL-013` windows, `no_sql` 0/500). Flat vs the re-seeded baseline (Δ −0.40 pp, McNemar p=0.452). `run_at` 07-19 ⇒ **6 d old; re-dispatch trigger fires 07-26** | target 0.65 / **Phase 2 floor 0.60** — gap 5.8 pp. Offline levers exhausted; SC dead (#619); frontier-lens closed (run 15) |
| 9 | Spider raw EX | **0.2222** (30/135, 07-19 canonical on `04fa3d0`, [29682993836](https://github.com/nlqdb/nlqdb/actions/runs/29682993836); `no_sql` 0/135). Give-back from the reverted 0.2963 reading on a byte-identical engine ⇒ free-lane provider-mix noise, not a regression | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is its source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004)) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06, `SK-QUAL-022`) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69–0.70 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers analytics (live 07-25 16:22Z) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | **2,311 / 0** (0.00%) | mcp-server 1,112 req / 0 err; web 10,105 / 0; events-worker 6 / 0 |
| 13 | nlqdb-api wall-time p50 / p95 | **p50 9.2 ms / p95 1.40 s** | mcp-server p50 651 ms / p95 1.25 s. Read p95: the account-level distribution is dominated by cheap routes, so p50 is not `/ask` — an `/ask`-only split needs Grafana `metrics:read` (run 143's correction, re-confirmed) |
| 14 | $ spend | ~$0 | free tiers |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.68** (recomputed live 07-25 16:15Z; was 0.70 — pure time-decay, no suite changed state). Per suite `pass × freshness`: **sdk 0.89** · **examples 0.89** (both ✅ 07-24 22:12Z) · **mcp 0.92** (✅ 07-25 02:09Z) · **opencheck 0** ([30130304331](https://github.com/nlqdb/nlqdb/actions/runs/30130304331) ❌ Suite A 1/5 — 4/4 agent-lane `rate-limit error` after a green pre-flight: the documented NVIDIA-free-tier saturation flake, remedy costs money ⇒ rule 4). Purely opencheck-limited; the other three decay ~0.14/day | Never dispatch opencheck alongside another consumer of its lanes. Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.542); agentic-frontier ≥ 0.80 (0.693); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (stranger N=0); destructive-op retry (N≈0); MCP in 3+ host apps (0); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 removed the 428 wall |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **9** (re-counted live 07-25 with the pinned grep; flat) | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. De-prioritised as a default lever per the 07-11 /weekly; pullable only under a step-2 priority-3 waiver |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** (07-18 run-87 sweep: **121** pages, **2,970** internal + **14 cross-app** links), and **116/116 prod sitemap URLs 200** on a live sweep this run. **Three blind spots named:** ≥ 107 Google impressions land on bare paths that 301 (`SK-WEB-027`) — an *external* inbound link is not an internal one; this row sweeps *links*, never whether a published npm entrypoint resolves (row #19); and **it enumerates paths, never hosts** — measured this run, `https://www.nlqdb.com/solve/` serves the whole site on a second hostname with no redirect to apex (bounded: `rel=canonical` is absolute to apex, so Google consolidates) | target 0 — `bun run build && bun run check:links` (built-output) + `client-nav-integrity.test.ts` (in CI) |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **1 open, fixed in-repo, awaiting republish.** Every surface telling a reader to `npm i @nlqdb/sdk` is still lying on the registry: 0.1.0 / 0.2.0 / 0.2.1 all throw `ERR_MODULE_NOT_FOUND`. #823 fixed the manifests and guarded them (`npm-tarball-entrypoint-integrity.test.ts`); returns to 0 when **`0.2.2` reaches the registry — release PR #826 is open and unmerged**. The standing 0-phantom sweeps (`mcp-tool-integrity`, `cli-verb-integrity`, `sdk-method-integrity`) are unchanged | target 0 |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) + parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **0 failed / 9 blocked** — no product failure on any canonical flow (live prod walk 07-25, [30159902837](https://github.com/nlqdb/nlqdb/actions/runs/30159902837)); verify-flows ✅ · FLOW-005 6/6 ✅ · stdio 22/22 ✅. All 9 walks stop at the **428 `challenge_required`** step — Turnstile declining a headless GH-Actions client by design (`SK-ANON-012`), scored `blocked` per `SK-STRG-010` (#824, merged) instead of `failed`. 0 `passed` is expected from CI and **not** a defect: no walk can complete the `/v1/ask` arm from a datacenter IP — so the steps *past* the ask have still never run, and "0 failed" is **observed, not proven**. Run 140's handoff fix is confirmed by progression: FLOW-002/003 died at step 6 (`nlqdb_draft actual=<null>`) and now reach steps 9/8 | target: **0 `failed`** ✅ — met; `blocked` is reported beside it, never folded in. A green *run* still means nothing (`SK-STRG-003` exits 0 by design): read the per-walk `FAILED`/`BLOCKED` lines `tee`d into the job log |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 22 | Channels live with attributable yield | **4 live** — organic search + dev.to + npm + GitHub (per-bucket split lives only in the ledger). Each carries its ledger `utm_source` in-repo; **npm's does not reach the registry** and the install itself is broken (row #19) until #826 merges. MCP official registry published 07-22 (`com.nlqdb/nlqdb` v0.1.1, ledger row #3 in-flight); Glama crawl-listed; Smithery 0 / PulseMCP 0 (#822's measurement stands). First-touch attribution live since 07-19 on both create arms — and verified structurally this run: **all 25 `apps/web` pages render through `Base.astro`** (directly or via `Legal.astro`), so no landing surface can drop a `utm_source`. `source_json` non-null **0**, for want of strangers, not instrument | **weekly focus: → ≥ 5 live.** Yield from `/app/admin` + `scripts/rum-pull.ts`, never estimated. Growth comes only from not-yet-live channels (R-05 registries, human-norm venues) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/20 + 12 memory `/vs` pages | mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; rest Neon/infra-gated |
| | Memory-quality eval (`SK-QUAL-023`) | **free-chain EX 93.33% (14/15)** — run 69, [GHA 29314389843](https://github.com/nlqdb/nlqdb/actions/runs/29314389843); p50 1168 ms / p95 7036 ms. Per-axis 3/3 except **temporal 2/3** — the sole weak axis, one question (hallucinated predicate + missing recency `ORDER BY`) | 15 gold-verified questions, 4 axes + analytical; free-only, no baseline. Analytical-vs-vector head-to-head still E-05 infra-gated |

## Shipped distribution

**36 canonical posts live under `nlqdb.com/blog/`** (`SK-BLOG-001`). The registry
is `apps/web/src/data/blog.ts` — the one place the list exists; venue variants and
full lesson gists stay in `research/distribution-queue.md`.

## Last change

**2026-07-25 (run 144)** — **Number moved: row #7's referral yield — externally-referred
pageloads attributable to a named landing surface: 0 measurable → 9, across 3 referrers and 5
surfaces.** Lane: acquisition & distribution (step-2 priority 1, "make its yield attributable").
Row #1's walker cut moves from hand-applied to script-computed in the same read.

**The defect (P2).** Both halves rested on a false premise. Introspected live,
`AccountRumPageloadEventsAdaptiveGroupsDimensions` exposes `requestPath`, `refererHost`,
`requestScheme`, `bot`, `countryName` and `deviceType`; the dashboard's account-level view is a
*view*, not the API's ceiling. The one thing `/daily` step 1 asks for by name — "referral visits
landing on the shipped surfaces" — was one query away for nine runs.

**Fix.** `scripts/rum-pull.ts`, the `gsc-pull.ts` counterpart — both now share one curl transport
(`scripts/lib/curl.ts`) rather than a second copy of the same proxy reasoning, and **no new token
scope** (RUM is account analytics, not zone settings; verified by running it). One grouping over
every dimension, every section a fold over those same rows, so two sections can never disagree
about one pageload. **Every section prints its own row count** and the `rowLimit` cap notice rides
all of them, so none can show N of M under a countless header; the synthetic-cut listing is
uncapped, because its header claims completeness.

**The synthetic cut is a stated rule, not a hand-wave.** `bot=1` or
`userAgentBrowser ∈ {Unknown, ChromeHeadless}` — measured, not asserted: the `Unknown` pageloads sit
on exactly the walker's canonical flow set, bar two or three CN/CA stragglers that are probably real
people with a UA Cloudflare can't map. It therefore **under**-counts humans, so real-browser is
labelled a floor and every removed row is printed. Cloudflare's own `bot` flag catches just **2 of
237** and never sees the walker, so it cannot replace the UA-class rule.

**Sampling — corrected under review (P2).** A 28d pull returns `sampleInterval 10` with every count
an exact multiple of 10: Cloudflare's adaptive `count` is **already extrapolated** server-side
(`count == sampleSize × avg(sampleInterval)`, per CF's confidence-intervals example), so the first
draft's *"multiply by the interval"* would have inflated the published number **10×**. Sampled
counts are now reported as interval-quantised estimates, and row #1 is read at 7d, where the
interval is 1 and counts are exact.

**Verification (rule 3).** Re-ran live after every edit; the referral figures reproduce. Raw 237 pl
matches the ad-hoc GraphQL read, real-browser 54 pl reconciles with the hand-computed ≈54–57, and
the two independent instruments **agree on the anomaly** — `/security/hall-of-fame/` is at once
GSC's top click-earner (4 of 8 clicks) and 5 of 9 referral landings, yet its live prod HTML carries
**2** internal links (`/`, `/auth/sign-out/`) against **22** and **21** on the `/solve` and `/blog`
pages measured. `Base.astro` renders no nav and no footer, so chrome comes only from per-page
templates and this page supplies none. Named next target, computed rather than eyeballed.

**Also surfaced, recorded not fixed** (one lever per run): `https://www.nlqdb.com/solve/` serves the
full site on a second hostname with **no redirect to apex** — row #18 enumerates paths, never hosts;
bounded, since `rel=canonical` is absolute to apex. The plaintext `http` pageloads quantify
[`GLOBAL-039`](decisions/GLOBAL-039-https-only-hsts.md)'s residual gap for the first time; its zone
toggle stays human-blocked (queue bullet #8, re-verified live — the CF token still returns
`Authentication error`). And `scripts/` is outside `bun run typecheck`, so the new script was
type-checked against `tsconfig.base.json` out-of-band and left clean; widening the gate would
surface 7 pre-existing errors in the two older scripts, so that is separate work.

**No new `SK-*`:** the mechanism is a reporting script whose header documents it and whose output
prints its own rules; restating that in a decision record fails **D5**. Step 3: the queue is
**2**-deep (< 3) so no forced publish, and the dev.to drip self-throttled (the expected no-op).

**Gates:** `typecheck` 22 packages, exit 0 · `lint` **0 errors, 41 warnings, 2 infos = baseline**,
`biome format` clean · `test` exit 0. Gate 3: `grep -rn '^### GLOBAL-' docs/features/` prints
nothing. **D4:** every edited doc under **20000 B**. **KPI (GLOBAL-025):** advances **onboarding**
— the funnel's first step now has a first-party instrument, so the next channel that delivers a
visitor produces a number instead of a shrug; **degrades none** — no runtime code, endpoint,
migration, external call or bundle changed.

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
