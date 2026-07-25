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

**Worst number today:** **row #22's npm channel was dead on arrival — this run's lever.**
`@nlqdb/sdk` has been unimportable from npm since its first release, so 1 of only 4 live channels
converted visitors into an `ERR_MODULE_NOT_FOUND`. Fixed in-repo + guarded; **the registry stays
broken until `0.2.2` publishes** (row #19, corrected 0 → 1 open). **Row #21 improved and is no
longer product-broken:** the first post-fix walk (dispatched this run) shows run 140's fix working —
FLOW-002/003 advanced from step 6 to steps 9/8 — and all 9 remaining failures are now the single
Turnstile 428 instrument limit, so `RunState.blocked` is the only thing left between this row and
green. Row #16 Phase-2 gate 1/9; engine (**#9 Spider 0.2222**, **#8 BIRD 0.542**) dark and **fresh
for one more day** (baseline `run_at` 07-19 = 6 d; the 7-day dispatch trigger fires 2026-07-26).
**Top `blocked-by-human` bullet:** #1 fire the launch sequence (Show HN draft **idle 42 days since
06-13**) — the only queue action that can move real strangers off 0; its age is the company's real
cycle time. Queue depth **7**: launch (#1), mcp.so / cursor.directory / awesome-mcp / Claude-dir
(#2–#5, account-walled), GLOBAL-039 zone toggle (#6), CI-as-required-check (#7).

**Rule 6 clean** (CI + Security + Release-npm **and all 9 `deploy-*` workflows** `success` on `main`
`705ded0` — correcting the long-carried "8"; `deploy-*.yml` is 9 files, and
`coming-soon`/`elements`/`events-worker`/`mcp` are path-filtered, so their latest green sits on an
older SHA rather than being a skip). **Step 0:** open PRs **3** — #822 (reach R-07: `packages/mcp`,
`.changeset/README.md`, `acquisition-channels.md`, `blocked-by-human.md`), #821 (run 141:
`scripts/gsc-pull.ts`), draft #719 (oldest, **8 days**). This run touches none of their files; #822
explicitly left the SDK defect as "the next `/daily` lever". Only `scorecard.md` overlaps #821 —
step-1 exempt.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (all re-measured live 07-25 ~10:40Z: CF GraphQL + remote-D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | **173 pageloads** (07-18→07-25 live, raw). Walker filter (`userAgentBrowser` cut): "Unknown" 115 + BingBot 1 ⇒ **real-browser ≈ 57** (Chrome 32 + ChromeMobile 14 + Edge 5 + Firefox 4 + MobileSafari 2) — flat vs ≈56, with no row-#2 signal behind it | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (`*@example.com`, `*@preview.dev`) — live remote-D1 07-25, roster byte-identical (oldest 04-25, newest 07-06); no channel newly live to produce a signal |
| 3 | DBs total | **254** (07-25 live remote-D1, flat vs 07-24; synthetic — walker/preview churn) | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not measurable** (`SK-ONBOARD-007`). Attribution re-verified live 07-25: `databases.source_json is not null` = **0** | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12; founder-owned) | share of DBs ≥ 2 asks |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **104** content pages (`/solve` 37 + `/vs` 31 + `/blog` 36), re-counted from the live prod sitemap 07-25; **116** sitemap URLs total (104 + 3 section indexes + 9 static). Queue holds **2** — below the 3-deep forced-publish threshold | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **36** live; **GSC 28d (06-25→07-23, live 07-25): 6 clicks / 485 impr / avg pos 17.4** — clicks flat a **9th** consecutive read. 5 click-earning pages: `/security/hall-of-fame/` (2), homepage, `/architecture/`, `/blog/bird-gold-noise-distinct/`, and `/solve/count-rows-per-day-including-missing-dates/` (**66 impr / pos 7.8**, on-page-maxed). **Caveat:** this is `main`'s `gsc-pull.ts`, capped at `rowLimit: 20` ordered by *clicks* — at 6 clicks that ordering is noise and hides most impression mass; open PR **#821** re-ranks by impressions and is the instrument to trust once merged. `http://…streak-in-sql/` (7 impr / pos 10.1) still needs the zone toggle (`blocked-by-human` #6). sitemap 116 submitted / **0 indexed** | GSC via `scripts/gsc-pull.ts`. Impression breadth is the bottleneck, not per-page CTR at N≤12 impr (noise) |
| | **Engine** — BIRD 07-19 · Spider 07-19 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.542** (270/498 EA, 07-19 canonical on `2b3e4d2`, [run 29670818828](https://github.com/nlqdb/nlqdb/actions/runs/29670818828) — 6 `SK-QUAL-013` windows, `no_sql` 0/500). Flat vs the re-seeded baseline (Δ −0.40 pp, McNemar p=0.452). `run_at` 07-19 ⇒ **6 d old; re-dispatch trigger fires 07-26** | target 0.65 / **Phase 2 floor 0.60** — gap 5.8 pp. Offline levers exhausted; SC dead (#619); frontier-lens closed (run 15) |
| 9 | Spider raw EX | **0.2222** (30/135, 07-19 canonical on `04fa3d0`, [29682993836](https://github.com/nlqdb/nlqdb/actions/runs/29682993836); `no_sql` 0/135). Give-back from the reverted 0.2963 reading on a byte-identical engine ⇒ free-lane provider-mix noise, not a regression. p50 1.52 s / p95 10.9 s | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is its source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004)) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06, `SK-QUAL-022`). persona-bench −4.35 pts (07-09, one-question noise at N=23) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69–0.70 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers analytics (carried from the 07-25 07:2xZ pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | **2,169 / 0** (0.00%) | mcp-server 851 req / 0 err; web 10,013 / 0; events-worker 6. Zero errors on every script. Deploy health is in the Rule-6 line above |
| 13 | nlqdb-api wall-time p50 / p95 | p50 ≈ 0.61 s / p95 ≈ 1.70 s | mcp-server p95 ≈ 755 ms; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.70** (recomputed live 07-25 10:40Z; was 0.74 — pure time-decay, no suite changed state). Per suite `pass × freshness`: **sdk 0.93** · **examples 0.93** (both ✅ 07-24 22:12Z) · **mcp 0.95** (✅ 07-25 02:09Z) · **opencheck 0** ([30130304331](https://github.com/nlqdb/nlqdb/actions/runs/30130304331) ❌ Suite A 1/5 — all 4 failures `TEST_FAILED: rate-limit error` on the agent lane after a green pre-flight: the documented NVIDIA-free-tier saturation flake, remedy costs money ⇒ rule 4). Purely opencheck-limited; the other three decay ~0.14/day | |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.542); agentic-frontier ≥ 0.80 (0.693); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (stranger N=0); destructive-op retry (N≈0); MCP in 3+ host apps (0); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 removed the 428 wall |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **9** (re-counted live 07-25 with the pinned grep; **+1 vs the 8 carried** — run 140 opened `anonymous-mode`'s per-file-vs-per-navigation nav-guard question, a genuine unknown, not a deferral) | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. De-prioritised as a default lever per the 07-11 /weekly; pullable only under a step-2 priority-3 waiver |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** (07-18 run-87 sweep: **121** pages, **2,970** internal + **14 cross-app** links). Bare paths redirect **301**, not 307 (`SK-WEB-027`). Layered: built-output `href`/`src` sweep + cross-app subdomain verification + prod sitemap-200 check + `client-nav-integrity.test.ts` (SK-WEB-022, negative-tested). **Scope note:** this row sweeps *links*; it has never covered whether a published npm entrypoint resolves (row #19) | target 0 — `bun run build && bun run check:links` + `client-nav-integrity.test.ts` (in CI) |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **1 open, fixed in-repo, awaiting republish** — correcting a long-carried "0 open". Three live surfaces tell a reader to `npm i @nlqdb/sdk` and `import { createClient } from "@nlqdb/sdk"`: `docs.nlqdb.com/sdk`, the nlqdb.com integrate snippet (`data/integrate.ts`), and `packages/sdk/README.md` — **which npm renders on the package page itself**. Verified live 07-25 by installing from the registry: every published version (0.1.0 / 0.2.0 / 0.2.1) throws `ERR_MODULE_NOT_FOUND`, so the claim was false on all three. This run makes the *next* publish correct and guards it; the row returns to 0 when `0.2.2` reaches the registry (needs this PR **and** the changesets Version PR merged). Standing sweeps unchanged, 0-phantom: `mcp-tool-integrity`, `cli-verb-integrity`, `sdk-method-integrity` — none looks at the tarball, which is how this survived | target 0 |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) + parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal; only genuine remaining slot is the premium chain |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **0/9 — but 0 product failures now; all 9 are the one instrument limit.** First **post-fix** walk dispatched this run ([30154906928](https://github.com/nlqdb/nlqdb/actions/runs/30154906928), 10:42Z on `705ded0`) instead of assuming run 140's fix landed, and read from the job log, not the conclusion. **Run 140's fix is confirmed by progression:** FLOW-002/003 previously died at **step 6** (`nlqdb_draft actual=<null>` — goal lost across the `nlqdb.com`→`app.nlqdb.com` origin split); they now reach **steps 9 and 8**, i.e. the goal arrives and the DB is created. Every one of the 9 failures is now `status=428 challenge_required` at the ask — Turnstile declining a headless GH-Actions client, by design (FLOW-001 step 5, FLOW-002 step 9, FLOW-003 step 8). ttfv p50 379 ms / p95 801 ms. verify-flows ✅ · FLOW-005 6/6 ✅ · stdio 22/22 ✅. This row cannot read 9/9 from CI until `RunState` gains `blocked` (decided, unbuilt — `stranger-test/FEATURE.md`); that build is now the only thing between it and green | target: 0 `failed`; instrument-blocked steps counted separately. A green *run* means nothing — `SK-STRG-003` exits 0 by design; read the per-walk lines `tee`d into the job log |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 22 | Channels live with attributable yield | **4 live / 0 partial / 1 blocked-by-human / 16 untried** — organic search + dev.to + npm + GitHub, each carrying its ledger `utm_source` on every published URL. **npm's arrival was broken for its whole life** (row #19): discovery was attributable, the install unusable. Fixed in-repo this run; honestly "live" only once `0.2.2` publishes. MCP official registry published 07-22 ([`com.nlqdb/nlqdb`](https://registry.modelcontextprotocol.io/v0.1/servers?search=com.nlqdb/nlqdb) v0.1.1, ledger row #3 in-flight); Glama crawl-listed; **#822 measured Smithery 0 / PulseMCP 0 live and corrected the "auto-ingests the registry" assumption** — its ledger rewrite is the current truth once merged. First-touch attribution live since 07-19 on both the `/v1/ask` create arm and `POST /v1/db/connect`; `source_json` non-null **0** | **weekly focus: → ≥ 5 live.** Yield from `/app/admin`, never estimated. Growth comes only from not-yet-live channels (R-05 registries, human-norm venues) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/20 + 12 memory `/vs` pages | mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; rest Neon/infra-gated |
| | Memory-quality eval (`SK-QUAL-023`) | **free-chain EX 93.33% (14/15)** — run 69, [GHA 29314389843](https://github.com/nlqdb/nlqdb/actions/runs/29314389843); p50 1168 ms / p95 7036 ms. Per-axis 3/3 except **temporal 2/3** — the sole weak axis, one question (hallucinated predicate + missing recency `ORDER BY … LIMIT 1`) | 15 gold-verified questions, 4 axes + analytical; free-only, no baseline emitted. Analytical-vs-vector head-to-head still E-05 infra-gated |

## Shipped distribution (live URLs)

Canonical copies on `/blog` (`SK-BLOG-001`) — **36 posts, registry is
`apps/web/src/data/blog.ts`** (row #6), all live under `/blog/`; venue variants
+ full lesson gists stay in `research/distribution-queue.md`. Listing them here
too was a second copy of that registry, so it is dropped (D5).

## Last change

**2026-07-25 (run 142)** — **Number moved: publishable packages whose published entrypoints are
reachable inside their own tarball — 1/2 → 2/2. `@nlqdb/sdk` has been impossible to import from
npm since its first release.** Row #22's npm channel and row #19's claim integrity are the rows
this sits under; row #19 is corrected 0 → 1 open (fixed in-repo, republish pending).

**The defect.** Every published version — 0.1.0, 0.2.0, 0.2.1 — declares
`main`/`types`/`exports` → `./src/index.ts` while `files` ships only `dist/`. Verified against the
live registry, not inferred: `npm i @nlqdb/sdk` into an empty dir, then
`import("@nlqdb/sdk")` → **`ERR_MODULE_NOT_FOUND … /node_modules/@nlqdb/sdk/src/index.ts`**. So
[`GLOBAL-001`](decisions.md)'s "the only HTTP client" could not be imported by anyone outside this
repo, while `typecheck`, `lint`, `test`, `build` and the release job all stayed green — the defect
lives in the gap between the manifest and the tarball, which none of them read.

**Root cause (P2, web-researched).** The corrected entrypoints *were* declared, in `publishConfig`
— but overriding package.json fields from there is a **pnpm** feature that npm ignores
([npm/cli#7586](https://github.com/npm/cli/issues/7586), still open; Zod's author publicly
retracted the same advice). It is a silent no-op, so the block read as a fix for months.

**Fix, and the one rejected.** The workspace must keep resolving to `src/` — proved, not assumed:
pointing the real fields at `dist/` turns `typecheck` green but breaks **5 packages** at runtime
(`nuxt`, `next`, `mcp`, `web`, `mcp-server` — Vite and Bun both refuse a nonexistent `dist/`;
`tsconfig.base.json`'s `paths` is why `tsc` alone didn't notice). Custom export conditions are the
tidier mechanism but need `customConditions` + `resolve.conditions` in six vitest/astro configs +
`--conditions` on every `bun` call. Instead a 2-line `prepack`/`postpack` pair
(`scripts/apply-publish-config.mjs`) applies the existing `publishConfig` overrides at pack time —
npm's own documented workaround — so the working tree is untouched and the tarball is correct.

**Re-measured the same way (rule 3).** Built + `npm pack`ed: tarball manifest `main ./dist/index.js`,
working tree still `./src/index.ts`, no backup file left behind. Installed that tarball into an
empty dir and ran it under **node 22**: `import` **OK** (`createClient`, `NlqdbApiError`),
`createClient(...)` constructs with all methods, and a TS consumer typechecks clean against
`dist/index.d.ts`. The registry copy still throws in the same shell. Guarded by
`npm-tarball-entrypoint-integrity.test.ts` (2 tests, +2 in the web suite 393 → 395), which asserts
every publishable package's *effective* published entrypoints fall inside its own `files` —
negative-tested 3 ways: drop the prepack pair, drop `publishConfig` (reproducing the shipped 0.2.1
manifest → `src/index.ts not matched by files=[dist]`), and point `@nlqdb/cli`'s `bin` astray. All
three fail with the offending file and paths named. **`@nlqdb/cli` was already correct.**
**Not yet fixed for users:** the registry stays broken until `0.2.2` publishes, which needs this PR
*and* the changesets Version PR merged — the changeset is included.

**Deliberately not done.** `.changeset/README.md`'s un-gate template teaches pointing real fields at
`dist/`, which this supersedes — but that file is open PR **#822**'s active territory (step 0), so
it is flagged for the next run rather than conflicted. No new `SK-*`: the mechanism is enforced by
the guard and documented in the script header, `sdk/FEATURE.md` is **over** the D4 cap (20140 B),
and restating what a test pins fails **D5**.

**Also measured, not pulled.** Dispatched the first **post-fix** stranger walk rather than trust run
140's claim: it confirms that fix by progression — FLOW-002/003 moved from step 6 to **steps 9/8**,
so the goal now survives the origin split — and reduces row #21 to **0 product failures, 9
instrument-blocked** on one Turnstile 428. `RunState.blocked` is the only remaining work there, and
it belongs to `stranger-test`, not here. Strangers **0**, roster byte-identical; DBs 254; visits
≈57 real-browser; GSC flat a 9th read. Row #15 **0.74 → 0.70** on time-decay alone; row #17
**8 → 9** (run 140 opened a genuine nav-guard unknown). Queue 2-deep ⇒ no forced publish; dev.to
drip self-throttled.
**Gates:** `typecheck` (22 pkgs, 0 errors) · `lint` (**0 errors, 41 warnings = baseline exactly**)
· `test` (all packages exit 0; 992 api, 395 web). **KPI (GLOBAL-025):** advances **onboarding**
(the documented install path becomes real) and **engine quality** is untouched; **degrades none** —
no runtime code, endpoint, migration, external call or bundle changed.

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
