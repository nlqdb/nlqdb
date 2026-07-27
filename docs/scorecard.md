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
**⚠ Window closed 07-25; no `/weekly` has run in the 2 days since — the line above
is kept verbatim but is lapsed, so this run picked its own target per step 2.
`/weekly` is overdue.**

**Worst number today:** **the human queue — 5 bullets deep with its top row already
resolved, i.e. the founder's one non-automatable slot was pointing at work that no
longer existed.** With real strangers at 0, the age of this queue's head is the
company's real cycle time, so a stale head is a real cost. Verified live against the
Neon API this run: the two orphaned branches that row asked the founder to delete
(`pr-571`, `pr-648`) are **gone**, and the project sits at **5 of 10** slots. Row
deleted, and its durable half — the reason it existed — shipped this run (see Last
change). **Queue 5 → 4.**
**Why no acquisition lever instead (step-2 priority 1).** The GSC *Strengthen next*
head is `/solve/running-total-cumulative-sum-in-sql/` — **72 impr, 0 clicks, pos
36.3**, the largest winnable pool off page 1 — and `data/solve.ts` is free now that
#829 merged. It was measured and **declined**: side-by-side against
`/solve/count-rows-per-day-including-missing-dates/` (**70 impr, pos 8.0** — near-identical
volume, 28 positions better) the two entries are structurally the same page — same
section set, same FAQ count, same 3 enduring sources. The delta is query saturation,
not page quality, so a copy edit is a guess with no in-run re-measure. Recorded as a
finding rather than dressed up as a lever.
**Top `blocked-by-human` bullet:** decide `MEMORY_PRESET` in prod (⏱ ~5 min, **0 days
old**, PR #835 drafted). The launch-sequence bullet — the only one that can move real
strangers off 0 — is **idle 44 days since 06-13**; its `SK-PIVOT-016` gate is **0/5
green** (no ops workload on the public MCP surface yet ⇒ criteria 1–3 unstartable;
temporal golden 2/3; `/agents` memory dashboard unshipped). Every criterion is
agent-movable and `MEMORY_PRESET=1` is its prerequisite — which is the top bullet.
**Dark (rule 8, reported not pulled):** engine **#8 BIRD 0.5382** / **#9 Spider
0.2222**; rows **#4/#5/#16**'s stranger-dependent criteria (N = 0 until the launch
bullet fires); row **#15**'s opencheck arm (free-lane saturation, remedy costs money
⇒ rule 4).

**Rule 6 clean** — CI + Security + Release-npm green on `main@4ddd24d` (07-27 06:28Z);
all 10 `deploy-*` workflows green (07-27 03:07–03:27Z). Local gates re-run from a
clean install: typecheck exit 0, lint 0 errors, test exit 0.
Open PRs **6** — **#839** (founder-actions log), **#837** (reach R-04 headless
route), **#836** (daily run 146, `/agents` stdio card), **#835** (draft,
`MEMORY_PRESET`), **#826** (changesets, `@nlqdb/sdk@0.2.2`), draft **#719** (oldest,
**10 days**). Step-0 checked: this run's five files (3 workflows, 1 new test,
`blocked-by-human.md`) appear in **none** of them; `docs/scorecard.md` overlaps #836
under the exemption every run carries.

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
| 7 | Surface yield | posts **36**. **Google (GSC 28d, 06-27→07-25, live): 8 clicks / 496 impr / pos 16.9**; 100 pages / 586 impr; top queries 17 rows / 24 impr. Clicks stay concentrated: **`/security/hall-of-fame/` is 4 of the 8** (11 impr, pos 13.5) — run 145 gave that page site chrome, so the next pull is the first that can show whether the onward links convert. Strengthen-next, top 3 of 50 off page 1: **`/solve/running-total-cumulative-sum-in-sql/` 72 / 36.3 ← declined, see above** · `/solve/find-rows-with-no-match-in-another-table/` 31 / 14.3 · `/vs/` 18 / 17.9. **First-party referral: 8 pageloads / 3 referrers** (google 5, baidu 2, bing 1); **5 of the 8 on `/security/hall-of-fame/`**. **New — URL Inspection: `/agents/` reads "Duplicate, Google chose different canonical" (it picked `/agents`, crawled 07-19).** Verified live: `/agents` 301s to `/agents/`, and both the rendered `<link rel=canonical>` and the sitemap carry the slash ⇒ a stale pre-`SK-WEB-027` crawl, not a live defect. Only a lever if it survives a fresh crawl | `scripts/gsc-pull.ts` + `scripts/rum-pull.ts`. Total-impression breadth is the bottleneck, not per-page CTR at N ≤ 12 impr (noise) |
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
| 15 | E2E manual-suite freshness | **0.492** (recomputed live 07-27; was 0.563 — **pure time-decay, no suite changed state**). Per suite `pass × freshness`: **mcp 0.671** (✅ 07-25) · **sdk 0.648** (✅ 07-24) · **examples 0.648** (✅ 07-24) · **opencheck 0** (latest ❌ 07-24; last success 07-17 ⇒ 10.2 d, freshness floored — the documented NVIDIA-free-tier saturation flake, remedy costs money ⇒ rule 4). Purely opencheck-limited; the other three decay ~0.14/day | Never dispatch opencheck alongside another consumer of its lanes. Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.5382); agentic-frontier ≥ 0.80 (0.693); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (N=0); destructive-op retry (N≈0); MCP in 3+ hosts (0); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 removed the 428 wall |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **10** (re-counted live 07-27, pinned grep; **+1 vs 9**). The new one is `mcp-server`'s `sk_live_*`-as-MCP-credential question, already mirrored as founder queue bullet #3 — a founder-only call, so it is queue depth, not agent backlog. Rest: elements 2; agent-memory-pivot / anonymous-mode / cli / docs-site / e2e-coverage / events-pipeline / quality-eval 1 each | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, case-insensitively, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. De-prioritised as a default lever (07-11 /weekly); pullable only under a step-2 priority-3 waiver |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** — re-swept live on a fresh build: **126** pages, **3,238** internal + **15** cross-app links, `_redirects` carrying 115 bare-path 301s | target 0 — `node apps/web/scripts/check-links.mjs` + `client-nav-integrity.test.ts`. Four standing blind spots: external inbound links to bare paths (≥107 impr), published npm entrypoints (row #19), **hosts** not paths (`www.nlqdb.com` serves the whole site un-redirected — bounded, `rel=canonical` is absolute; fix is a zone Redirect Rule ⇒ console click), and pages with no links at all (run 145) |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **1 open, fixed in-repo, awaiting republish.** Checked live on the registry this run: `@nlqdb/sdk` latest is still **0.2.1**, so every surface telling a reader to `npm i @nlqdb/sdk` still hands them an `ERR_MODULE_NOT_FOUND`. #823 fixed + guarded the manifests; returns to 0 when **`0.2.2` reaches the registry — release PR #826 open, unmerged 2 days**. `@nlqdb/mcp` is live at **0.1.0** (0.1.1 waits in the same PR). The 0-phantom sweeps (`mcp-tool-`/`cli-verb-`/`sdk-method-integrity`) are unchanged | target 0 |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) + parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal fires |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **0 failed / 9 blocked** — carried from the 07-26 live walk; the scheduled CI walk [30194859852](https://github.com/nlqdb/nlqdb/actions/runs/30194859852) (07-26 08:34Z) concluded success. **Not re-walkable from a `/daily` container**, a new standing constraint: `@playwright/test` pins `~1.60.0`, which wants Chromium **1223**; the image ships **1194**, so the walker aborts with `Executable doesn't exist`. CI-only until they agree | target **0 `failed`** ✅; `blocked` reported beside it, never folded in. All walks stop at the 428 `challenge_required` (Turnstile declining a datacenter IP by design, `SK-ANON-012`), so steps past the ask are **observed, not proven** |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 22 | Channels live with attributable yield | **4 live** — organic search + dev.to + npm + GitHub (per-bucket split lives only in the ledger). Each carries its ledger `utm_source` in-repo; **npm's does not reach the registry** and the SDK install is broken (row #19) until #826 merges. MCP official registry published 07-22 (`com.nlqdb/nlqdb`); Glama crawl-listed; Smithery 0 / PulseMCP 0. First-touch attribution live since 07-19 on both create arms; `source_json` non-null **0**, for want of strangers, not instrument | **weekly focus: → ≥ 5 live.** Yield from `/app/admin` + `scripts/rum-pull.ts`, never estimated. Growth comes only from not-yet-live channels (R-05 registries, human-norm venues) |
| | **Human queue** — the one non-automatable actor | **depth 4** (was 5), head ⏱ ~5 min · **0 days old**; oldest bullet 44 days (`SK-PIVOT-016` gate **0/5**) | [`blocked-by-human.md`](blocked-by-human.md). Open PRs 6, oldest 10 days (draft #719) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/20 + 12 memory `/vs` pages | mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; rest Neon/infra-gated |
| | Memory-quality eval (`SK-QUAL-023`) | **free-chain EX 93.33% (14/15)** — run 69, [GHA 29314389843](https://github.com/nlqdb/nlqdb/actions/runs/29314389843); p50 1168 ms / p95 7036 ms. Per-axis 3/3 except **temporal 2/3** (`SK-PIVOT-016` criterion 4) | 15 gold-verified questions, 4 axes + analytical; free-only, no baseline |

## Shipped distribution

**36 canonical posts live under `nlqdb.com/blog/`** (`SK-BLOG-001`). The registry is
`apps/web/src/data/blog.ts` — the one place the list exists; venue variants and full
lesson gists stay in `research/distribution-queue.md`.

## Last change

**2026-07-27 (run 147)** — **Numbers moved: founder-queue depth 5 → 4 (its head
row was resolved work), and Neon branch-creation sites with a server-side reap
0 of 3 → 3 of 3.** Orphan lifetime goes from **unbounded** (observed: 25 days for
`pr-571`, 17 for `pr-648`) to ≤ 7 d for `pr-N`, ≤ 6 h for `e2e`, ≤ 2 h for
`ci-smoke-*`. Lane: CI health under rule 6 — a cap collision fails
`test-api-smoke-neon` on a PR whose diff is innocent, so it taxes every other lever's
delivery.

**The defect.** Every cleanup path we own can be skipped. `preview-app.yml`'s runs
only on `pull_request: closed`; `ci.yml`'s `if: always()` delete and its >1 h sweep
both need a live runner, and the sweep fires on the *next* CI run — which is the run
the cap is already failing. Three creation sites, zero server-side bound. `pr-571`
(closed 07-02) and `pr-648` (merged 07-10) each held a slot for weeks until a human
deleted them by hand.

**Verified against the live API before it was written (P2).** Neon's `expires_at`
(RFC 3339, ≤30 days, [docs](https://neon.com/docs/guides/branch-expiration)) was
probed on **this project's Free plan**, then the fix was probed again by POSTing the
byte-exact body `ci.yml` now renders: **HTTP 201**, expiry echoed back, and
`connection_uris` still present — the field that would have turned every CI run red
had the plan silently ignored or rejected it. Both probe branches deleted; the project
ended the run where it started, 5 of 10.

**The guard.** `neon-branch-expiry-integrity.test.ts` scans `.github/workflows/`,
bounds each candidate to its own `curl` invocation, keeps only POSTs to the
*collection* endpoint (so a `/branches/${id}` delete can't be mistaken for a create),
and asserts each payload maps `expires_at` to a shell variable computed by `date -u`
inside ≤ 30 days. Nothing else would catch a drift: the workflows are not typechecked,
not linted for semantics, and a missing expiry costs nothing until the tenth branch.
**Negative-tested six ways, each failing loudly:** drop `expires_at` from any one of
the three sites (1 fail each) · widen `preview-app` to 60 days, past Neon's ceiling
(1 fail) · hardcode a literal timestamp instead of the computed one (1 fail) · blind
the scanner on 2 of 3 sites (the `≥ 3` floor fires, so a scanner that quietly matches
nothing cannot pass vacuously). An earlier attempt at that last mutation edited the
*list* GET rather than the create POST and wrongly read as green — re-run against the
POST it fails correctly.

**Recorded, not fixed (one lever per run).** The canonical-eval resume protocol is
unexecutable as documented. Spider's checkpoint cache is keyed
`eval-full-spider-${{ github.sha }}-`, and `/daily` explicitly says to "re-dispatch on
the **same SHA**" — but `workflow_dispatch` only accepts a branch or tag ref, and
`main` moved three times (`7579430` → `e438ec5` → `4ddd24d`) in the 4.5 h after
[30230040001](https://github.com/nlqdb/nlqdb/actions/runs/30230040001) budget-stopped
on `d961475`. That checkpoint is now unreachable, and any `main` dispatch restarts
from zero. Left alone deliberately: the key's comment states its purpose ("so two code
versions never share a canonical run's partial scores"), so changing it supersedes a
recorded rationale — **P1** makes that the founder's call, not a silent edit. BIRD is
unaffected in practice: it finished in one 38-minute window.

**Step 3.** Queue **2**-deep (< 3) ⇒ no forced publish, and this run's lever taught a
lesson too specific to syndicate. The dev.to drip refused as designed (newest article
15.9 h ago < 20 h), so no queue line was edited.

**No new `SK-*`** (P5/D5): `e2e-coverage/FEATURE.md` and `ci-permissions/FEATURE.md`
already record the 10-branch ceiling as the constraint and orphaned branches as the
hazard. Per `AGENTS.md` §10.2 this is code-wrong / decision-right — the code lacked a
backstop the decisions already implied. A record restating "clean up what you create"
fails D5.

**Gates:** `typecheck` exit 0 all packages · `lint` **0 errors, 41 warnings, 2 infos =
repo baseline** · `test` exit 0 across all packages · all three edited workflows parse
as YAML and their rendered payloads parse as JSON · link sweep **0 dead / 0
redirecting** on 126 pages · gate 3 prints nothing · **D4** every edited doc under
20480 B.
**KPI (GLOBAL-025):** advances **onboarding** — the founder's scarcest resource stops
being spent on a queue row that was already done, and the recurring CI-red that
delayed every merge is closed at the source; **degrades none** — no engine, API,
migration, runtime code, external call or bundle touched; three workflow payloads and
one test.

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
