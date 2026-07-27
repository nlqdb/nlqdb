# Scorecard — current state

Point-in-time tracker, regenerated each [`/daily`](../.claude/commands/daily.md)
run. Current state only — no changelog (≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md`.

**Weekly focus number (2026-07-19 → 07-25, founder-set):**
**Acquisition — channels live with attributable yield: 2 → ≥ 5 (row #22, now 4).**
Founder directive 2026-07-19 ([`GLOBAL-038`](decisions/GLOBAL-038-gtm-pmf-instrumentation.md)):
the operating focus is **user acquisition**, measured continuously — product progress
is secondary this cycle. Agent-movable inputs, in order: reach R-05 registry listings
(list or park each), the R-04 machine-followable setup guide, utm-tagging live
channels per `SK-GTM-007`, and R-06 (the track's falsifier).
Channel truth lives in
[`research/acquisition-channels.md`](research/acquisition-channels.md); yield
truth on `/app/admin`, never estimated. Premium-chain work (`SK-LLM-017`,
row #20) is pullable only when no acquisition lever is.
**⚠ Window closed 07-25 and no `/weekly` has run since — the line above is kept
verbatim but is lapsed, so this run picked the worst agent-movable number itself
per step 2. `/weekly` is due.**

**Worst number today:** **row #7 — the site's single highest-CTR organic surface
was a dead end; this run's lever.** Both instruments, re-pulled live: GSC 28d puts
`/security/hall-of-fame/` at **4 of 8 total site clicks** (10 impr, pos 14.2 ⇒
**40% CTR** vs 1.5% site-wide) and RUM puts **5 of 9 referral pageloads** on it,
all Google; `hall of fame bug bounty` is in the top-queries list. On the bare
`<Base>` shell it rendered **one** onward link (`/`) against 21–22 on peer pages.
Fixed + guarded this run (see Last change).
**Named next target, computed not eyeballed:** two pages still scroll horizontally
at 390 px after this run's nav fix, from their **own** content rather than the
chrome — **`/` at 541 px** (also the #1 landing surface, 31 real-browser
pageloads) and **`/vs/wrenai/` at 401 px**. Google-side runner-up:
**`/solve/running-total-cumulative-sum-in-sql/` — 69 impr at pos 36.1**, the
largest winnable impression pool still off page 1.
**Top `blocked-by-human` bullet:** delete two orphaned Neon branches (07-27, CI red
at the branch cap). The launch-sequence bullet — the only one that can move real
strangers off 0, its age the company's real cycle time — is **idle 43 days since
06-13**. Queue depth **9**, nothing added this run; the roster lives only in
[`blocked-by-human.md`](blocked-by-human.md).
**Dark (rule 8, reported not pulled):** engine **#9 Spider 0.2222** / **#8 BIRD
0.542** — the 7-day staleness trigger fired today and a canonical free-lane run is
**in flight** ([30212657876](https://github.com/nlqdb/nlqdb/actions/runs/30212657876),
window 1 of ~6 on `main@d961475`); rows **#4/#5/#16**'s stranger-dependent criteria
(N = 0 until the launch bullet fires); row **#15**'s opencheck arm (free-lane
saturation, remedy costs money ⇒ rule 4).

**Rule 6 clean** — CI + Security + Release-npm green on their latest `main` run
(07-26 13:42Z); all `deploy-*` green (07-25 15:51Z, each path-filtered).
Open PRs **6** — **#832** + **#831** (reach R-07 / R-04), **#830** (`@nlqdb/mcp`
entrypoints), **#829** (`/vs` persona labels), **#826** (changesets,
`@nlqdb/sdk@0.2.2`), draft **#719** (oldest, **9 days**). Step-0 checked: this run's
five files overlap none — #829 is nearest, editing `/vs` + `/solve` pages and
`data/`, not `styles/global.css`, the security page, or the sitemap test.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (all re-measured live 07-26 ~17:30Z: CF GraphQL + remote-D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF RUM) | **248 pageloads / 238 visits** raw (07-19→07-26 live, `bun scripts/rum-pull.ts`, unsampled). **Real-browser floor 60 pl / 50 vis**; synthetic 188 pl. Up from 237/227 raw and 54/44 real — still no row-#2 signal behind it | the cut is a printed rule: `bot=1` or `userAgentBrowser ∈ {Unknown, ChromeHeadless}`, with **every removed row listed** so a real visitor it swallows is visible. Conservative ⇒ real-browser is a floor. Read at **7d**: a 28d pull comes back sampled (interval 10) and its counts are interval-quantised estimates |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (`*@example.com`, `*@preview.dev`) — live remote-D1 07-26, roster byte-identical a 3rd run; no channel newly live to produce a signal |
| 3 | DBs total | **254** (07-26 live remote-D1, flat vs runs 143–144; synthetic — walker/preview churn) | stranger subset ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not measurable** (`SK-ONBOARD-007`). Re-verified live 07-26: `databases.source_json is not null` = **0** | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12; founder-owned) | share with ≥ 2 asks |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **104** content pages (`/solve` 37 + `/vs` 31 + `/blog` 36); **116** sitemap URLs, **126** built pages. Queue **2** — below the 3-deep forced-publish threshold | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **36**. **Google (GSC 28d, 06-26→07-24, live): 8 clicks / 520 impr / pos 17.5**; 101 pages / 610 impr; top queries 17 rows / 25 impr. **Clicks are concentrated, not spread: `/security/hall-of-fame/` alone is 4 of the 8** (10 impr, pos 14.2 ⇒ **40% CTR** vs 1.5% site-wide) — the anomaly this run acted on. Strengthen-next, top 3 of 52 qualifying (impressions, pos > 10): **`/solve/running-total-cumulative-sum-in-sql/` 69 / 36.1 ← top target** · `/vs/wrenai` 49 / 16.1 · `/solve/find-rows-with-no-match-in-another-table/` 31 / 14.3. **First-party referral: 9 pageloads / 3 referrers** (google 6, baidu 2, bing 1) on **5** surfaces, **5 of the 9 on `/security/hall-of-fame/`**. Sitemap 116 submitted / 0 indexed (deprecated GSC field, always 0 — not a coverage signal) | `scripts/gsc-pull.ts` + `scripts/rum-pull.ts`. Total-impression breadth is the bottleneck, not per-page CTR at N ≤ 12 impr (noise). **Both instruments independently name the same top surface** — that agreement is what made this run's lever computable rather than guessed |
| | **Engine** — BIRD 07-19 · Spider 07-19 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.542** (270/498 EA, 07-19 canonical on `2b3e4d2`, [run 29670818828](https://github.com/nlqdb/nlqdb/actions/runs/29670818828) — 6 `SK-QUAL-013` windows, `no_sql` 0/500). `run_at` 07-19T02:51Z ⇒ **7.6 d old ⇒ staleness trigger fired.** Fresh canonical dispatched: [30212657876](https://github.com/nlqdb/nlqdb/actions/runs/30212657876) `mode=full limit=500` on `main@d961475`, **window 1 in flight** — resume on the *same SHA* until the report writes `resumable: false` | target 0.65 / **Phase 2 floor 0.60** — gap 5.8 pp. Offline levers exhausted; SC dead (#619). Prior run completed (not resumable) ⇒ staleness refresh, not a resumption |
| 9 | Spider raw EX | **0.2222** (30/135, 07-19 canonical on `04fa3d0`, [29682993836](https://github.com/nlqdb/nlqdb/actions/runs/29682993836); `no_sql` 0/135). Give-back from the reverted 0.2963 reading on a byte-identical engine ⇒ free-lane provider-mix noise, not a regression | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004)) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06, `SK-QUAL-022`) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers analytics (live 07-26 17:30Z) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | **2,144 / 0** (0.00%) | mcp-server 1,381 / 0; web 11,276 / 0; events-worker 1 / 0 — zero errors across all four workers |
| 13 | nlqdb-api wall-time p50 / p95 | **p50 14.1 ms / p95 1.48 s** (p90 1.30 s) | mcp-server p50 677.8 ms / p99 1.69 s. Read p95: the account-level distribution is dominated by cheap routes, so p50 is **not** `/ask` — an `/ask`-only split needs Grafana `metrics:read` (run 143's correction) |
| 14 | $ spend | ~$0 | free tiers |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.563** (recomputed live 07-26; was 0.68 — **pure time-decay, no suite changed state**). Per suite `pass × freshness`: **sdk 0.742** (✅ 07-24) · **examples 0.742** (✅ 07-24) · **mcp 0.766** (✅ 07-25) · **opencheck 0** (latest ❌ 07-24; last success 07-17 ⇒ 9.6 d, freshness floored — the documented NVIDIA-free-tier saturation flake, remedy costs money ⇒ rule 4). Purely opencheck-limited; the other three decay ~0.14/day | Never dispatch opencheck alongside another consumer of its lanes. Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.542); agentic-frontier ≥ 0.80 (0.693); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (N=0); destructive-op retry (N≈0); MCP in 3+ hosts (0); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 removed the 428 wall |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **9** (re-counted live 07-26, pinned grep; flat 3rd run). Spread: elements 2; agent-memory-pivot / anonymous-mode / cli / docs-site / e2e-coverage / events-pipeline / quality-eval 1 each | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, case-insensitively, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. De-prioritised as a default lever (07-11 /weekly); pullable only under a step-2 priority-3 waiver |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** — re-swept live on the post-fix build: **126** pages, **3,238** internal + **15** cross-app links. **Four blind spots:** ≥ 107 Google impressions land on bare paths that 301 (`SK-WEB-027`) — an *external* inbound link is not an internal one; it never checks whether a published npm entrypoint resolves (row #19); it enumerates paths, never **hosts** (`www.nlqdb.com` still serves the whole site with no redirect to apex — bounded, `rel=canonical` is absolute); and it counts links without asking whether a page **has** any — this run's defect read 0-dead/0-redirecting the whole time it was a dead end | target 0 — `node apps/web/scripts/check-links.mjs` (built-output) + `client-nav-integrity.test.ts` (in CI) |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **1 open, fixed in-repo, awaiting republish.** Every surface telling a reader to `npm i @nlqdb/sdk` is still lying on the registry: 0.1.0 / 0.2.0 / 0.2.1 all throw `ERR_MODULE_NOT_FOUND`. #823 fixed + guarded the manifests (`npm-tarball-entrypoint-integrity.test.ts`); returns to 0 when **`0.2.2` reaches the registry — release PR #826 open, unmerged**. The 0-phantom sweeps (`mcp-tool-`/`cli-verb-`/`sdk-method-integrity`) are unchanged | target 0 |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) + parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal fires |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **0 failed / 9 blocked** — no product failure on any canonical flow (live prod walk 07-25, [30159902837](https://github.com/nlqdb/nlqdb/actions/runs/30159902837)); verify-flows ✅ · FLOW-005 6/6 ✅ · stdio 22/22 ✅. All 9 walks stop at the **428 `challenge_required`** step — Turnstile declining a headless GH-Actions client by design (`SK-ANON-012`), scored `blocked` per `SK-STRG-010` (#824) not `failed`. 0 `passed` is expected from CI: no walk can complete the `/v1/ask` arm from a datacenter IP, so the steps *past* the ask have never run and "0 failed" is **observed, not proven** | target **0 `failed`** ✅; `blocked` reported beside it, never folded in. A green *run* means nothing (`SK-STRG-003` exits 0 by design): read the per-walk `FAILED`/`BLOCKED` lines in the job log |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 22 | Channels live with attributable yield | **4 live** — organic search + dev.to + npm + GitHub (per-bucket split lives only in the ledger). Each carries its ledger `utm_source` in-repo; **npm's does not reach the registry** and the install is broken (row #19) until #826 merges. MCP official registry published 07-22 (`com.nlqdb/nlqdb` v0.1.1); Glama crawl-listed; Smithery 0 / PulseMCP 0. First-touch attribution live since 07-19 on both create arms; `source_json` non-null **0**, for want of strangers, not instrument. Note the shape of what organic delivers (row #7): the wedge pages earn impressions, not clicks | **weekly focus: → ≥ 5 live.** Yield from `/app/admin` + `scripts/rum-pull.ts`, never estimated. Growth comes only from not-yet-live channels (R-05 registries, human-norm venues) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/20 + 12 memory `/vs` pages | mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; rest Neon/infra-gated |
| | Memory-quality eval (`SK-QUAL-023`) | **free-chain EX 93.33% (14/15)** — run 69, [GHA 29314389843](https://github.com/nlqdb/nlqdb/actions/runs/29314389843); p50 1168 ms / p95 7036 ms. Per-axis 3/3 except **temporal 2/3** — one question (hallucinated predicate + missing recency `ORDER BY`) | 15 gold-verified questions, 4 axes + analytical; free-only, no baseline. Analytical-vs-vector head-to-head still E-05 infra-gated |

## Shipped distribution

**36 canonical posts live under `nlqdb.com/blog/`** (`SK-BLOG-001`). The registry is
`apps/web/src/data/blog.ts` — the one place the list exists; venue variants and full
lesson gists stay in `research/distribution-queue.md`.

## Last change

**2026-07-26 (run 145)** — **Number moved: row #7's surface yield — onward
navigational links on the site's highest-CTR organic surface, 1 → 14; share of
measured organic arrival landing on a chrome-less dead end, GSC 4 of 8 clicks (50%)
→ 0 and first-party 5 of 9 referral pageloads (56%) → 0; sitemap-advertised pages
rendering no site chrome, 1 → 0.** Lane: acquisition & distribution (step-2
priority 1, "lift a funnel-conversion number").

**The defect.** The page is advertised by `SECURITY.md` and
`/.well-known/security.txt`, sits in the sitemap, and is the best-converting page
nlqdb has (numbers above). Ported from the retired `coming-soon` stub onto the bare
`<Base>` shell — which renders no nav and no footer — it shipped **one** onward link
plus the boot-panel's sign-out. Half our organic arrivals reached a room with no
exits. We had even published the lesson: run 28's post is *"one-way internal links
leak yield."*

**Why it hid.** Every instrument was green. Row #18 counts whether links *resolve*,
never whether a page *has* any; the sitemap test asserted the page was *listed*.
Nothing asserted that a URL we ask Google to index can be navigated out of.

**Fix + the guard that makes it hold.** `<Topnav>` + `<Footer>` in the standard
`.page` grid — the chrome 18 other pages already use, two via `Legal.astro` — and the
redundant `← nlqdb` paragraph deleted. The guard is keyed on **the sitemap body
itself**, not a hardcoded list: every `<loc>` resolves to the `src/pages` file that
renders it (static, `index.astro`, or `[slug]` template) and must render both
components, directly or through one layout hop. The set checked is exactly the set we
ask Google to index, so a newly-advertised route inherits it. Negative-tested three
ways, each naming the right file: reverting the page → `security/hall-of-fame.astro`;
dropping `<Footer />` from `vs/[slug].astro` → that template; breaking the hop in
`Legal.astro` → `privacy.astro` + `terms.astro`.

**Cost of delivery, paid not deferred.** Adopting the chrome would have imported a
defect: at 390 px, `.topnav`/`.topnav__links` were `display:flex` with **no wrap and
no media query anywhere**, so the nav needed ~650 px and **every page on the site
scrolled horizontally** (`scrollWidth` 652 on all seven sampled). Two
`flex-wrap: wrap` declarations fix it: **pages with no horizontal scroll at 390 px,
1/9 → 7/9**, nothing worse. Desktop-neutrality proven, not asserted — full-page
screenshots hash **identically** before/after at 1280 px and 768 px once the
homepage animation settles, and the `.topnav` box is byte-identical (1088×70). The
two stragglers overflow from their own content, not the chrome.

**Recorded, not fixed (one lever per run).** `pages/oauth/mcp-authorize.astro` is
the mirror-image gap: an OAuth consent screen with **no `noindex`** and no chrome —
a JS-shell page Google would soft-404, the class `Base.astro`'s own `noindex`
comment describes. It needs `noindex`, never marketing nav (wandering off
mid-authorization). Left alone deliberately: the one-line fix falsifies a
documented enumeration — `SK-WEB-023` says *"only `/auth/*` is `noindex`"* — and per
**P1** amending that is the founder's call, not a silent edit. It is out of the
sitemap, so the guard correctly ignores it and nothing regresses meanwhile.
(`SK-WEB-027` and the sitemap test already group `/app|/auth|/oauth`.)

**Step 3, and a slip I own.** Queue **2**-deep (< 3) ⇒ no forced publish. The
dev.to drip posted [*"We published 20 blog posts and never shipped a feed"*](https://dev.to/omer_hochman/we-published-20-blog-posts-and-never-shipped-a-feed-nothing-could-subscribe-1pln)
and its queue line is updated — but I picked it off a `tail`-truncated `--list`, so
it was **mid-queue, not the oldest** (`agent-memory-vector-store-aggregation-gap`
still is), and posted `#blogging` where the line said `#rss`. Both recorded on the
line itself; the drip guard then refused a second post (`0.0h ago (< 20h)`), so
exactly one went out. Next run: read `--list` un-truncated, take the head.

**No new `SK-*`** (P5/D5): chrome components, the `.page` grid and
sitemap-as-indexable-set all pre-exist — this run makes one page obey a convention 18
others follow, and pins it. A record restating "pages should have nav" fails D5.

**Gates:** `typecheck` exit 0 all packages · `astro check` **0 errors / 0 warnings /
2 hints** (pre-existing) · `lint` **0 errors, 41 warnings, 2 infos = baseline**,
`biome format` clean · `test` exit 0 across all 20 packages — `apps/web` **398 pass
/ 0 fail**, `apps/api` 992 pass · link sweep **0 dead / 0 redirecting** on 126
pages · gate 3 prints nothing · **D4** every edited doc under 20480 B.
**KPI (GLOBAL-025):** advances **UX** (the one organic surface strangers actually
click through now routes onward; 6 more pages stop scrolling sideways on a phone)
and **onboarding** (that traffic can reach `/app`, `/agents`, `/solve` at all);
**degrades none** — no engine, API, migration, external call or bundle touched;
two CSS declarations and one page template, desktop rendering pixel-identical.

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
