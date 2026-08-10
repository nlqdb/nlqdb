# Scorecard — current state

Point-in-time tracker, regenerated each [`/daily`](../.claude/commands/daily.md)
run. Current state only — no changelog (≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md`.

**Weekly focus number (2026-07-28 →, founder-set, advisor session):**
**The [`SK-PIVOT-016`](features/agent-memory-pivot/decisions/SK-PIVOT-016-dogfood-launch-gate.md)
dogfood gate — criteria green: 0/5 → 5/5.**
Founder directive 2026-07-28 (advisor session): the operating focus is the **dogfood
gate** — nlqdb's own agents running a real memory workload through the public MCP
surface. Execution track:
[`agent-memory-pivot/worksheets/dogfood/INDEX.md`](features/agent-memory-pivot/worksheets/dogfood/INDEX.md)
(`D-01..D-07`), which carries the per-criterion owner. Every criterion is agent-movable;
only the founder may loosen one, and the gate is condition-gated — never dated.
(Re-affirmed by [`/weekly`](.claude/commands/weekly.md) 2026-08-08, #954: "distribution
monoculture has no conversion yield" — the gate stays the number, not more content.)
**Prior focus (superseded 2026-07-28):** acquisition — channels live with attributable
yield → ≥ 5 (row #22, now 4), [`GLOBAL-038`](decisions/GLOBAL-038-gtm-pmf-instrumentation.md).
Acquisition levers stay pullable when no dogfood lever is — as does premium-chain work
(`SK-LLM-017`, row #20), one rank below.

**Worst number today (run 174, 2026-08-09):** the **weekly-focus `SK-PIVOT-016` dogfood gate 0/5**
stays the worst number — but it is **one 1-run API change from pullable, all agent work**: live-tested
08-09 (the `sk_mcp_` key auths, `GET /v1/databases` 200; preset create **401**, cookie-session-only) —
extend preset create to user-scoped keys (SK-PIVOT-010 as amended 08-09, **founder-confirmed 08-10**),
then D-04 moves criteria 1/2/3 and D-06 → criterion 5. Only criterion **4** (ops-temporal 0/4) stays
blocked (E-09, GLOBAL-037 — both unblock paths non-daily). **This run is a NULL run**
(step 2): after a full live measurement sweep, no lever cleared the "delta measurable *this run*"
bar (rule 3). Run 173's rule-7 mandate — diversify off the 5-run content-page rut (168–172) — was
pursued: I checked the highest-impression page (already on-page-maxed), docs-ambiguity (row #17),
the D4 20 KB gate, a fresh dead-link sweep, and the standing `@sveltejs/kit` cookie-advisory
re-check. **None yielded a value-decidable in-run delta.** The finding is in "Last change".
**Weekly-focus gate (don't overwrite mid-week):** dogfood **0/5**, unchanged — **the next
run's lever is the preset-create-for-keys change, then D-04** (founder-confirmed 08-10);
criterion 4 stays GLOBAL-037-blocked.
**Top `blocked-by-human` bullet:** fire the Show HN launch sequence (⏱ ~30 min,
**idle 57 days since 06-13**) — the only bullet that can move real strangers off 0, still
condition-gated on the `SK-PIVOT-016` gate (0/5). #2 = submit nlqdb to the Anthropic **connector
directory** (money-gated, since 07-21). #3 = approve the EK-03 ToS/DPA "not allowed" delta (⏱ ~15 min,
since 08-07, from /ek #923). Queue **depth 3**, head age 57 d is the real cycle time.
**Dark (rule 8, reported not pulled):** engine **#8 BIRD 0.5382** (14 d) / **#9 Spider 0.2222** (21 d
stale — resume deferred: async multi-window, `main` moved since the 07-27 checkpoint); rows **#4/#5/#16**
stranger-dependent (N = 0 until launch); row **#15** opencheck (free-lane saturation, remedy costs money ⇒
rule 4); dogfood criterion 4 only (E-09 GLOBAL-037-blocked) — **D-04 exited dark 08-04** (secret set;
live-tested 08-09: one API change remains, top block).

**Rule 6 — GREEN, re-verified live this run.** Branch based on `main@9bd48a7` (#951, current HEAD).
`bun install` (2503 pkgs) + `bun run typecheck` (exit 0) + `bun run lint` (exit 0, 41 pre-existing
warnings) + `bun run test` (**1041 passed / 15 skipped, exit 0**) all green. Latest **CI** on `main`
HEAD `9bd48a7` = **success** (run 31286286867). **Deploy API/web** last verified **success** on
`a0245a36` (2026-08-07, run 515/363) — no `main` code deploy has failed since. Diff is **docs-only**
(`docs/scorecard.md`, this regen). No built surface changed. Open PRs (**1**): only draft **#719**
(Infisical secrets research, oldest, **23 days**) — this run's files overlap it **not** (scorecard
regen is step-0-exempt).

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel, bot-filtered** (RUM + GSC **both re-pulled live 08-09** this run: `rum-pull.ts` 7d 08-02→08-09 unsampled; `gsc-pull.ts` 28d 07-10→08-07. Users/DBs carried from 07-27 remote-D1, no channel newly live) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF RUM) | **235 pl / 232 vis** raw, **real-browser floor 60 pl / 59 vis** (08-02→08-09, re-pulled 08-09; 175 synthetic cut). **60 vs 63 (08-08) = −3 window-slide** (7d window advanced a day; not a regression). Real-browser landings led by `nlqdb.com/` (**13**), `docs…/agent-memory/` (7), `docs…/` (6), `/blog/guard-advertised-capabilities…/` (6), `/app/new/` (3), `/solve/track-background-job-run-history/` (2) | cut rule: `bot=1` or `userAgentBrowser ∈ {Unknown, ChromeHeadless}` or CF-classified bot ⇒ real-browser is a floor. Read at **7d** (28d comes back sampled) |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (`*@example.com`, `*@preview.dev`) — live remote-D1 07-27; no channel newly live to produce a signal |
| 3 | DBs total | **254** (07-27 live remote-D1, flat across runs 143–147; synthetic — walker/preview churn) | stranger subset ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not measurable** (`SK-ONBOARD-007`). Re-verified live 07-27: `databases.source_json is not null` = **0** | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12; founder-owned) | share with ≥ 2 asks |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **110** content pages (`/solve` 40 + `/vs` 31 + `/blog` 39); **118** sitemap URLs submitted to GSC — **unchanged this run** (null run, no new surface shipped). Unpublished blog drafts **0** (queue drained run 171) | leading input to rows #1–#3; `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **39** (dev.to drip **skipped** — step 3 is null-run-skipped). **GSC re-pulled live 08-09** (28d 07-10→08-07): **8 clicks / 648 impr / pos 20.2** — **impressions +8 vs run 173 (640)**, position flat, clicks flat. Top-impression page `/solve/running-total-cumulative-sum-in-sql/` **135 impr / pos 35.5 / 0 clicks** (page-4, Strengthen-next #1, unmoved). Best *converter*: `/security/hall-of-fame/` **4 clicks / 14 impr / pos 13.6** (4 of the site's 8 total clicks — bug-bounty queries, off page 1). **Referral yield (RUM 08-09):** 13 pl from 3 referrers — google 6, bing 5, baidu 2 (flat). `/blog/guard-advertised-capabilities…` drew 6 real-browser pl (4 via bing). Canonicalization spread persists: GSC still lists `http://…/count-consecutive-days-streak…` (23 impr) + `/vs/wrenai` (pos 6.2) & `/agents` (pos 4.8) un-slashed — http→https + trailing-slash is a zone/console setting ⇒ reported not pulled | `gsc-pull.ts` + `rum-pull.ts`. Total-impression breadth compounds; per-page conversion does not — the run-173 finding, re-confirmed |
| | **Engine** — BIRD 07-26 · Spider 07-19 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.5382** (268/500, 07-26 canonical on `d961475`, [run 30212657876](https://github.com/nlqdb/nlqdb/actions/runs/30212657876)) — **14 d old, staleness trigger fired** (> 7 d), but **dark (rule 8)**: resume is async multi-window and `main` has moved since the 07-27 checkpoint (SHA-keyed cache would miss). Full-run confirmed (`SK-QUAL-011`) | target 0.65 / **Phase 2 floor 0.60** — gap 6.2 pp. Offline levers exhausted; SC dead (#619) |
| 9 | Spider raw EX | **0.2222** (30/135, 07-19 canonical on `04fa3d0`, [29682993836](https://github.com/nlqdb/nlqdb/actions/runs/29682993836)). The 07-27 re-dispatch [30230040001](https://github.com/nlqdb/nlqdb/actions/runs/30230040001) exited **partial** (checkpoint left behind, `SK-QUAL-013` budget-stop) | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004)) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06, `SK-QUAL-022`) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers analytics (live 07-27 09:25Z) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | **2,185 / 0** (0.00%) | mcp-server 1,627 / 0; web 11,310 / 0; events-worker 3 / 0 — **zero errors across all four workers** (⇒ events queue ~0 ops/day, well under the 7K ceiling) |
| 13 | nlqdb-api wall-time p50 / p95 | **p50 16.4 ms / p95 1.48 s** (p99 1.69 s) | mcp-server p50 691.3 ms / p95 1.30 s. Read p95: account-level distribution is dominated by cheap routes, so p50 is **not** `/ask` — an `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.420** (recomputed 07-28; was 0.492 — pure time-decay, no suite changed state). Per suite `pass × freshness`: **mcp** (✅ 07-25) · **sdk** (✅ 07-24) · **examples** (✅ 07-24) · **opencheck 0** (latest ❌ 07-24; last success 07-17 ⇒ freshness floored — documented NVIDIA-free-tier saturation flake, remedy costs money ⇒ rule 4). Purely opencheck-limited | Never dispatch opencheck alongside another lane consumer. Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.5382); agentic-frontier ≥ 0.80 (0.693); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (N=0); destructive-op retry (N≈0); MCP in 3+ hosts (0); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 removed the 428 wall |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **≈12** (unchanged — surveyed this run; all genuinely-open bullets are code-slice, founder/money, `/ek`-owned, or external-blocked ⇒ none value-decidable-and-resolvable in-run). The `@sveltejs/kit` cookie bullet was re-checked (P2): latest `kit@2.69.3` **still declares `cookie ^0.6.0`** ⇒ advisory delete-trigger not met, bullet correctly stays parked | target ↓ 0. Method: `- ` bullets under `## Open questions` not matching `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`, judged for genuine openness. Lane-3 meta — reported not pulled |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** — **swept live this run** on `main`: **134 pages, 4,254 internal + 20 cross-app links**, all resolve (up from run 166's 127 pages / 3,535 internal — content growth). This run's diff is docs-only, so #18 carries at target 0 | target 0 — `check-links.mjs` + `client-nav-integrity.test.ts`. Standing blind spots: external inbound links to bare paths, npm entrypoints (#19), `www.`/`http://` host un-redirected (zone Redirect Rule ⇒ console click — GSC still shows an `http://` solve variant indexed) |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **0 ✓** (resolved 07-29): `#826` published `@nlqdb/sdk@0.2.2` + `@nlqdb/mcp@0.1.1`; a clean-dir install resolves `dist/` entrypoints. `npm view` src-pointing `main` is a cosmetic packument artifact — the installed tarball carries `prepack`'d `dist`. 0-phantom sweeps unchanged | target 0 ✓ |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) + parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal fires |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **0 failed / 9 blocked** — carried from the 07-26 live walk; CI walk [30194859852](https://github.com/nlqdb/nlqdb/actions/runs/30194859852) concluded success. **Not re-walkable from a `/daily` container** (standing constraint): `@playwright/test` pins `~1.60.0` → wants Chromium **1223**; the image ships **1194**, so the walker aborts with `Executable doesn't exist`. CI-only until they agree | target **0 `failed`** ✅; `blocked` reported beside it. All walks stop at the 428 `challenge_required` (Turnstile declining a datacenter IP by design, `SK-ANON-012`), so steps past the ask are **observed, not proven** |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 22 | Channels live with attributable yield | **4 live** — organic search + dev.to + npm + GitHub. npm attribution reaches the registry for all 3 packages (`@nlqdb/sdk@0.2.2`, `@nlqdb/mcp@0.1.1`, `@nlqdb/cli@0.1.1`, each `?utm_source=npm`). MCP official registry published 07-22 (`com.nlqdb/nlqdb`); Glama crawl-listed; Smithery 0 / PulseMCP 0. First-touch attribution live since 07-19 on both create arms; `source_json` non-null **0**, for want of strangers, not instrument | **weekly focus: → ≥ 5 live.** Yield from `/app/admin` + `scripts/rum-pull.ts`, never estimated. Growth comes only from not-yet-live channels (R-05 registries, human-norm venues) |
| | **Human queue** — the one non-automatable actor | **depth 3**; head is **#1 Show HN** (**57 days** since 06-13, gated on the dogfood gate — whose remaining prereqs are agent work per SK-PIVOT-010 as amended, founder-confirmed 08-10); #2 Anthropic connector directory (money-gated, 07-21); #3 EK-03 ToS/DPA approval (08-07, /ek #923) | [`blocked-by-human.md`](blocked-by-human.md). Open PRs: **1** — draft **#719** (oldest, 23 days) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/27 + 12 memory `/vs` pages | mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; rest Neon/infra-gated |
| | Dogfood track D-* (`SK-PIVOT-016` gate, **weekly focus**) | **2/7** (D-03 ✅, D-02 🟢 code-complete) — gate **0/5** (criterion 4: temporal 2/7 = synthetic 2/3 + ops 0/4; scoped as E-09 in #879) | mirrors [`dogfood/INDEX.md`](features/agent-memory-pivot/worksheets/dogfood/INDEX.md). **D-02 🟢** convergent sync + `memory-sync.yml` (dark until secret + D-04); D-07 ⛔ on D-04 |
| | Memory-quality eval (`SK-QUAL-023`) | **27-q free-chain EX 59.26% (16/27)** — run [30413719690](https://github.com/nlqdb/nlqdb/actions/runs/30413719690) 2026-07-29, `main@5cc4bd1`, `resumable:false`. Per-axis (free): consolidation 4/5, analytical 4/5, retrieval 3/5, forgetting 3/5, **temporal 2/7 (synthetic 2/3, ops 0/4)** — the weak axis gating `SK-PIVOT-016` criterion 4 (the next engine lever, E-09-blocked) | 27 gold-verified questions, 5 axes; free-only, no baseline (a measurement, never canonical) |

## Shipped distribution

**40 canonical `/solve` pages** + **39 `/blog` posts** + **31 `/vs` pages** live under `nlqdb.com/`
(`SK-SOLVE-001` / `SK-BLOG-001` / `SK-CMP-001`). The registries are `apps/web/src/data/{solve,blog,competitors}.ts`
— the one place each list exists; venue variants stay in `research/distribution-queue.md`.

- **This run (174):** no new surface — a **null run**. Step 3 (artifact + dev.to drip) is null-run-skipped;
  the blog draft queue is empty (drained run 171) and the dev.to drip self-throttles to 1/day, so the
  queue drains on the next non-null run.

## Last change

**2026-08-09 (run 174)** — **NULL run** (step 2): a full live measurement sweep found no lever clearing
the "delta measurable *this run*" bar (rule 3). Diff is `docs/scorecard.md` only.

**Measured live this run (fresh reads, not carried):**
- **Rule 6 health** — `bun install` + `typecheck` (0) + `lint` (0) + `test` (**1041 passed**, 0) all green;
  CI on `main` HEAD `9bd48a7` = success; deploys last-green `a0245a36` (08-07). Main is healthy — no red-main lever.
- **Row #18 links** — swept live on the fresh `astro build`: **134 pages, 4,254 internal + 20 cross-app,
  0 dead / 0 redirecting** (up from run 166's 127 / 3,535 — pure content growth, no regression).
- **Row #1 visits** — RUM re-pulled live 08-09 (7d): real-browser floor **60 pl** (−3 window-slide vs 63),
  raw 235 / 232, 175 synthetic cut.
- **Row #7 yield** — GSC re-pulled live 08-09 (28d): **648 impr (+8) / 8 clicks (flat) / pos 20.2 (flat)**.
  Top-impression `/solve/running-total-cumulative-sum-in-sql/` unmoved at 135 impr / pos 35.5 / 0 clicks.

**Why NULL (the lever sweep, honestly).** Run 173's rule-7 mandate was to diversify off the 5-run
content-page rut (168–172). I did the sweep it directed and every candidate failed the rule-3
"re-measurable this run" bar: (a) **strengthen the highest-impression page** — `/solve/running-total…`
is already on-page-maxed (5 FAQs, FAQPage + HowTo + BreadcrumbList JSON-LD, canonical, bidirectional
internal links); its pos-35 rank is off-page authority, not a single-run in-code edit, and any SERP
delta only surfaces in GSC weeks later. (b) **Engine #8/#9** — dark (async multi-window resume, `main`
moved since the 07-27 checkpoint). (c) **Weekly-focus dogfood 0/5** — the create-verb change + D-04 are next-run agent work
(founder-confirmed 08-10), not this run's; criterion 4 GLOBAL-037. (d) **UX walkers** — un-runnable in-container (Chromium 1194 vs pinned 1223),
and run 172 already confirmed no genuine flow defect. (e) **Docs-ambiguity #17** — every genuinely-open
bullet is code-slice, founder/money, `/ek`-owned, or external-blocked; the one standing re-checkable
bullet (`@sveltejs/kit` cookie advisory) re-verified as still-parked (kit@2.69.3 still declares
`cookie ^0.6.0`). (f) **D4/dead-links** — no fresh breach; large docs are exempt or longstanding.
Manufacturing a marginal content edit purely for a diff is the busywork step 2 forbids, so this run
ships the measurement.

**The standing argument for next runs.** Conversion is flat at ~0 because impressions land on page 4+
(`/solve/running-total…` at pos 35) or, where a page *does* rank on page 1 (`/security/hall-of-fame/`
pos 13.6 earns 4 of 8 total clicks; `/solve/count-rows-per-day…` pos 8.4), breadth already exists — the
gap is off-page authority (backlinks) and the human-gated launch (dogfood gate → Show HN; the memory-DB
provisioning itself is agent work per SK-PIVOT-010 as amended), neither an in-container daily lever.
This is the condition the null-run + four-null-proposal machinery exists for.

**Four-null check.** Run 173 was a measurement/no-delta run; this run 174 is a null ⇒ **2 consecutive**.
Runs 168–172 all shipped content deltas. No four-null streak, so no proposal earned; back to null runs
until a real in-run lever appears — the next one is named: preset-create-for-keys, then D-04.

**KPI (GLOBAL-025):** advances **distribution** (converts two carried rows #1/#7 into fresh live reads
and re-verifies row #18 surface integrity live); **degrades none** (docs-only, all gates green).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
