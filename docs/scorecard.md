# Scorecard — current state

Point-in-time tracker, regenerated each [`/daily`](../.claude/commands/daily.md)
run. Current state only — no changelog (≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md`.

**Weekly focus number (2026-07-19 → 07-25, founder-set):**
**Acquisition — channels live with attributable yield: 2 → ≥ 5 (row #22, now 4).**
Founder directive 2026-07-19 ([`GLOBAL-038`](decisions/GLOBAL-038-gtm-pmf-instrumentation.md)):
the operating focus is **user acquisition**, measured continuously — product progress
is secondary this cycle. Channel truth lives in
[`research/acquisition-channels.md`](research/acquisition-channels.md); yield truth on
`/app/admin`, never estimated. Premium-chain work (`SK-LLM-017`, row #20) is pullable
only when no acquisition lever is.
**⚠ Window lapsed 07-25; `/weekly` is 2 days overdue, so this run picked its own
target per step 2.**

**Worst number today:** **the human queue — depth 4, top bullet (`MEMORY_PRESET`) 1
day old but the launch-sequence bullet idle 45 days.** With real strangers at 0, the
age of this queue's head is the company's real cycle time, and the one bullet that can
move strangers off 0 (`SK-PIVOT-016`) has sat since 06-13. No agent run can clear it —
it is a founder decision (rule 4). So this run took the highest-yield **agent-movable**
lever instead (below).
**Why this funnel-conversion lever (step-2 priority 1).** `/security/hall-of-fame/` is
the single **highest-traffic real-stranger surface** — 4 of 8 GSC clicks and 5 of 9
first-party referral pageloads (row #7), the one page strangers actually reach — yet its
**body dead-ended**: run 145 gave it site chrome, but the content itself never said what
nlqdb is or offered a way to try it, so every one of those arrivals read about security
disclosure and left. Adding a product CTA to the page's own body is a direct
funnel-conversion lever on the highest-yield organic landing surface, in-run measurable
(CTA links 0 → 1, `/app/new/` verified 200), and collides with none of the 3 open PRs.
The GSC *Strengthen next* head (`/solve/running-total-cumulative-sum-in-sql/`, pos 36.3)
stays declined (run 147): query saturation, not page quality, and a copy edit has no
in-run re-measure. The `@nlqdb/sdk` npm-page fix (run 148) is shipped in-repo but its
publish (0.2.2) still waits on release PR #826 (merger-agent territory, not agent-movable).
**Top `blocked-by-human` bullet:** decide `MEMORY_PRESET` in prod (⏱ ~5 min, **1 day
old**, PR #835 drafted). The launch-sequence bullet — the only one that can move real
strangers off 0 — is **idle 45 days since 06-13**; its `SK-PIVOT-016` gate is **0/5
green** (no ops workload on the public MCP surface yet ⇒ criteria 1–3 unstartable;
temporal golden 2/3; `/agents` memory dashboard unshipped). Every criterion is
agent-movable and `MEMORY_PRESET=1` is its prerequisite — which is the top bullet.
**Dark (rule 8, reported not pulled):** engine **#8 BIRD 0.5382** / **#9 Spider
0.2222**; rows **#4/#5/#16**'s stranger-dependent criteria (N = 0 until the launch
bullet fires); row **#15**'s opencheck arm (free-lane saturation, remedy costs money
⇒ rule 4).

**Rule 6 clean** — CI green on `main@e4d740a` (#841 merged 07-28 00:24Z); Deploy API /
Deploy web / Deploy docs site all green on the latest deployable SHA `cd81a07` (#841 was
a `packages/mcp` README-only change — no app deploy triggered). Local gates on the
touched scope: `astro check` **0 errors / 0 warnings**, web suite **425 pass**, lint
clean, `check-links` **0 dead** (126 pages, 3240 internal links).
Open PRs **3** — **#835** (draft, `MEMORY_PRESET`), **#826** (changesets,
`@nlqdb/sdk@0.2.2` + `@nlqdb/mcp@0.1.1`), draft **#719** (oldest, **11 days**). **#841
merged since run 148** (reach R-07: `@nlqdb/mcp` README + registries). This run's single
file (`apps/web/src/pages/security/hall-of-fame.astro`) overlaps none of the open PRs.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (all re-measured live 07-27 ~09:20Z: CF GraphQL + remote-D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF RUM) | **258 pageloads / 249 visits** raw (07-20→07-27 live, `bun scripts/rum-pull.ts`). **Real-browser floor 58 pl / 49 vis**; synthetic 200 pl. Header now reports SAMPLED at interval ≤1.027 even on the 7d window — at that interval counts are effectively unscaled, but read them as estimates | the cut is a printed rule: `bot=1` or `userAgentBrowser ∈ {Unknown, ChromeHeadless}`, with **every removed row listed** so a real visitor it swallows is visible. Conservative ⇒ real-browser is a floor. Read at **7d**: a 28d pull comes back sampled at interval 10 |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (`*@example.com`, `*@preview.dev`) — live remote-D1 07-27, roster byte-identical a 4th run; no channel newly live to produce a signal |
| 3 | DBs total | **254** (07-27 live remote-D1, flat across runs 143–147; synthetic — walker/preview churn) | stranger subset ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not measurable** (`SK-ONBOARD-007`). Re-verified live 07-27: `databases.source_json is not null` = **0** | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12; founder-owned) | share with ≥ 2 asks |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **104** content pages (`/solve` 37 + `/vs` 31 + `/blog` 36); **116** sitemap URLs, **126** built pages. Queue **2** — below the 3-deep forced-publish threshold | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **36**. **Google (GSC 28d, 06-27→07-25, live): 8 clicks / 496 impr / pos 16.9**; 100 pages / 586 impr; top queries 17 rows / 24 impr. Clicks stay concentrated: **`/security/hall-of-fame/` is 4 of the 8** (11 impr, pos 13.5) — run 145 gave that page site chrome and **run 149 added a product CTA to its own body** (it had zero product context / conversion path before), so the next pull is the first that can show whether that landing surface now converts onward. Strengthen-next, top 3 of 50 off page 1: **`/solve/running-total-cumulative-sum-in-sql/` 72 / 36.3 ← declined, see above** · `/solve/find-rows-with-no-match-in-another-table/` 31 / 14.3 · `/vs/` 18 / 17.9. **First-party referral: 8 pageloads / 3 referrers** (google 5, baidu 2, bing 1); **5 of the 8 on `/security/hall-of-fame/`**. **New — URL Inspection: `/agents/` reads "Duplicate, Google chose different canonical" (it picked `/agents`, crawled 07-19).** Verified live: `/agents` 301s to `/agents/`, and both the rendered `<link rel=canonical>` and the sitemap carry the slash ⇒ a stale pre-`SK-WEB-027` crawl, not a live defect. Only a lever if it survives a fresh crawl | `scripts/gsc-pull.ts` + `scripts/rum-pull.ts`. Total-impression breadth is the bottleneck, not per-page CTR at N ≤ 12 impr (noise) |
| | **Engine** — BIRD 07-26 · Spider 07-19 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.5382** (268/500, 07-26 canonical on `d961475`, [run 30212657876](https://github.com/nlqdb/nlqdb/actions/runs/30212657876)) — **1.7 d old, staleness trigger not fired**. This run verified the run's *completeness* rather than re-reading the score: its `Save full-run checkpoint` step is **`skipped`**, which per `SK-QUAL-011` happens only after a finished run deletes its checkpoint — one 38-min window, not six. The EX figure itself is run 146's read of that report | target 0.65 / **Phase 2 floor 0.60** — gap 6.2 pp. Offline levers exhausted; SC dead (#619) |
| 9 | Spider raw EX | **0.2222** (30/135, 07-19 canonical on `04fa3d0`, [29682993836](https://github.com/nlqdb/nlqdb/actions/runs/29682993836)). The 07-27 re-dispatch [30230040001](https://github.com/nlqdb/nlqdb/actions/runs/30230040001) (`d961475`) exited **partial** — its `Save full-run checkpoint` step **ran**, so a `SK-QUAL-013` budget-stop left a checkpoint behind | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004)) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06, `SK-QUAL-022`) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers analytics (live 07-27 09:25Z) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | **2,185 / 0** (0.00%) | mcp-server 1,627 / 0; web 11,310 / 0; events-worker 3 / 0 — **zero errors across all four workers**, 5th consecutive run |
| 13 | nlqdb-api wall-time p50 / p95 | **p50 16.4 ms / p95 1.48 s** (p99 1.69 s) | mcp-server p50 691.3 ms / p95 1.30 s. Read p95: the account-level distribution is dominated by cheap routes, so p50 is **not** `/ask` — an `/ask`-only split needs Grafana `metrics:read` (run 143's correction) |
| 14 | $ spend | ~$0 | free tiers |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.420** (recomputed 07-28; was 0.492 — **pure time-decay, no suite changed state**). Per suite `pass × freshness`: **mcp 0.576** (✅ 07-25) · **sdk 0.553** (✅ 07-24) · **examples 0.553** (✅ 07-24) · **opencheck 0** (latest ❌ 07-24; last success 07-17 ⇒ 11 d, freshness floored — the documented NVIDIA-free-tier saturation flake, remedy costs money ⇒ rule 4). Purely opencheck-limited; the other three decay ~0.14/day | Never dispatch opencheck alongside another consumer of its lanes. Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.5382); agentic-frontier ≥ 0.80 (0.693); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (N=0); destructive-op retry (N≈0); MCP in 3+ hosts (0); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 removed the 428 wall |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **10** (re-counted live 07-27, pinned grep; **+1 vs 9**). The new one is `mcp-server`'s `sk_live_*`-as-MCP-credential question, already mirrored as founder queue bullet #3 — a founder-only call, so it is queue depth, not agent backlog. Rest: elements 2; agent-memory-pivot / anonymous-mode / cli / docs-site / e2e-coverage / events-pipeline / quality-eval 1 each | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, case-insensitively, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. De-prioritised as a default lever (07-11 /weekly); pullable only under a step-2 priority-3 waiver |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** — re-swept live on a fresh build: **126** pages, **3,240** internal (+2, the run-149 hall-of-fame CTA) + **15** cross-app links, `_redirects` carrying 115 bare-path 301s | target 0 — `node apps/web/scripts/check-links.mjs` + `client-nav-integrity.test.ts`. Four standing blind spots: external inbound links to bare paths (≥107 impr), published npm entrypoints (row #19), **hosts** not paths (`www.nlqdb.com` serves the whole site un-redirected — bounded, `rel=canonical` is absolute; fix is a zone Redirect Rule ⇒ console click), and pages with no links at all (run 145) |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **1 open, fixed in-repo, awaiting republish.** Checked live on the registry this run: `@nlqdb/sdk` latest is still **0.2.1**, so every surface telling a reader to `npm i @nlqdb/sdk` still hands them an `ERR_MODULE_NOT_FOUND`. #823 fixed + guarded the manifests; returns to 0 when **`0.2.2` reaches the registry — release PR #826 open, unmerged 3 days**. `@nlqdb/mcp` is live at **0.1.0** (0.1.1 waits in the same PR). The 0-phantom sweeps (`mcp-tool-`/`cli-verb-`/`sdk-method-integrity`) are unchanged | target 0 |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) + parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal fires |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **0 failed / 9 blocked** — carried from the 07-26 live walk; the scheduled CI walk [30194859852](https://github.com/nlqdb/nlqdb/actions/runs/30194859852) (07-26 08:34Z) concluded success. **Not re-walkable from a `/daily` container**, a new standing constraint: `@playwright/test` pins `~1.60.0`, which wants Chromium **1223**; the image ships **1194**, so the walker aborts with `Executable doesn't exist`. CI-only until they agree | target **0 `failed`** ✅; `blocked` reported beside it, never folded in. All walks stop at the 428 `challenge_required` (Turnstile declining a datacenter IP by design, `SK-ANON-012`), so steps past the ask are **observed, not proven** |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 22 | Channels live with attributable yield | **4 live** — organic search + dev.to + npm + GitHub (per-bucket split lives only in the ledger). Each carries its ledger `utm_source` in-repo; **npm's does not reach the registry** and the SDK install is broken (row #19) until #826 merges. MCP official registry published 07-22 (`com.nlqdb/nlqdb`); Glama crawl-listed; Smithery 0 / PulseMCP 0. First-touch attribution live since 07-19 on both create arms; `source_json` non-null **0**, for want of strangers, not instrument | **weekly focus: → ≥ 5 live.** Yield from `/app/admin` + `scripts/rum-pull.ts`, never estimated. Growth comes only from not-yet-live channels (R-05 registries, human-norm venues) |
| | **Human queue** — the one non-automatable actor | **depth 4**, head ⏱ ~5 min · **1 day old**; oldest bullet 45 days (`SK-PIVOT-016` gate **0/5**) | [`blocked-by-human.md`](blocked-by-human.md). Open PRs 3, oldest 11 days (draft #719) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/20 + 12 memory `/vs` pages | mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; rest Neon/infra-gated |
| | Memory-quality eval (`SK-QUAL-023`) | **free-chain EX 93.33% (14/15)** — run 69, [GHA 29314389843](https://github.com/nlqdb/nlqdb/actions/runs/29314389843); p50 1168 ms / p95 7036 ms. Per-axis 3/3 except **temporal 2/3** (`SK-PIVOT-016` criterion 4) | 15 gold-verified questions, 4 axes + analytical; free-only, no baseline |

## Shipped distribution

**36 canonical posts live under `nlqdb.com/blog/`** (`SK-BLOG-001`). The registry is
`apps/web/src/data/blog.ts` — the one place the list exists; venue variants and full
lesson gists stay in `research/distribution-queue.md`.

## Last change

**2026-07-28 (run 149)** — **Number moved: product-conversion CTA links in the body of
`/security/hall-of-fame/` 0 → 1** (`/app/new/`, the canonical create entry). Lane:
funnel-conversion (step-2 priority 1) on the highest-yield organic landing surface +
GLOBAL-025 onboarding.

**The defect.** `/security/hall-of-fame/` is the **single highest-traffic real-stranger
surface** — 4 of 8 GSC clicks and 5 of 9 first-party referral pageloads (row #7), the one
page strangers actually reach organically (it is linked from `SECURITY.md` +
`/.well-known/security.txt`). Run 145 gave it site chrome so an arrival *could* navigate
onward, but the page **body itself** never said what nlqdb is or offered a reason to try
it: a security researcher landed, read about responsible disclosure, and left without
learning the product exists. A dead-ended body on the page that gets the most real
traffic is a funnel-conversion leak, not a cosmetic one.

**The fix + re-measure.** Added a final CTA section to the page body, mirroring the
`/solve` idiom (the `.cta` lime primitive + `--rule` divider): a one-line "nlqdb is a
database you query in plain English" plus **`Start with a goal →` linking `/app/new/`**
(verified **200 on prod**, P2) and the anonymous-DB reassurance. Re-measured on a fresh
build: the built page now carries **1 product-CTA link** (was 0), chrome intact, and
`check-links` counts **3240** internal links (was 3238), 0 dead. The link is internal, so
`captureFirstTouch` (which runs on every `Base.astro` load) already attributed the visit
on arrival — no `utm` needed, matching how every `/solve` page links `/app/new/`.

**The guard.** `check-links.mjs` already fails if `/app/new/` ever goes dead, and
`sitemap.xml.test.ts` pins the page's Topnav+Footer chrome (3 pass). No bespoke
per-page CTA test — the `/solve` pages carry the same idiom with no such test, so a
dedicated one would break that consistency for a low-cost-to-restore marketing CTA (D5).

**Step 3.** Distribution queue **2**-deep (< 3) ⇒ no forced publish; skipped a step-3.2
draft (the lesson — "your highest-traffic page needs a body CTA, not just chrome" —
near-duplicates the run-145/148 funnel-leak entries, fails D5). **dev.to drip:** newest
dev.to article was 8.1 h ago (< 20 h), so the 1/day guard skips this run — the expected
no-op; no queue-line edit.

**No new `SK-*`** (P5/D5): `GLOBAL-025` already makes onboarding a first-class KPI and the
`/solve` CTA idiom already exists. Per `AGENTS.md` §10.2 this is code-wrong / decision-
right — a real surface lagged an idiom that already existed. A record saying "put a CTA on
the security page too" fails D5.

**Gates:** `astro check` **0 errors / 0 warnings** · web suite **425 pass** · `lint`
clean on the touched `.astro` · `check-links` **0 dead** · gate 3 `grep -rn '^### GLOBAL-'
docs/features/` prints nothing · **D4** every edited doc under 20480 B. Change is a single
marketing `.astro` page — no engine, API, migration, runtime, or bundle code — so
cross-package gates are untouched by construction.
**KPI (GLOBAL-025):** advances **onboarding** — the page real strangers most often reach
now names the product and offers a one-click path into the create flow; **degrades none**
— no engine, API, migration, runtime code, external call, or bundle touched.

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
