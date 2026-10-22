# Scorecard — current state

Point-in-time tracker, regenerated each [`/daily`](../.claude/commands/daily.md)
run. Current state only — no changelog (≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md`.

**Goal ([`GLOBAL-043`](decisions/GLOBAL-043-attach-first-autonomous-dba.md)):** attach, propose, apply, verify, revert — the Postgres spike (market proof) and [rateme12's D1 attached](history/dogfood-iterations/002-rateme12-attach.md) (dogfood); KPIs A–C below are the measure.

**Q1–Q5 resolved 2026-09-05 → [`GLOBAL-041`](decisions/GLOBAL-041-autonomous-dba.md):**
Phase 2 exits on Phase A alone; acquisition paused; BIRD/Spider = regression
alarm only; premium tier stays. Retired rows dropped below.

**Focus (founder-written 2026-10-22 — `/weekly` keeps it):** the `GLOBAL-043` sequence in `daily.md` step 2 — **the 2-week Postgres spike (one applied index, before/after p95 on its hot fingerprint) alongside the D1 attach on the real rateme12 → if the spike passes, the deletion PR series, one subsystem per PR → the playbook's proposal kinds, KPI B each.**
`GLOBAL-041` sequence in `daily.md` step 2 — **Neon role cap (500/500,
smoke red) → deterministic `insert()` (0 LLM calls on the write path) →
rateme12 §5b journeys wired 0/5 → cutover (n/14 days) → returning builders
(n/10).** KPI 1 is now read on rateme12's own inserts; the run-log windows
below are history.

**Worst number today (run 258, 2026-10-21) — KPI 1 formal sample n = 0, owned by the engine lane (`schema-widening`).** No rateme12 write reaches `insert()` until §5b steps 6 → 9 wire the clone, and step 6 waits on the founder-minted key.
**This run's lever:** none yet under the new sequence — see [`GLOBAL-043`](decisions/GLOBAL-043-attach-first-autonomous-dba.md) and `daily.md` step 2.
**Dogfood canary (regression check, not the KPI-1 sample):** on each merge, `dogfood-write.yml` waits for its commit's Deploy API run, then writes the run record, changed scorecard rows and new blocked-by-human bullets to `db_agent_memory_v1_3a8a72` at the CI boundary, through `insert()` (0 LLM calls). It sends the synthetic-walker UA, so it never moves the admin KPI-1 `inserts_infer_*` counters. **Window 3 (from run 252, `insert()` path): 18/20 landed, 2 MISS** (both #1185-merge re-sends, inspected run 254). Run 257's merge landed 2/2, both on seen fields ([39621627517](https://github.com/nlqdb/nlqdb/actions/runs/39621627517)). The session still never holds the prod key.
**Top `blocked-by-human` bullet:** **Pick the spike database and hand its connection string to CI** (0 d). Queue **depth 8**. Open PRs: 1 draft, not adoptable. #1191 merged and Release npm passed, so `@nlqdb/sdk` 0.5.0 with `insert()` is published. #1179 (7 d) has an un-draft probe that is a live free-LLM call, which rule 3 forbids, on a write path `insert()` replaced.
**Dark (rule 8, reported not pulled):** engine **#8 BIRD 0.5382** (64 d) / **#9 Spider 0.2222** (71 d, async multi-window resume); rows **#4/#5** stranger-dependent (N=0 until launch); row **#15** opencheck lane (remedy costs money ⇒ rule 4).
**Anti-rut (rule 7):** suspended while the `daily.md` step-2 sequence runs.
**Rule 6:** `main` (`33ac0dd`) is green: CI, Dogfood write and every deploy workflow passed on their latest `main` runs.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel, bot-filtered** (RUM + GSC **live-pulled 09-02** this run; Users/DBs carried from 07-27 remote-D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF RUM) | **live 09-19** (09-12→09-19, unsampled — counts exact): raw 459 pl / 266 vis; real-browser floor **112 pl / 99 vis** (synthetic cut 347 pl / 167 vis = stranger-walker + CF-bot); real nlqdb landings `/blog/ephemeral-staging-persistent-registry/` (10 pl), `/`, `/blog/http-200-error-in-body/`, `/solve/find-top-n-rows-per-group/`; `rateme12.com/` 12 pl = parked-domain noise (GLOBAL-039). Referral: 3 pl / 3 refs (yandex, bing, www.bing) | cut rule: `bot=1` / `userAgentBrowser ∈ {Unknown, ChromeHeadless}` / CF-bot ⇒ real-browser is a floor |
| 2 | Registered users, real strangers | **~7** (live remote-D1 10-16; personal-domain/gmail accounts with ≥ 1 DB, last query 08-12 → 10-14) | **32 total** (was 9 on 07-27). Founder/company/test split by email domain is approximate. Was dark on a stale 07-27 read — un-darked |
| 3 | DBs total | **36** (live remote-D1 10-16, 18 signed-up tenants, 255 asks; 15 queried in 30 d). The **261 synthetic anon DBs** (walker-made, 0 asks) were deleted 10-16, and the sweep now drops synthetic DBs 24 h after create | stranger subset = row #2 |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not measurable** (`SK-ONBOARD-007`). The **dogfood workload** (run 176): **100 % (10/10)** through the public MCP surface (= gate criterion 2) | target ≥ 95 %. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12; founder-owned) | share with ≥ 2 asks |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **112** content pages (`/solve` **41** + `/vs` 31 + `/blog` 40; unchanged this run — CTR lever, not a new page). Unpublished blog drafts **0** (queue drained) | leading input to rows #1–#3; `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **40**. **GSC live 09-17** (28d 08-20→09-17): **967 impr / 30 query rows, 8 clicks** (pos 21.0). CTR lane exhausted: page-1 zero-click pages already carry hand-written SERP meta; the rest is position/authority-gated (launch-gated). Paused lane (`GLOBAL-041`) | `gsc-pull.ts` + `rum-pull.ts` |
| | **Engine — `GLOBAL-043` KPIs first** (headline) then the interface KPI | | `GLOBAL-043` roadmap |
| EA | KPI A — time to first proposal after attach | **unmeasured — the spike builds the instrument** | < 5 min (`GLOBAL-043`) |
| EB | KPI B — proposals applied with a measured p95 gain / attached DB / 30 d | **unmeasured — the spike builds the instrument** (on D1 also the rows-read delta) | ≥ 1 with a delta the founder would pay for (`GLOBAL-043`) |
| EC | KPI C — regressions auto-reverted / regressions applied | **unmeasured — the spike builds the instrument** | 100 %, 0 user action |
| | Retired by `GLOBAL-043`: E1 (KPI 1 first-insert inference), E2 (KPI 2 evolution), E3 (KPI 3, now KPI B) | | |
| | **Engine — interface KPI (regression alarm only, `GLOBAL-041`/`SK-QUAL-002`)** — BIRD 07-26 · Spider 07-19 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.5382** (268/500, 07-26 canonical on `d961475`, [run 30212657876](https://github.com/nlqdb/nlqdb/actions/runs/30212657876)) — **33 d old, staleness trigger fired**, but **dark (rule 8)**: resume is async multi-window and `main` moved since the 07-27 checkpoint | regression alarm only (`SK-QUAL-002`, `GLOBAL-041`) — no target, no floor |
| 9 | Spider raw EX | **0.2222** (30/135, 07-19 canonical on `04fa3d0`, **40 d old**). 07-27 re-dispatch exited **partial** (`SK-QUAL-013` budget-stop) | regression alarm only — no target. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004)) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67 % → agentic 69.33 %, 150-q smoke, 07-06, `SK-QUAL-022`) | diagnostic only (`SK-QUAL-004`); no floor |
| | **Ops** — 7d, CF Workers analytics | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | **Last incident 08-14** (`SK-LLM-046`, authed `/v1/ask` 401s ~1.5 h; fixed #992, hardened #993/#1001). No live re-pull (no CF-analytics container access) | the 07-27 "2,185/0" reading is stale |
| 13 | nlqdb-api wall-time p50 / p95 | **p50 16.4 ms / p95 1.48 s** (07-27, carried) | mcp-server p50 691.3 ms / p95 1.30 s. `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers. **Premium meter live 08-14** but $0 while no paying customer; premium chain routes free-tier / BYOLLM lanes at $0 |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.00 today** — sdk/examples/mcp last success **09-08** (35 d ago ⇒ freshness 0: [sdk #41](https://github.com/nlqdb/nlqdb/actions/runs/34240215865) / [examples #19](https://github.com/nlqdb/nlqdb/actions/runs/34240219429) / [mcp #42](https://github.com/nlqdb/nlqdb/actions/runs/34240222183)); opencheck **0** (07-17, dark — costs money, rule 4). Worst number today; not a DBA lever (step-2 lever order), so re-dispatch is only a candidate when no KPI-1 lever is pullable | Never dispatch opencheck alongside another lane consumer. Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 exit gate = `GLOBAL-041` Phase A | **Gate RED — §6.1 readiness 5/5 green (R5 on its first live merge, run 253); rateme12 sample n = 0.** The retired run-log sample ended at 2 HIT / 10 MISS; the proxy walk reads 100 % (10/10, run 224). Love gate: 0/14 days, 0/10 builders. | ≥ 95 % of rateme12's unseen-field `insert()`s with 0 `llm.*` spans; nothing else gates Phase 2 |
| 17 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** — swept run 166; docs-only diffs since | target 0. Standing blind spots: external inbound links to bare paths, `www.`/`http://` host un-redirected (GSC still indexes `http://` `/solve/count-consecutive-days-streak-in-sql/`; fix is a zone Redirect Rule ⇒ console) |
| | **Product-readiness** — client-blocking gaps | | |
| 18 | Live-surface claim integrity | **1** (found run 232): `docs.nlqdb.com/sdk` and `SK-SDK-012` advertise `runSql({ dryRun })` / `nlq run --dry-run`, but neither the SDK, `/v1/run` nor the CLI implements it. The `SK-SDK-013` guard checks method names only, so it passes. Package entrypoints stay ✓ (#826, 07-29) | target 0 |
| 19 | Hosted-premium readiness (§6 build-before-signal) | **LIVE 08-14** — `premium.live=true` in prod (`premiumConfigured(env)`). schema ✅ · BYOLLM lanes ✅ · picker web ✅ + parity ✅ · CTA ✅ · **premium chain ✅ live** (#987 meter, #992 bring-back, #996 live-lane billing, #1001 free-chain fallback) · spend-cap UI ⬜ (Lago-parked) | paid plan **shipped**; §6 signal effectively tripped. Meter fires; $0 while no paying customer |
| 20 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **FLOW-005 re-walked live 2026-09-08 (run 200): 6/6 PASS** (curl-based MCP discovery + auth-wall against `mcp.nlqdb.com`, agent-runnable). **Playwright walker launch fixed run 194** — `browser.ts` now falls back to the prebuilt Chromium when the pinned revision is absent, so it launches in-container (was: download-attempt fail on the `chromium-1234` pin). Full walk still **CI-canonical** (`acquisition-health.yml`): the sandbox's proxy-stripped direct egress blackholes UDP/443 ⇒ cross-host nav intermittently `ERR_QUIC_PROTOCOL_ERROR` (~2/3 runs fail step 1), so no reliable container pass-count; carried **0 failed / 9 blocked** from 07-26. #999 (08-16) fixed the `/app/new/` 428 dead-end | target **0 `failed`** ✅; anon walks stop at the 428 `challenge_required` (Turnstile, `SK-ANON-012`) |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 21 | Channels live with attributable yield | **4 live** — organic search + dev.to + npm + GitHub. MCP official registry published 07-22; Glama crawl-listed; Smithery/PulseMCP 0. First-touch attribution live since 07-19; `source_json` non-null **0**, for want of strangers, not instrument | → ≥ 5 live. Growth comes only from not-yet-live channels (R-05 registries, human-norm venues) |
| | **Dogfood iteration** — [`GLOBAL-042`](decisions/GLOBAL-042-dogfood-iteration-loop.md) loop | | brief: [`002-rateme12-attach.md`](history/dogfood-iterations/002-rateme12-attach.md) |
| 22 | Dogfood 002 — rateme12 attached (D1) | **unmeasured — the attach builds the instrument** (001, the migrate plan, retired 2026-10-22) | KPI A–C on rateme12's D1 |
| | **Human queue** — the one non-automatable actor | **depth 7**. Head: **mint the rateme12 clone's `sk_live_` key** (2 d; §5b steps 6 → 9 wait on it). #2 rateme12 cutover + 10 builders (6 d, gated on §5b step 9). #3 **Show HN launch** (129 d, gated on the love gate). #4 email-router deploy+walk (PR #1134; human-only Worker deploy; since 09-18, 32 d). #5 Anthropic connector (money-gated, 07-21). #6 PulseMCP + mcp.directory (09-01). #7 nlqdb-memory → cc-marketplace (09-04). | [`blocked-by-human.md`](blocked-by-human.md). Open PRs at step 0: **0 non-draft + 2 drafts** (#1191, 2 d; #1179, 7 d). After this run: **1 non-draft** (run 257). |

## Shipped distribution

**41 canonical `/solve` pages** + **40 `/blog` posts** + **31 `/vs` pages** live under `nlqdb.com/`
(`SK-SOLVE-001` / `SK-BLOG-001` / `SK-CMP-001`). The registries are `apps/web/src/data/{solve,blog,competitors}.ts`.

- **This run (256):** no distribution change; the lane is paused (`GLOBAL-041`). Earlier runs: `git log`.

## Last change

**2026-10-21 (run 258)** — **`daily.md` step 2, `/app/dba` v0: the change ledger is readable. On a real Postgres 16 walk, the owner could see 0/9 of the schema changes an 8-call rateme12-shaped `insert()` stream made before this change and 9/9 after, newest first, each with its undo statement; 0 LLM calls.** `GET /v1/databases/:id/changes` (owner only, 404 otherwise) → `client.listChanges(dbId)` (SDK minor changeset) → `/app/dba` (avatar menu → Schema changes): a DB picker that persists `?db=` across reloads, an empty state that names the next action (`client.insert()` / `nlq insert`), and an error state. `nlq` and MCP don't have it yet; the gap is tracked in `engine-migration/FEATURE.md` (`GLOBAL-003`). **GLOBAL-025 UX** advanced: the DBA's work is visible and inspectable on reload (P6 durable proof). No KPI degrades: one new read route, and the write path is untouched (performance floor). Canary: run 257's merge landed 2/2, so window 3 stands at 18/20.

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
