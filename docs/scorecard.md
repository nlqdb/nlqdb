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

**Worst number today:** **row #2 real strangers 0** — and its only mover is
founder-blocked: `blocked-by-human` **#1 fire the launch sequence** (Show HN draft
**idle 42 days since 06-13**), whose age is the company's real cycle time. Queue depth **9**
(re-derived after #822 merged): launch (#1), npm bootstrap-publish `@nlqdb/mcp` (#2), Smithery
(#3), mcp.so / cursor.directory / awesome-mcp / Claude connector dir (#4–#7, account- or
plan-walled), zone toggle (#8), CI-as-required-check (#9). **Dark (rule 8, reported not pulled):**
engine **#9 Spider 0.2222** / **#8 BIRD 0.542** (offline levers exhausted; baseline `run_at` 07-19
= 6.4 d, so the 7-day dispatch trigger fires **07-26**, not today); rows **#4/#5/#16**'s
stranger-dependent criteria (N = 0 by definition until #1 fires); row **#15**'s opencheck arm
(free-lane saturation; the remedy costs money ⇒ rule 4). Row **#21 is no longer saturated** —
this run split *failed* from *blocked*, and it now reads **0 failed / 9 blocked**.

**Rule 6 clean** (verified before the first edit on `main` `705ded0`, then **re-verified after
#821 merged**: CI + Security + Release-npm `success` on `cb53f29`; each `deploy-*` is
path-filtered, so its green sits on the last SHA that touched it — api/web/canary `705ded0`,
`deploy-docs` `bb85ccf`, `deploy-cli` `aad87a7`, `deploy-mcp` `97d7712` — and #821 touched none
of their paths.) **Step 0:** this run touched **none** of the other PRs' files — #823
(`packages/sdk`, `scripts/apply-publish-config.mjs`, `.changeset/`), #822 (`packages/mcp`,
`.changeset/README.md`, `acquisition-channels.md`, `blocked-by-human.md`), draft #719 — the only
overlap is the step-1-exempt `scorecard.md`. **#821 and #822 both merged mid-run**, so this file
was rebased onto each and every number they own was re-read from source: row #7's GSC breadth,
the queue depth, row #22's mix.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (all re-measured live 07-25: CF GraphQL + remote-D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | **175 pageloads** (07-18→07-25 live, raw). Walker filter (`userAgentBrowser` cut): "Unknown" 121 + BingBot 1 ⇒ **real-browser ≈ 53** (Chrome 29 + ChromeMobile 13 + Edge 5 + Firefox 4 + MobileSafari 2) — ≈ flat vs 56–57 on the prior window, with no row-#2 signal behind it | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | **0** | 9 total = 4 founder/company (`hi@nlqdb.com`, 2× `omer.hochman@*`, `omer@salfati.group`) + 5 test/dev (`*@example.com`, `*@preview.dev`) — full roster re-read live remote-D1 07-25, **byte-identical**; no acquisition channel newly live to produce a signal |
| 3 | DBs total | **254** (07-25 live remote-D1, flat; synthetic — walker/preview churn, previews share prod D1) | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not yet measurable** (method `SK-ONBOARD-007`). Attribution re-verified live 07-25: `source_json` non-null = **0** (accrues from the first attributable visit) | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12 19:41Z; founder-owned) | share of DBs with `first10_asks ≥ 2` |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **104** content pages (`/solve` 37 + `/vs` 31 + `/blog` 36; recounted from source 07-25, 116 sitemap URLs total). Queue holds **2** drafts — below the 3-deep forced-publish threshold | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | **GSC 28d (06-25→07-23, live 07-25): 6 clicks / 485 impr / avg pos 17.4** — clicks flat a **10th** consecutive read. 5 click-earning pages: `/security/hall-of-fame/` (2), homepage, `/architecture/`, `/blog/bird-gold-noise-distinct/`, `/solve/count-rows-per-day-including-missing-dates/` (66 impr / pos 7.8). **That pull was `main`'s pre-#821 `rowLimit: 20` instrument, which sees only ~28% of impression mass, so read the fuller figure #821 measured and has since merged: 100 pages / 572 impr, whose true strengthen-next target is `/solve/running-total-cumulative-sum-in-sql/` (57 impr / pos 36.0) — not `/solve/count-rows-per-day…`, already page 1 at pos 7.8 yet recorded here as the top opportunity for weeks.** Bare (unslashed) paths carry ≥ 107 impr, each splitting signal with its slashed twin (#817's 301 landed 07-25); the `http://…streak-in-sql/` variant (7 impr / pos 10.1) still needs the zone toggle (`blocked-by-human` #8). Sitemap 116 submitted / 0 indexed. Internal links **2,970** + **14 cross-app**, 0 dead / 0 redirecting (row #18) | GSC via `scripts/gsc-pull.ts`. Impression breadth is the bottleneck, not per-page CTR at N ≤ 12 impr (noise) |
| | **Engine** — BIRD 07-19 · Spider 07-19 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.542** (270/498 EA, 2 `gold_error`, 1 `exec_error`, 07-19 canonical, [run 29670818828](https://github.com/nlqdb/nlqdb/actions/runs/29670818828) — 6 `SK-QUAL-013` windows, `no_sql` 0/500). Flat vs the re-seeded baseline (Δ −0.40 pp, McNemar p=0.452) | target 0.65 / **Phase 2 floor 0.60** — gap 5.8 pp. Offline levers exhausted; SC dead (#619); frontier-lens closed (run 15) |
| 9 | Spider raw EX | **0.2222** (30/135, 07-19 canonical, [29682993836](https://github.com/nlqdb/nlqdb/actions/runs/29682993836); 3 windows, `no_sql` 0/135, exec_error 5). Give-back from the reverted 0.2963 reading on a byte-identical engine ⇒ free-lane provider-mix noise, not a regression. p50 1.52 s / p95 10.9 s | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is its source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004) — flat vs 07-02) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06 run 15, `SK-QUAL-022`). persona-bench −4.35 pts (07-09, one-question noise at N=23) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69–0.70 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers `workersInvocationsAdaptive` (live 07-25 pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | **2,229 / 0** (0.00%, 7d live 07-25) | mcp-server 998 req / 0 err; web 10,592 req / 0 err; events-worker 6 req / 0 err. Zero errors on every script |
| 13 | nlqdb-api wall-time p50 / p95 | **p50 4.0 ms / p95 1.45 s** (live 7d; raw µs 4,026 / 1,448,678). **Correction:** the long-carried "p50 ≈ 0.61 s" does not reproduce — the account-level distribution is dominated by cheap routes (preflight / health / 404), so p50 is not an `/ask` figure. mcp-server p50 646 ms / p95 1.26 s | an `/ask`-only split still needs Grafana `metrics:read` — until then read p95, not p50 |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.69** (recomputed live 07-25; 0.74 on 07-24 — pure time-decay, no suite moved). Per suite `pass × freshness`: **mcp 0.93** (✅ 07-25) · **sdk 0.91** · **examples 0.91** (both ✅ 07-24) · **opencheck 0** ([30130304331](https://github.com/nlqdb/nlqdb/actions/runs/30130304331) ❌ 07-24, last success 07-17: 4 × `TEST_FAILED: rate-limit error` on the agent lane after a green pre-flight — the documented NVIDIA-free-tier saturation flake, whose remedy costs money ⇒ rule 4). Purely opencheck-limited |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.542); agentic-frontier ≥ 0.80 (0.693, Δ 18.66 ✓); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (stranger N=0); destructive-op retry < baseline (N≈0); MCP in 3+ host apps (0 stranger hosts); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 removed the 428 wall |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **9** (re-counted live 07-25 with the pinned grep; unchanged — this run *retired* the stranger-test `Decided:` bullet by building it, and `Decided:` lines were already excluded, so the count is flat by construction) | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. De-prioritised as a default lever per the 07-11 /weekly (monoculture, no external yield); pullable only under a step-2 priority-3 waiver |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** (07-18 run-87 sweep: **121** pages, **2,970** internal + **14 cross-app** links). Bare paths redirect **301**, not 307 (`SK-WEB-027`). Layered: built-output `href`/`src` sweep + cross-app subdomain verification + prod sitemap-200 check + `client-nav-integrity.test.ts` (SK-WEB-022) guarding `location.*` JS navigations, static `<a href="/literal">` source literals, **and** the SK-ANON-015 handoff senders — dotted assets + dynamic `href={…}` skipped, negative-tested | target 0 — `bun run build && bun run check:links` + `client-nav-integrity.test.ts` (in CI) |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **1 open** — open PR #823 measured `@nlqdb/sdk` **unimportable from npm at every published version** (`main`/`exports` → `src/index.ts`, `files` ships only `dist/`), while `docs.nlqdb.com/sdk`, the integrate snippet and the npm-rendered README all advertise that path. Fixed in-repo there, **still broken for users until `0.2.2` publishes** — so this row stays 1, not 0. Standing closed-world CI sweeps remain 0-phantom: `mcp-tool-integrity` (`SK-MCP-002`), `cli-verb-integrity`, `sdk-method-integrity` (`SK-SDK-013`) | target 0 |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) · picker parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal; only genuine remaining slot is the premium chain |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **0 failed / 9 blocked** — no product failure on any canonical flow (live prod walk 07-25, [30159902837](https://github.com/nlqdb/nlqdb/actions/runs/30159902837)); verify-flows all-green · FLOW-005 walk 6/6 · stdio 22/22. All 9 walks stop at the **428 `challenge_required`** step — Turnstile declining a headless GH-Actions client by design (`SK-ANON-012`), now scored `blocked` per `SK-STRG-010` instead of `failed`. 0 `passed` is therefore expected from CI and **not** a defect: no walk can complete the `/v1/ask` arm from a datacenter IP. Run 140's handoff fix is confirmed by progression — FLOW-002/003 previously died at step 6 (`nlqdb_draft actual=<null>`) and now reach steps 9/8 | target: **0 `failed`** ✅ — met. `blocked` is reported beside it, never folded in. A green *run* still means nothing (`SK-STRG-003` exits 0 by design): read the per-walk `FAILED`/`BLOCKED` lines `tee`d into the job log |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 22 | Channels live with attributable yield | **4 live / 4 in-flight / 5 blocked-by-human / 8 untried** (the 21 ledger rows; re-read from the ledger after #822 merged — the mix this row carried summed to 17) — organic search + dev.to + npm + GitHub, each carrying its ledger `utm_source` on every published URL (`readme-attribution-integrity.test.ts` fails on any untagged GitHub-rendered CTA). MCP official registry published 07-22 ([`com.nlqdb/nlqdb`](https://registry.modelcontextprotocol.io/v0.1/servers?search=com.nlqdb/nlqdb) v0.1.1, remotes-only) — Glama crawl-listed, **Smithery 0 · PulseMCP 0** (#822, merged, established neither ingests the registry; Smithery is now `blocked-by-human` #3 with a parked payload). First-touch attribution live since 07-19 on both the `/v1/ask` create arm and `POST /v1/db/connect`; `source_json` non-null **0** (07-25 live). Caveat from row #19: npm is live for *discovery* and broken on *arrival* until `0.2.2` | **weekly focus: → ≥ 5 live.** Yield read from `/app/admin`, never estimated. Growth comes only from not-yet-live channels (registries R-05 `/reach`, human-norm venues) |
| | **Human queue** (founder-directed 2026-07-22) | depth **9** (7 → 9 on #822's merge mid-run; re-derived from source), head **idle 42 d** (Show HN, since 06-13). Open PRs **2** + 1 draft; oldest non-draft **#823 (07-25 10:59Z)**, oldest draft **#719 (07-17, 8 d)** | the founder is the one non-automatable actor, so the queue head's age is the real cycle time |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/20 + 12 memory `/vs` pages | tick on merge; mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — the only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; E-03…E-07 all Neon/infra-gated |
| | Memory-quality eval (`SK-QUAL-023`) | **free-chain EX 93.33% (14/15)** — run 69, [GHA 29314389843](https://github.com/nlqdb/nlqdb/actions/runs/29314389843); p50 1168 ms / p95 7036 ms, `no_sql` 0. Per-axis: retrieval/forgetting/analytical/consolidation 3/3, **temporal 2/3** — the sole weak axis, pinned to one question (hallucinated `f.predicate='current_city'` + missing recency `ORDER BY … LIMIT 1`) | 15 gold-verified questions, 4 axes + analytical; free-only, no baseline emitted. Analytical-vs-vector head-to-head still E-05 infra-gated |

## Shipped distribution (live URLs)

Canonical copies live under `/blog` (`SK-BLOG-001`); the 36-post registry is
`apps/web/src/data/blog.ts` (row #6). Venue variants + full lesson gists stay in
`research/distribution-queue.md` — 2 drafts unpublished, 15 dev.to variants pending
(the `SK-BLOG-003` drip self-throttled this run: newest dev.to article 15.2 h ago
< 20 h, the expected no-op).

## Last change

**2026-07-25 (run 143)** — **Number moved: row #21. The walker scored a Turnstile refusal as a
product failure, so the row was pinned at `0 failed / 9 …` red forever. Now: 0 failed / 9 blocked.**

| | before | after |
|---|---|---|
| row #21, same prod surface, same client class | **9 failed / 0 blocked** ([30154906928](https://github.com/nlqdb/nlqdb/actions/runs/30154906928)) | **0 failed / 9 blocked** ([30159902837](https://github.com/nlqdb/nlqdb/actions/runs/30159902837)) |
| walk TTFV p50 / p95 reported | 379 ms / 801 ms — **challenge-rejection latency** | **n/a** (passing runs only) |
| a real failure among the blocks | indistinguishable | still red, by construction |

**Why it was broken.** FLOW-001 step 5 and FLOW-002/003's submit step return **428
`challenge_required`** from CI *by design*: Turnstile runs on every anon create (`SK-ANON-012`)
and a headless Chromium on a GitHub-Actions IP is exactly the client it exists to decline.
Scoring that `failed` made row #21 permanently red, and a saturated metric carries no
information — which is how the `SK-ANON-015` handoff regression (every `/solve` · `/vs` ·
`/agents` CTA discarding the visitor's goal) sat inside that red for days. `stranger-test`'s
Open-questions bullet had this **decided and unbuilt**; run 142 (#823) confirmed 0 of the 9
failures were product. This run built it (`SK-STRG-010`).

**The load-bearing half is the narrowness** (mechanism in `SK-STRG-010`): `blocked` needs **428
*and* `challenge_required`**, a pair `apps/api` mints in exactly one place, so a bare 428, a 401,
a 429 or any 5xx stay `fail`; and `runOutcome(steps)` derives the verdict so **any `fail` outranks
any `blocked`** — FLOW-003's step 9 runs *after* the blocked submit and a per-flow latch would
have let a block mask it.

**Verification (rule 3).** The prod re-walk above is the measurement — dispatched on this branch
so the *changed* walker hit the same surface from the same datacenter-IP client class; every line
reads `BLOCKED`, `- failed (product): 0`. The pure functions are unit-tested and **negative-tested
four ways** (status-only classifier · body-only classifier · `blocked` outranking `fail` · `skip`
counted as a block) — each turns the suite red naming the exact tests. The workflow's jq,
untestable in CI, was re-verified against a synthesized artifact of 8 blocks + 1 real step-9
failure: the cell renders `failed (1/9)` and both the FAILED and BLOCKED lines print, so one
product failure among any number of blocks still turns the walk red. A local prod walk stays
impossible (Chromium can't egress this container — `ERR_CONNECTION_RESET` with and without the
proxy), which is why the re-measure ran in Actions.

**Other lanes.** Strangers **0**, roster byte-identical; GSC flat a 10th read (row #7); row #15
**0.69** on time-decay alone; row #19 → **1 open** on #823's npm finding. Row #13's carried
`p50 ≈ 0.61 s` **did not reproduce** — corrected to the live 4.0 ms, because cheap routes dominate
the account-level distribution. Engine dark and fresh one more day (trigger fires 07-26).
**Gates:** `typecheck` (22 pkgs,
0 errors) · `lint` 0 errors / 41 warnings = baseline · `biome format` clean · `test` exit 0 (992
api; stranger-test **18 → 34**). Gate 3: `grep -rn '^### GLOBAL-' docs/features/` prints nothing.
**D4:** every edited doc under **20000 B** (`scorecard.md` held there by D5-trimming per-run prose
from rows #1–#12, #16, #18 and the shipped-distribution list; `SK-STRG-010`'s body lives in
`decisions/` per the SK-STRG-003/005/009 pattern). **Step 3:** queue 2-deep (< 3) ⇒ no forced
publish; no new draft; dev.to drip self-throttled ⇒ no queue-line edit. **KPI (GLOBAL-025):**
advances **UX** (the canonical-flow instrument can now report a real break instead of drowning
it) and **onboarding** (row #21 is the onboarding path's only end-to-end observer);
**degrades none** — no runtime code, endpoint, migration, external call or bundle changed.

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
