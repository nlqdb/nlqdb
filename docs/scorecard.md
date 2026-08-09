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
**Prior focus (superseded 2026-07-28):** acquisition — channels live with attributable
yield → ≥ 5 (row #22, now 4), [`GLOBAL-038`](decisions/GLOBAL-038-gtm-pmf-instrumentation.md).
Acquisition levers stay pullable when no dogfood lever is — as does premium-chain work
(`SK-LLM-017`, row #20), one rank below.

**Worst number today (run 173, 2026-08-08; blocker citation corrected by /weekly 08-08/09):** the
**weekly-focus `SK-PIVOT-016` dogfood gate 0/5** stays the worst number — but its rule-8 dark marking
was **stale**: `NLQDB_API_KEY` was set 2026-08-04 (`founder-actions-log.md` Era 5). **Live-tested
08-09**: the key auths (`GET /v1/databases` 200) but preset create returns **401** (cookie-session-only)
— so **D-04 is one 1-run API change from pullable**: extend preset create to user-scoped keys
(SK-PIVOT-010 as amended 08-09, founder-directed), then D-04 moves criteria 1/2/3 and D-06 →
criterion 5. Only criterion **4** (ops-temporal 0/4) stays blocked (E-09, GLOBAL-037 — both unblock
paths non-daily). **This run is a rule-7 distribution-yield measurement run**
(runs 168–172 were **5 consecutive distribution content-page pulls** — a 6th is anti-rut-forbidden). Per
rule 7 this run **measured the distribution lever's yield live** (fresh RUM + GSC reads, replacing carried
data) rather than shipping page #41. **Measured delta: real-browser visit floor 52 → 63 pl (+11), GSC
impressions 587 → 640 (+53, pos flat 19.7 → 19.9), referral yield flat 13 pl, 3/6 wedge pages indexed** —
the finding is in "Last change". **Next run must diversify** (a non-content lane) per rule 7.
**Weekly-focus gate (don't overwrite mid-week):** dogfood **0/5**, unchanged this run — **the next
run's lever is the preset-create-for-keys change, then D-04** (live-tested 08-09, see above);
criterion 4 stays GLOBAL-037-blocked.
**Top `blocked-by-human` bullet:** fire the Show HN launch sequence (⏱ ~30 min,
**idle 56 days since 06-13**) — the only bullet that can move real strangers off 0, still
condition-gated on the `SK-PIVOT-016` gate (0/5). #2 = submit nlqdb to the Anthropic **connector
directory** (money-gated, since 07-21). #3 = approve the EK-03 ToS/DPA "not allowed" delta (⏱ ~15 min,
since 08-07, from /ek #923). Queue **depth 3**, head age 56 d is the real cycle time.
**Dark (rule 8, reported not pulled):** engine **#8 BIRD 0.5382** (13 d) / **#9 Spider 0.2222** (**20 d**
stale — resume deferred: async multi-window, `main` moved since the 07-27 checkpoint); rows **#4/#5/#16**
stranger-dependent (N = 0 until launch); row **#15** opencheck (free-lane saturation, remedy costs money ⇒
rule 4); dogfood criterion 4 only (E-09 GLOBAL-037-blocked) — **D-04 exited dark 08-04** (secret set;
live-tested 08-09: one API change remains, top block).

**Rule 6 — GREEN.** Branch based on `main@a0245a3` (reach R-10 #922). Deploy state verified live this run:
**Deploy API** (run 515) + **Deploy web** (run 363) both last **success** on the current main HEAD SHA
`a0245a36` (both 2026-08-07). `bun install` restored container-lost workers/bun types (ephemeral-container
artifact, not a code change); `bun run typecheck` exit 0. Diff is **docs/data only** — `docs/scorecard.md`
(this regen) + `docs/research/distribution-queue.md` (run-68 dev.to venue → live URL). No built surface
changed. Open PRs (**1**): only draft **#719** (Infisical secrets research, oldest, **22 days**). This run's
files overlap **no** open PR (#719 is docs-research); scorecard regen is step-0-exempt.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel, bot-filtered** (RUM **re-pulled live 08-08** (`rum-pull.ts`, 7d 08-01→08-08, unsampled); GSC **re-pulled live 08-08** (`gsc-pull.ts`, 28d 07-09→08-06). Users/DBs carried from 07-27 remote-D1, no channel newly live) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF RUM) | **209 pl / 206 vis** raw, **real-browser floor 63 pl / 62 vis** (08-01→08-08, re-pulled 08-08; 146 synthetic cut). **Up from 52/50 (08-06).** Real-browser landings led by `nlqdb.com/` (**16**), `docs…/agent-memory/` (7), `docs…/` (6), `/blog/guard-advertised-capabilities…/` (6), `/app/new/` (3) | cut rule: `bot=1` or `userAgentBrowser ∈ {Unknown, ChromeHeadless}` or CF-classified bot ⇒ real-browser is a floor. Read at **7d** (28d comes back sampled) |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (`*@example.com`, `*@preview.dev`) — live remote-D1 07-27; no channel newly live to produce a signal |
| 3 | DBs total | **254** (07-27 live remote-D1, flat across runs 143–147; synthetic — walker/preview churn) | stranger subset ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not measurable** (`SK-ONBOARD-007`). Re-verified live 07-27: `databases.source_json is not null` = **0** | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12; founder-owned) | share with ≥ 2 asks |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **110** content pages (`/solve` 40 + `/vs` 31 + `/blog` 39); **123** sitemap URLs — **unchanged this run** (rule-7 measurement run, no new surface shipped). Unpublished blog drafts **0** (queue drained run 171) | leading input to rows #1–#3; `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **39**. **dev.to +1 this run** (`SK-BLOG-003` autonomous drip, not throttled): posted the run-68 variant `offline-llm-eval-rate-limits` → [live](https://dev.to/omer_hochman/your-offline-llm-eval-isnt-measuring-your-model-its-measuring-your-rate-limits-2ph0). **GSC re-pulled live 08-08** (`gsc-pull.ts`, 28d 07-09→08-06): **8 clicks / 640 impr / pos 19.9** — **impressions +53 vs run 167 (587)**, position flat. Top-impression page `/solve/running-total-cumulative-sum-in-sql/` **135 impr / pos 35.4 / 0 clicks** (page-4 rank, the biggest wasted-impression surface — Strengthen-next #1). **Referral yield (RUM 08-08):** 13 pl from 3 referrers — google 6, bing 5, baidu 2 (flat). `/blog/guard-advertised-capabilities…` drew 6 real-browser pl (4 via bing referral) — one post converting search referral. Index status: **3/6 wedge pages indexed**; 2 still **NEVER CRAWLED** (`build-vs-buy-agent-memory`, `expire-old-agent-memory`) 2 d after reach R-10 #922 added `/agents`-hub inbound links (too soon to judge). Canonicalization spread observed: GSC lists `http://…/count-consecutive-days-streak…` (22 impr) + `/vs/wrenai` & `/agents` un-slashed (pos 6.4/4.8) — http→https + trailing-slash redirect is a zone/console setting ⇒ reported not pulled | `gsc-pull.ts` + `rum-pull.ts`. Total-impression breadth is the bottleneck, not per-page CTR at N ≤ 12 impr |
| | **Engine** — BIRD 07-26 · Spider 07-19 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.5382** (268/500, 07-26 canonical on `d961475`, [run 30212657876](https://github.com/nlqdb/nlqdb/actions/runs/30212657876)) — **13 d old, staleness trigger fired** (> 7 d), but **dark (rule 8)**: resume is async multi-window and `main` has moved since the 07-27 checkpoint (SHA-keyed cache would miss). Full-run confirmed (`SK-QUAL-011`) | target 0.65 / **Phase 2 floor 0.60** — gap 6.2 pp. Offline levers exhausted; SC dead (#619) |
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
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **≈12** (unchanged — not this run's lever). #909 added `expert-knowledge-platform/FEATURE.md` with **5 forward-research bullets** — genuinely-deferred for a not-yet-built platform, so GLOBAL-033 "Parked until `<trigger>`" conversion is a **future** meta-run's fix; `/ek`-owned | target ↓ 0. Method: `- ` bullets under `## Open questions` not matching `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`, judged for genuine openness. Lane-3 meta — reported not pulled |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** — swept run 166 live on `main`: **127 pages, 3,535 internal + 20 cross-app links**, all resolve. This run's diff is docs-only (no built surface changed), so #18 carries at target 0 | target 0 — `check-links.mjs` + `client-nav-integrity.test.ts`. Standing blind spots: external inbound links to bare paths (≥107 impr), npm entrypoints (#19), `www.`/`http://` host un-redirected (zone Redirect Rule ⇒ console click — GSC now shows an `http://` solve variant indexed), link-less pages |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **0 ✓** (resolved 07-29): `#826` published `@nlqdb/sdk@0.2.2` + `@nlqdb/mcp@0.1.1`; a clean-dir install resolves `dist/` entrypoints. `npm view` src-pointing `main` is a cosmetic packument artifact — the installed tarball carries `prepack`'d `dist`. 0-phantom sweeps unchanged | target 0 ✓ |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) + parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal fires |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **0 failed / 9 blocked** — carried from the 07-26 live walk; CI walk [30194859852](https://github.com/nlqdb/nlqdb/actions/runs/30194859852) concluded success. **Not re-walkable from a `/daily` container** (standing constraint): `@playwright/test` pins `~1.60.0` → wants Chromium **1223**; the image ships **1194**, so the walker aborts with `Executable doesn't exist`. CI-only until they agree | target **0 `failed`** ✅; `blocked` reported beside it. All walks stop at the 428 `challenge_required` (Turnstile declining a datacenter IP by design, `SK-ANON-012`), so steps past the ask are **observed, not proven** |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 22 | Channels live with attributable yield | **4 live** — organic search + dev.to + npm + GitHub. npm attribution reaches the registry for all 3 packages (`@nlqdb/sdk@0.2.2`, `@nlqdb/mcp@0.1.1`, `@nlqdb/cli@0.1.1`, each `?utm_source=npm`). MCP official registry published 07-22 (`com.nlqdb/nlqdb`); Glama crawl-listed; Smithery 0 / PulseMCP 0. First-touch attribution live since 07-19 on both create arms; `source_json` non-null **0**, for want of strangers, not instrument | **weekly focus: → ≥ 5 live.** Yield from `/app/admin` + `scripts/rum-pull.ts`, never estimated. Growth comes only from not-yet-live channels (R-05 registries, human-norm venues) |
| | **Human queue** — the one non-automatable actor | **depth 3**; head is the Show HN launch, oldest bullet **56 days** (`SK-PIVOT-016` gate **0/5**); #2 Anthropic connector directory (money-gated, 07-21); #3 EK-03 ToS/DPA approval (08-07, /ek #923) | [`blocked-by-human.md`](blocked-by-human.md). Open PRs: **1** — draft **#719** (oldest, 22 days) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/27 + 12 memory `/vs` pages | mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; rest Neon/infra-gated |
| | Dogfood track D-* (`SK-PIVOT-016` gate, **weekly focus**) | **2/7** (D-03 ✅, D-02 🟢 code-complete) — gate **0/5** (criterion 4: temporal 2/7 = synthetic 2/3 + ops 0/4; scoped as E-09 in #879) | mirrors [`dogfood/INDEX.md`](features/agent-memory-pivot/worksheets/dogfood/INDEX.md). **D-02 🟢** convergent sync + `memory-sync.yml` (dark until secret + D-04); D-07 ⛔ on D-04 |
| | Memory-quality eval (`SK-QUAL-023`) | **27-q free-chain EX 59.26% (16/27)** — run [30413719690](https://github.com/nlqdb/nlqdb/actions/runs/30413719690) 2026-07-29, `main@5cc4bd1`, `resumable:false`. Per-axis (free): consolidation 4/5, analytical 4/5, retrieval 3/5, forgetting 3/5, **temporal 2/7 (synthetic 2/3, ops 0/4)** — the weak axis gating `SK-PIVOT-016` criterion 4 (the next engine lever, E-09-blocked) | 27 gold-verified questions, 5 axes; free-only, no baseline (a measurement, never canonical) |

## Shipped distribution

**40 canonical `/solve` pages** + **39 `/blog` posts** + **31 `/vs` pages** live under `nlqdb.com/`
(`SK-SOLVE-001` / `SK-BLOG-001` / `SK-CMP-001`). The registries are `apps/web/src/data/{solve,blog,competitors}.ts`
— the one place each list exists; venue variants stay in `research/distribution-queue.md`.

- **This run (173):** no new surface — a **rule-7 distribution-yield measurement run**. **dev.to +1** (autonomous
  drip, not throttled): posted the run-68 variant `offline-llm-eval-rate-limits` →
  https://dev.to/omer_hochman/your-offline-llm-eval-isnt-measuring-your-model-its-measuring-your-rate-limits-2ph0
  (queue line updated: dev.to venue dropped, live URL appended; lobste.rs stays human).

## Last change

**2026-08-08 (run 173)** — **Rule-7 distribution-yield measurement run** (no code, no new surface). Runs
168–172 were **5 consecutive distribution content-page pulls** (168/170/172 `/solve`, 169/171 `/blog`); rule 7
forbids a 6th identical pull and directs this run to **measure that lever's yield and record it** instead.

**Measured live (fresh reads replacing carried data):**
- **Row #1 visits** — RUM re-pulled live 08-08 (7d, unsampled): real-browser floor **52 → 63 pl (+11)**,
  raw 209 pl / 206 vis, 146 synthetic cut.
- **Row #7 surface yield** — GSC re-pulled live 08-08 (28d 07-09→08-06): **impressions 587 → 640 (+53)**,
  clicks 8 (flat), pos 19.7 → 19.9 (flat). Referral yield flat at **13 pl** (google 6, bing 5, baidu 2).
  Wedge index **3/6** (2 still NEVER CRAWLED 2 d after reach R-10's `/agents`-hub inbound links).

**The finding (why this matters, and what it argues for next).** Five content pulls + reach's inbound-link
work moved the *leading* indicators up modestly (+53 GSC impressions, +11 real-browser visits over the
window) but the *converting* indicators did not move: **0 clicks** on the top-impression page
(`/solve/running-total-cumulative-sum-in-sql/`, 135 impr stuck at page-4 pos 35.4), referral yield flat, and
still **0 real-stranger registrations** (row #2). The rut's honest read: content *breadth* is compounding
impressions but not *conversion* — new pages land far down the SERP and never earn the click. **Per rule 7,
next run must diversify off the content-page lane** — either strengthen the single highest-impression page to
climb from page 4 (a different sub-lever), or pull a non-content acquisition/UX lever. A 6th new page is
forbidden and, on this evidence, would not have moved a converting number anyway.

**Why not a different lever this run.** Weekly focus (dogfood 0/5) was carried dark (rule 8) — a
citation the 08-08 /weekly found stale: the secret was set 08-04; live-tested 08-09 — **one API
change, then D-04** (top block). Engine #8/#9 dark (async resume, `main` moved). Lane-2 walkers can't run in-container
(row #21 Chromium 1194 vs pinned 1223) and run 172 confirmed no genuine UX defect. Lane-3 docs-ambiguity is
rutted (164/165/167) and `/ek`-owned. So the rule-7 yield measurement — the sanctioned anti-rut action — is
the honest output; it converts two stale carried rows (#1 08-06, #7 run 167) into live reads and produces the
diversification mandate above.

**Four-null check.** Runs 172/171/170/169/168 all shipped deltas — no four-null streak, no proposal earned.

**Step 3 (artifact):** blog draft queue empty (drained run 171) ⇒ no forced-publish; step-3.2 drafting skipped
(optional, P5). dev.to drip drained one variant (run-68 → live above). **KPI (GLOBAL-025):** advances
**distribution** (records live yield of rows #1/#7 + 1 dev.to venue, a leading input to funnel rows #1–#3);
**degrades none** (docs/data only, all gates green).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
