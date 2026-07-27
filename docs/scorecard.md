# Scorecard — current state

Point-in-time tracker, regenerated each
[`/daily`](../.claude/commands/daily.md) run. Current state only — no changelog
(≤20 KB cap). History: `git log` + `progress/quality-score-verification-log.md`.

**Weekly focus number (2026-07-19 → 07-25, founder-set — window has LAPSED,
`/weekly` is due):** **Acquisition — channels live with attributable yield:
2 → ≥ 5 (row #22, still 4).** Founder directive 2026-07-19
([`GLOBAL-038`](decisions/GLOBAL-038-gtm-pmf-instrumentation.md)): the operating
focus is **user acquisition**, measured continuously. Channel truth lives in
[`research/acquisition-channels.md`](research/acquisition-channels.md); yield
truth on `/app/admin`, never estimated.

**Worst number today:** **the wedge on-ramp offered no route a headless agent
could finish — this run's lever.** `/agents` is the GLOBAL-036 landing page, and
all **9** of its connect affordances (counted from the rendered page: 7
`McpInstall` host cells + 2 connect-card configs) terminate on the hosted
server's **OAuth consent screen** — a page only a signed-in human can approve.
The founder published `@nlqdb/mcp` on **07-26** precisely to open a
headless route — and no surface on nlqdb.com named it: `grep npx` across
`apps/web/src` returned **0**. Verified end-to-end from a clean registry install
this run, not assumed (row #19).
**Named next target, computed not eyeballed:**
**`/solve/running-total-cumulative-sum-in-sql/` — 69 impressions (14% of the
property's 488), 0 clicks, position 36.1**, top of `gsc-pull.ts`'s own
*Strengthen next* list for the **third** run running. Untouched only because
`data/solve.ts` belonged to then-open PR **#829** (step-0 retreat, not a
judgement).
**Queue (`blocked-by-human.md`):** the launch-sequence bullet (Show HN draft
**idle 44 days since 06-13**) is still the only queue action that can move real
strangers off 0; its age is the company's real cycle time. Depth **5** on `main`
after #834 + #838. Nothing added this run (no secret, console click or money was
needed) — but this run's own credential fix lands next to the queue's **open
founder decision on whether `sk_live_*` is the headless MCP credential** at all;
the roster lives only in [`blocked-by-human.md`](blocked-by-human.md).
**Dark (rule 8 — reported, never picked as a lever):** engine **#8 BIRD 0.5382**
(offline levers exhausted) and **#9 Spider 0.2222** (re-dispatched this run on
its staleness trigger); rows **#4/#5/#16**'s stranger-dependent criteria
(N = 0 until queue bullet #1 fires); row **#15**'s opencheck arm (free-lane
saturation, remedy costs money ⇒ rule 4).

**Rule 6 clean** — CI + Security + Release-npm + every `deploy-*` green as their
latest `main` run (each path-filtered). Local gates on this branch: `typecheck`
exit 0, `lint` at baseline, `test` exit 0 across all 20 packages.
**Open PRs 6** — #840 (daily 147), #839, #837, #835, #826, draft #719 (oldest,
**10 days**). This run's two files are touched by **none** of them; #837 carries
the same headless-route fix onto the docs host + `llms.txt` and shares only the
`sk_live_` conclusion, not a file. The scorecard collision with #840 is the
step-0 exemption.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (re-measured live 07-27 ~01:15Z: CF GraphQL + remote-D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF RUM) | **251 pageloads / 241 visits** raw (07-20→07-27 live, `bun scripts/rum-pull.ts`, unsampled). **Real-browser floor 63 pl / 53 vis**; synthetic 188 pl. Flat vs 237/54 | the cut is a printed rule, not hand-computed: `bot=1` or `userAgentBrowser ∈ {Unknown, ChromeHeadless}`, with every removed row listed. Conservative ⇒ real-browser is a floor. Read at **7d**: a 28d pull comes back sampled (interval 10) and its counts are interval-quantised estimates |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (`*@example.com`, `*@preview.dev`) — live remote-D1 07-27, roster byte-identical; no channel newly live to produce a signal |
| 3 | DBs total | **254** (07-27 live remote-D1, flat for 3 runs; synthetic — walker/preview churn) | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not measurable** (`SK-ONBOARD-007`). Attribution re-verified live 07-27: `databases.source_json is not null` = **0** | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12; founder-owned) | share ≥ 2 asks |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **104** content pages (`/solve` 37 + `/blog` 36 + `/vs` 31), re-derived from the live prod sitemap 07-27 by first path segment (each section bucket also carries its index page); **116** sitemap URLs total, **116/116 return 200** on a full live sweep this run. Queue holds **2** — below the 3-deep forced-publish threshold | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **36**. **Google (GSC 28d, 06-27→07-25, live): 8 clicks / 488 impr / pos 16.7** — clicks flat at 8, impressions 503 → 488 as the window rolled; 100 pages / 578 impr. Strengthen-next, top 3 of 50 qualifying pages: **`/solve/running-total-cumulative-sum-in-sql/` 69 impr / pos 36.1 ← top target, 3rd run running** · `/solve/find-rows-with-no-match-in-another-table/` 31 / 14.3 · `/vs/` 18 / 17.9. **First-party referral: 9 pageloads / 3 referrers** — google 6, baidu 2, bing 1 — on **5** surfaces: `/security/hall-of-fame/` ×5, `/blog/bird-gold-noise-distinct/`, `/blog/`, `/blog/smoke-test-walks-the-old-ui/`, `/`. **New this run: `docs.nlqdb.com` takes 9 of 63 real-browser pageloads (14%)** — 7 of them auto-generated `reference/sdk/type-aliases/*` stubs; the docs host runs no attribution capture until #832 merges, so that traffic converts as `direct` | `scripts/gsc-pull.ts` (Google) + `scripts/rum-pull.ts` (first-party). Total-impression breadth is still the bottleneck, not per-page CTR at N ≤ 12 impr (noise) |
| | **Engine** — BIRD 07-26 · Spider 07-19 (refresh in flight) · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.5382** (268/500, 07-26 canonical on `d961475`, [run 30212657876](https://github.com/nlqdb/nlqdb/actions/runs/30212657876), p50 1343 ms, retries 8). Completed in **one** 38-min window — #833 read it as "window 1 of ~6", but its checkpoint-save step is `skipped`, which per `SK-QUAL-011` only happens after a *completed* run deletes its checkpoint. Δ −0.40 pp vs the 07-19 baseline on an engine untouched since ⇒ provider-mix noise. **Baseline file deliberately not re-seeded** — its lane needs `mismatch`/`exec_error`/`gold_error`/`p95`, which live only in the run artifact, and artifact bytes are unreachable from a `/daily` session | target 0.65 / **Phase 2 floor 0.60** — gap 6.2 pp. Offline levers exhausted; SC dead (#619); frontier-lens closed (run 15) |
| 9 | Spider raw EX | **0.2222** (30/135, 07-19 canonical on `04fa3d0`, [29682993836](https://github.com/nlqdb/nlqdb/actions/runs/29682993836)). **8 days old ⇒ staleness trigger fired; re-dispatched this run on `d961475`, [30230040001](https://github.com/nlqdb/nlqdb/actions/runs/30230040001), in flight.** Engine byte-identical since, so this is a freshness refresh, not a lever test | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is its source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004)) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06, `SK-QUAL-022`) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69–0.70 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers analytics (live 07-27 01:20Z) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | **2,181 / 0** (0.00%) | mcp-server 1,522 / 0; web 11,431 / 0; events-worker 2 / 0 — **zero errors on every worker** |
| 13 | nlqdb-api wall-time p50 / p95 | **p50 17.5 ms / p95 1.48 s** | mcp-server p50 688 ms / p95 1.30 s. Read p95: the account-level distribution is dominated by cheap routes, so p50 is not `/ask` — an `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.527** (recomputed live 07-27 01:30Z; was 0.563 — pure time-decay, **no suite has changed state or re-run since 07-25**). Per suite `pass × freshness`: **sdk 0.695** · **examples 0.695** (both ✅ 07-24 22:12Z) · **mcp 0.718** (✅ 07-25 02:09Z) · **opencheck 0** ([30130304331](https://github.com/nlqdb/nlqdb/actions/runs/30130304331) ❌ Suite A 1/5 — the documented NVIDIA-free-tier saturation flake, remedy costs money ⇒ rule 4). Purely opencheck-limited; the other three decay ~0.14/day and hit 0 on **07-31** | Never dispatch opencheck alongside another consumer of its lanes. Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.5382); agentic-frontier ≥ 0.80 (0.693); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (stranger N=0); destructive-op retry (N≈0); MCP in 3+ host apps (0); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 removed the 428 wall |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **9** (re-counted live 07-27 with the pinned grep; flat for 3 runs) | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. De-prioritised as a default lever per the 07-11 /weekly; pullable only under a step-2 priority-3 waiver |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** — swept this run on this branch's build: **126** pages, **3,226** internal + **15** cross-app links. Independently, **116/116 prod sitemap URLs 200** on a live sweep. **Standing blind spots:** an *external* inbound link is not an internal one; this row never checks whether a published npm entrypoint resolves (row #19); and **it enumerates paths, never hosts** — re-verified live 07-27, `https://www.nlqdb.com/solve/` still serves the whole site on a second hostname with no redirect to apex (bounded: `rel=canonical` is absolute to apex, GSC indexes no www URL). Plaintext `http://` now 301s at the edge on apex, www **and** docs (queue #8 flipped 07-26) | target 0 — `bun run build && bun run check:links` (built-output) + `client-nav-integrity.test.ts` (in CI) |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **1 open, fixed in-repo, awaiting republish.** `@nlqdb/sdk` latest on the registry is still **0.2.1** (checked live 07-27) and 0.1.0/0.2.0/0.2.1 all throw `ERR_MODULE_NOT_FOUND`; returns to 0 when **`0.2.2` publishes — release PR #826 is open and unmerged**. **`@nlqdb/mcp@0.1.0` verified good this run, end-to-end, not assumed:** clean `npm i`, tarball manifest points at `dist/` (the packument's pre-`prepack` `main` is expected), the binary completes MCP `initialize` + `tools/list` over stdio, and a prefix-valid bogus key comes back with the **API's own 401 copy** — so the transport really reaches prod. The standing 0-phantom sweeps (`mcp-tool-integrity`, `cli-verb-integrity`, `sdk-method-integrity`) are unchanged | target 0 |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) + parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **0 failed / 9 blocked** — re-walked live against prod **from this container, not CI** (07-27, `bash scripts/stranger-test.sh`, 9/9 in 26 s). Every walk clears its whole pre-ask arm (flow-002 8/9 ok, flow-003 7/9 ok incl. the `demoGoal` handoff and the `solve.try_query_clicked` signal) and stops at the **428 `challenge_required`** ask step. **New fact this run: the refusal is not a GH-Actions artifact** — a second, unrelated datacenter IP is declined identically, so `SK-ANON-012` blocks *any* agent-run walk of the ask arm, and the steps past the ask remain never-executed. "0 failed" stays **observed, not proven** | target: **0 `failed`** ✅ — met; `blocked` is reported beside it, never folded in. A green *run* still means nothing (`SK-STRG-003` exits 0 by design): read the per-walk `FAILED`/`BLOCKED` lines |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 22 | Channels live with attributable yield | **4 live** — organic search + dev.to + npm + GitHub (per-bucket split lives only in the ledger). npm's install is un-broken for `@nlqdb/mcp` as of 07-26 (row #19) but still broken for `@nlqdb/sdk` until #826 merges. MCP official registry published 07-22; Smithery + mcp.so + cursor.directory submitted 07-26 (in #834, unmerged). First-touch attribution live since 07-19 on both create arms; `source_json` non-null **0**, for want of strangers, not instrument | **weekly focus: → ≥ 5 live.** Yield from `/app/admin` + `scripts/rum-pull.ts`, never estimated. Growth comes only from not-yet-live channels (R-05 registries, human-norm venues) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/20 + 12 memory `/vs` pages | mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; rest Neon/infra-gated |
| | Memory-quality eval (`SK-QUAL-023`) | **free-chain EX 93.33% (14/15)** — run 69, [GHA 29314389843](https://github.com/nlqdb/nlqdb/actions/runs/29314389843); p50 1168 ms / p95 7036 ms. Per-axis 3/3 except **temporal 2/3** | 15 gold-verified questions, 4 axes + analytical; free-only, no baseline |

## Shipped distribution

**36 canonical posts live under `nlqdb.com/blog/`** (`SK-BLOG-001`). The registry
is `apps/web/src/data/blog.ts` — the one place the list exists; venue variants and
full lesson gists stay in `research/distribution-queue.md`.

## Last change

**2026-07-27 (run 146)** — **Number moved: connect routes on `/agents` an
unattended agent can run: 0 of 9 → 1 of 10.** One signed-in visit still mints the
key; what the route removes is the per-session consent click, so everything after
the mint runs with no browser. Lane: real UX-flow quality (step-2 priority 2) on
the GLOBAL-036 wedge's landing page.

**The defect.** All **9** ways into `/agents` (7 `McpInstall` host cells + 2
connect-card configs, counted from the rendered page) land on
`https://mcp.nlqdb.com/mcp`, whose first tool call opens an **OAuth consent
screen** — fine for a human, a wall for the reader the page is written for. The
founder cleared the queue bullet that said so on **07-26** by publishing
`@nlqdb/mcp`; measured this run, **nothing on nlqdb.com had caught up**
(`grep -rn 'npx\|@nlqdb/mcp'` over `apps/web/src`: 0 non-test hits).

**Verified before it was written down** (P2). From a clean `npm i @nlqdb/mcp` in
an empty directory: the tarball manifest resolves to `dist/`, the binary
completes a real MCP `initialize` + `tools/list` handshake over stdio, and a
prefix-valid bogus key returns **the API's own 401 copy** — proving the transport
reaches prod, not a local stub.

**Fix.** One card in the existing connect grid, honest about its cost: the hosted
route's consent screen is named as the reason this one exists, and the key it
needs is a link away. Four identifiers inside it are cross-repo contracts, so
the guard derives each from source rather than restating a literal — package name
from `packages/mcp/package.json`, env var and accepted prefixes from `stdio.ts`,
and the credential prefix from `apps/api/src/api-keys.ts`. Nothing else covers
this: `check-links.mjs` sweeps hrefs, not code blocks.

**The credential the first draft got wrong.** It said mint `sk_mcp_`, which clears
every mechanical check — it is in the binary's own `KEY_PREFIXES` — and is
**unobtainable**: `sk_mcp_*` is minted server-side by the OAuth callback and never
displayed (`SK-APIKEYS-009`), and `/app/keys` deliberately won't mint one
(`SK-APIKEYS-012`). That is the same dead end this card exists to remove. Now
`sk_live_`, matching #834's merged sweep, and the guard asserts **obtainable**,
not merely **accepted**.

**Paid, not deferred.** A second config card would have duplicated the
copy-to-clipboard handler, so the single-button listener became one loop over
`[data-copy-config]` keyed on `data-copy-method`, and `agents.connect_clicked`
(GLOBAL-024) now reports *which* transport the reader reached for. That is
necessary but not sufficient: the client funnel's late-bound
`window.__nlqdb_logsnag` hook is **not installed anywhere**, so every
`lib/logsnag.ts` emit — this one included — is a no-op until it is
(`solve-pages/FEATURE.md` records the same gap). Layout **measured, not
asserted**: in Chromium at 390 / 768 / 1280 px both document and `.ag-connect`
`scrollWidth` are byte-identical before and after, the code block scrolling
inside its own box at every width.

**Recorded, not fixed** (one lever per run): row #7's top target,
`/solve/running-total-cumulative-sum-in-sql/` (69 impr / 0 clicks / pos 36.1),
named for the third run running, untouched because `data/solve.ts` belonged to
then-open PR **#829**. And the **founder decision this run's fix now leans on** —
whether `sk_live_*` is the headless MCP credential at all, given it survives
global sign-out (`SK-APIKEYS-006`) — is queue bullet #4, recorded by #838 and
not taken here.

**Corrected from run 145.** #833 recorded its BIRD dispatch as "window 1 of ~6";
it had already finished in one (`Save full-run checkpoint` `skipped`, which per
`SK-QUAL-011` only follows a completed run). Row #8 carries the 07-26 number
(0.5382, flat); the baseline file is left alone because a lane row needs fields
that live only in the run artifact, whose bytes no `/daily` session can read.
Spider hit its own 8-day trigger and was re-dispatched.

**No new `SK-*`/`GLOBAL-*`** (P5/D5): `SK-MCP-001` already documents two
transports and `GLOBAL-003` already requires a shipped capability to reach every
surface. Per §10.2 this is code-wrong / decision-right — the page lagged a
decision that already existed. Step 3: the dev.to drip is a **confirmed no-op**
(last post 07-26 17:32Z, **8.0 h < the 20 h guard**).

**Gates:** `typecheck` exit 0 all packages · `astro check` **0 errors / 0
warnings / 2 hints** (pre-existing) · `bun run lint` **0 errors, 41 warnings,
2 infos = repo baseline**, `biome check` clean on both touched files · `bun run
test` exit 0 across all 20 packages — `apps/web` **401 pass / 0 fail**, `apps/api`
992 pass · `check:links` 0 dead / 0 redirecting on 126 pages · gate 3
`grep -rn '^### GLOBAL-' docs/features/` prints nothing. **KPI (GLOBAL-025):**
advances **onboarding** — the wedge's landing page finally offers the ICP a route
it can actually finish; **degrades none** — no engine, API, migration, external
call or bundle touched, desktop and mobile layout measured identical.

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
