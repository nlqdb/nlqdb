# Scorecard — current state

Point-in-time tracker, regenerated each [`/daily`](../.claude/commands/daily.md)
run. Current state only — no changelog (≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md`.

**Goal ([`GLOBAL-042`](decisions/GLOBAL-042-dogfood-iteration-loop.md)):** iteration 001 — [rateme12 on nlqdb](history/dogfood-iterations/001-rateme12.md); its §6.1 readiness table is the engine work queue, KPI 1 below is the measure.

**Q1–Q5 resolved 2026-09-05 → [`GLOBAL-041`](decisions/GLOBAL-041-autonomous-dba.md):**
Phase 2 exits on Phase A alone; acquisition paused; BIRD/Spider = regression
alarm only; premium tier stays. Retired rows dropped below.

**Weekly focus (2026-09-04 →, founder-set with `GLOBAL-041`):** **Phase A
widen-on-write — first-insert inference rate** (KPI 1, floor ≥ 95 % on the
Phase A dogfood workload: `/daily`'s own writes through `@nlqdb/sdk`, first
200 unseen-field inserts in a 14-day window — dogfood DB not yet created,
window not open). Build order: `GLOBAL-041`.

**Worst number today (run 198, 2026-09-06) — WEEKLY-FOCUS KPI 1 (first-insert inference rate) reads `null` at N=0: the live instrument (run 196) has no numerator because the widen-on-write path is unbuilt. This run built the typed widen-plan contract + its SK-HDC-003 layer-1 validator — `WidenPlanSchema` in `@nlqdb/db`, the parse half of `GLOBAL-041` Phase A step 2.**
The weekly focus (2026-09-04, `GLOBAL-041` Phase A) is **KPI 1** — the numerator (`asks_extend_ok`) stays 0 until the extend path absorbs a write, so the rate is blind. Step 0: **open PRs = 0** — clean slate; branch even with `main@c4b4cab` (#1105).
**Why this lever:** engine KPIs are lever priority #1 (founder-set 2026-09-04) and step-2 lever #1 is the `GLOBAL-041` Phase A build order (`kind=extend` → **extend prompt** → compile-write-ddl → validator → transaction → `schema_hash` rewrite → trace parity → dogfood → E2E). BIRD/Spider dark (async multi-window, `main` moved); UX-flow rows #21/#15 green; distribution paused (`GLOBAL-041`). Steps 3–4 (compiler + allow-list) landed run 197; the widen path's LLM-output shape (step 2) had **no runtime gate** — a real SK-HDC-003 defense-in-depth gap, since its sibling create path validates every plan through `SchemaPlanSchema`. The Zod contract is the pure, zero-hot-path-risk piece that must exist before the untrusted extend-prompt output can flow into the compiler.
**Lever (this run):** added `WidenPlanSchema` / `AddColumnOpSchema` to `@nlqdb/db` (`packages/db/src/types.ts`) — the canonical Zod contract for the typed widen plan `{ create_tables[], add_columns[] }` the extend prompt emits (JSON, never DDL — `GLOBAL-037`). It reuses the create path's `ColumnSchema`/`TableSchema`/`IdentifierSchema` and adds the two widen-only refinements (nullable, no DEFAULT — `SK-SCHEMA-008`/`009`) plus the non-empty-plan guard, one grammar across **parse → compile → allow-list**. `compile-write-ddl.ts` now derives `WidenPlan`/`AddColumnOp` from it (was a hand-written TS type with no runtime guard). **Number moved:** row 16 (Phase 2 exit gate = `GLOBAL-041` Phase A) / row E1 build-order state — **extend path steps 3–4/9 → steps 2 (parse half)+3+4 built**, a named direct input to KPI 1. Details in "Last change".
**P2 UX-flow green** (FLOW-005 6/6, carried run 184). BIRD/Spider dark.
**Top `blocked-by-human` bullet:** Show HN launch sequence (⏱ ~30 min, **idle 84 days since 06-13**),
condition-gated on `GLOBAL-041` Phase A. #2 Anthropic connector directory (money-gated, 07-21). Queue **depth 2+**, head age 84 d.
**Dark (rule 8, reported not pulled):** dogfood criterion 3 (silent-wrong-answer, E-09/GLOBAL-037); criterion 4 (query-shape lever within ±5 pp noise); engine **#8 BIRD 0.5382** (41 d) / **#9 Spider 0.2222** (**48 d** stale, async multi-window resume); rows **#2/#4/#5/#16** stranger-dependent (N = 0 until launch); row **#15** opencheck lane (free-lane saturation, remedy costs money ⇒ rule 4).

**Rule 6 — GREEN.** Branch even with `main@c4b4cab` (#1105, latest). Health re-measured live post-`bun install`:
**`typecheck` exit 0** (workspace, 0 `error TS`), **`bun run check` exit 0** (biome; 53 pre-existing warnings, 0 errors), **`bun run test` exit 0** (db **287 passed** = 281 + 6 new `WidenPlanSchema` cases; llm 295, mcp 221, elements 104, events-worker 54, mcp-server 32; api suite green — see run log). CI + deploy-api + deploy-web green on `main@c4b4cab`; deploy-mcp `action_required` (standing manual environment-approval gate, founder territory — same on prior commits, not a broken build).
Diff (pure/additive, no hot-path change): `packages/db/src/types.ts` adds `WidenPlanSchema`/`AddColumnOpSchema` (+ derived types) after `SchemaPlanSchema`; `packages/db/src/index.ts` re-exports them; `db-create/compile-write-ddl.ts` derives `WidenPlan`/`AddColumnOp` from `@nlqdb/db` (drops the hand-written type, re-exports for call-path stability); new `packages/db/test/widen-plan-schema.test.ts`; `schema-widening` FEATURE status; scorecard. No content drain (acquisition paused, `GLOBAL-041`). **Open PRs: 0** at step 0.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel, bot-filtered** (RUM + GSC **live-pulled 09-02** this run; Users/DBs carried from 07-27 remote-D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF RUM) | **live 09-04** (08-28→09-04, sampled interval ≤10 — counts are CF-scaled estimates): raw 490 pl / 290 vis; real-browser floor **60 pl / 60 vis** (genuine ≈40 after the `rateme12.com` spam cut of 20 — GLOBAL-039 residual http noise); real nlqdb landings `/solve/analyze-agent-tool-call-logs/`, `/solve/`, `docs.nlqdb.com/`, `/solve/safely-give-ai-agent-database-access/`. Referral: google 10 → `/manifesto/` | cut rule: `bot=1` / `userAgentBrowser ∈ {Unknown, ChromeHeadless}` / CF-bot ⇒ real-browser is a floor. Sampled window (7d default) — treat sub-interval buckets as noise |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev — live remote-D1 07-27; no channel newly live to produce a signal. **Dark** (rule 8) — moves only on launch |
| 3 | DBs total | **254** (07-27 live remote-D1) + **1 dogfood** (`db_agent_memory_v1_3a8a72`, internal) | stranger subset ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not measurable** (`SK-ONBOARD-007`). The **dogfood workload** (run 176): **100 % (10/10)** through the public MCP surface (= gate criterion 2) | target ≥ 95 %. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12; founder-owned) | share with ≥ 2 asks |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **112** content pages (`/solve` **41** + `/vs` 31 + `/blog` 40; unchanged this run — CTR lever, not a new page). Unpublished blog drafts **0** (queue drained) | leading input to rows #1–#3; `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **40** (dev.to drip throttled this run — 1/day guard, 10 variants remain). **GSC live 09-04** (28d 08-04→08-31): top pages **~1443 impr / 160 rows**, ~4 clicks visible (hall-of-fame 3, terms 1). **CTR lane exhausted (fresh-confirmed):** page-1 zero-click pages carry hand-written SERP meta — `count-rows-per-day…` (pos 7.1 / 56 impr, metaed run 183) + `count-consecutive-days` (pos 11.1 / 52 impr) — snippet no longer the lever; position/authority-gated. "Strengthen next" leader `/solve/` index is pos 34.8 / 92 impr = page 4 (content/authority-gated, not snippet). Referral (live 09-04): google 10. Wedge pages 6/6 indexed | `gsc-pull.ts` + `rum-pull.ts`. Page-1 zero-click CTR pool metaed-out; page-2+ authority/launch-gated |
| | **Engine — `GLOBAL-041` KPIs first** (headline) then the interface KPI | | `GLOBAL-041` Phase A/B build order |
| E1 | **KPI 1 — first-insert inference rate** | **live instrument (run 196, `SK-SCHEMA-010`)** — `engine.firstInsertInferenceRate` = SUM(`asks_extend_ok`)/SUM(`asks_extend_ok`+`asks_extend_failed`); **null at N=0** today (numerator 0 until the extend path absorbs a write). **Path build (run 198): `WidenPlanSchema` typed contract + SK-HDC-003 layer-1 validator in `@nlqdb/db` — step 2 parse half; run 197: widen-DDL compiler + allow-list, steps 3–4;** routing (1), extend prompt/router op (2 exec half), transaction/rewrite (5–6), trace parity + dogfood + E2E (7–9) remain | Phase A exit floor **≥ 0.95**; live on `/app/admin` |
| E2 | KPI 2 — evolution-without-user-action rate | **unmeasured — build the instrument** (Phase B) | detected shape changes absorbed vs error / fresh DB |
| E3 | KPI 3 — optimizer yield | **unmeasured — build the instrument** (Phase B) | proposals applied / active DB / 30 d + p95 delta |
| | **Engine — interface KPI (regression alarm only, `GLOBAL-041`/`SK-QUAL-002`)** — BIRD 07-26 · Spider 07-19 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.5382** (268/500, 07-26 canonical on `d961475`, [run 30212657876](https://github.com/nlqdb/nlqdb/actions/runs/30212657876)) — **33 d old, staleness trigger fired**, but **dark (rule 8)**: resume is async multi-window and `main` moved since the 07-27 checkpoint. #1041 (planner re-head) now merged ⇒ a fresh BIRD/Spider re-measure is a valid next-run engine lever | regression alarm only (`SK-QUAL-002`, `GLOBAL-041`) — no target, no floor |
| 9 | Spider raw EX | **0.2222** (30/135, 07-19 canonical on `04fa3d0`, **40 d old**). 07-27 re-dispatch exited **partial** (`SK-QUAL-013` budget-stop) | regression alarm only — no target. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004)) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67 % → agentic 69.33 %, 150-q smoke, 07-06, `SK-QUAL-022`) | diagnostic only (`SK-QUAL-004`); no floor |
| | **Ops** — 7d, CF Workers analytics | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | **08-14 authed-`/v1/ask` OUTAGE (`SK-LLM-046`):** the premium go-live's AI-Gateway auth toggle 401'd every gateway lane (`llm_failed` on authed `/v1/ask`, ~1.5 h). Fixed by **#992**; **#993** direct-provider fallback + **#1001** free-chain fallback harden the SPOF. No live re-pull (no CF-analytics container access) | row carries the incident; the 07-27 "2,185/0" reading is stale. Detection gap = a candidate next lever |
| 13 | nlqdb-api wall-time p50 / p95 | **p50 16.4 ms / p95 1.48 s** (07-27, carried) | mcp-server p50 691.3 ms / p95 1.30 s. `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers. **Premium meter live 08-14** but $0 while no paying customer; premium chain routes free-tier / BYOLLM lanes at $0 |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.14 → 0.64 (this run's lever)** — sdk + examples had decayed to freshness 0 (last success 08-22, 11 d); re-dispatched both on `main@1fbd3e4` this run: **sdk ✅ ([run 33578892318](https://github.com/nlqdb/nlqdb/actions/runs/33578892318)) + examples ✅ ([run 33578894339](https://github.com/nlqdb/nlqdb/actions/runs/33578894339))**, freshness 1.0 each; **mcp ✅ 0.57** (last success 08-30, PR trigger); opencheck **0** (07-17, dark — costs money, rule 4). Score = mean(pass×freshness) over 4 = (1+1+0.57+0)/4 | Never dispatch opencheck alongside another lane consumer. Triage: `e2e-coverage/opencheck-operations.md`. Re-dispatch is a lever candidate (workflow_dispatch, agent-runnable) — pulled runs 182, 193 |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 exit gate = `GLOBAL-041` Phase A | **KPI 1 blind (null at N=0)** — extend path **steps 2(parse)+3+4 built** (run 198: `WidenPlanSchema` typed contract + layer-1 validator; run 197: widen-DDL compiler + allow-list); routing (1), extend prompt/router op (2 exec half), transaction/rewrite (5–6), trace+dogfood+E2E (7–9) remain; dogfood DB not created, 0/200 inserts, window opens at build-order step 8 | ≥ 95 % first-insert inference on the dogfood workload; nothing else gates Phase 2 |
| 17 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** — swept run 166; docs-only diff. GSC still shows the `http://` variant of `/solve/count-consecutive-days-streak-in-sql/` indexed (25 impr, pos 15.6) → splits signal with the https canonical; the redirect exists but Google indexed http — the fix is a zone Redirect Rule (console click, founder territory, standing blind spot) | target 0. Standing blind spots: external inbound links to bare paths, `www.`/`http://` host un-redirected (zone Redirect Rule ⇒ console) |
| | **Product-readiness** — client-blocking gaps | | |
| 18 | Live-surface claim integrity | **0 ✓** (resolved 07-29): `#826` published `@nlqdb/sdk@0.2.2` + `@nlqdb/mcp@0.1.1`; a clean-dir install resolves `dist/` entrypoints | target 0 ✓ |
| 19 | Hosted-premium readiness (§6 build-before-signal) | **LIVE 08-14** — `premium.live=true` in prod (`premiumConfigured(env)`). schema ✅ · BYOLLM lanes ✅ · picker web ✅ + parity ✅ · CTA ✅ · **premium chain ✅ live** (#987 meter, #992 bring-back, #996 live-lane billing, #1001 free-chain fallback) · spend-cap UI ⬜ (Lago-parked) | paid plan **shipped**; §6 signal effectively tripped. Meter fires; $0 while no paying customer |
| 20 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **FLOW-005 re-walked live run 184: 6/6 PASS** (curl-based MCP discovery + auth-wall, agent-runnable). **Playwright walker launch fixed run 194** — `browser.ts` now falls back to the prebuilt Chromium when the pinned revision is absent, so it launches in-container (was: download-attempt fail on the `chromium-1234` pin). Full walk still **CI-canonical** (`acquisition-health.yml`): the sandbox's proxy-stripped direct egress blackholes UDP/443 ⇒ cross-host nav intermittently `ERR_QUIC_PROTOCOL_ERROR` (~2/3 runs fail step 1), so no reliable container pass-count; carried **0 failed / 9 blocked** from 07-26. #999 (08-16) fixed the `/app/new/` 428 dead-end | target **0 `failed`** ✅; anon walks stop at the 428 `challenge_required` (Turnstile, `SK-ANON-012`) |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 21 | Channels live with attributable yield | **4 live** — organic search + dev.to + npm + GitHub. MCP official registry published 07-22; Glama crawl-listed; Smithery/PulseMCP 0. First-touch attribution live since 07-19; `source_json` non-null **0**, for want of strangers, not instrument | → ≥ 5 live. Growth comes only from not-yet-live channels (R-05 registries, human-norm venues) |
| | **Human queue** — the one non-automatable actor | **depth 2+**; head is the Show HN launch, oldest bullet **82 days** (now gated on `GLOBAL-041` Phase A); #2 Anthropic connector directory (money-gated, 07-21); registry-submit payloads parked by `/reach` | [`blocked-by-human.md`](blocked-by-human.md). Open PRs: **0** at step 0 |

## Shipped distribution

**41 canonical `/solve` pages** + **40 `/blog` posts** + **31 `/vs` pages** live under `nlqdb.com/`
(`SK-SOLVE-001` / `SK-BLOG-001` / `SK-CMP-001`). The registries are `apps/web/src/data/{solve,blog,competitors}.ts`.

- **This run (198):** no content drain (acquisition paused, `GLOBAL-041`). Weekly-focus **engine** lever:
  `WidenPlanSchema`/`AddColumnOpSchema` typed widen-plan contract + SK-HDC-003 layer-1 validator in `@nlqdb/db` — `GLOBAL-041` Phase A step 2 (parse half).
- **Run 197:** widen-DDL compiler `db-create/compile-write-ddl.ts` + allow-list `AT_AddColumn` — `GLOBAL-041` Phase A steps 3–4 (engine lever).
- **Run 196:** drained one dev.to variant — `most-active-user-is-your-test-suite` →
  [dev.to](https://dev.to/omer_hochman/your-most-active-user-is-your-test-suite-4bbb)
  (**8 variants remain**). No new `/blog` page (blog-draft queue empty). Weekly-focus engine lever (`SK-SCHEMA-010` KPI-1 instrument).
- **Run 195:** `SK-GTM-011` per-surface ask counter (weekly-focus instrument lever). Runs ≤ 194: `git log`.

## Last change

**2026-09-06 (run 198)** — **WEEKLY-FOCUS KPI 1 PATH BUILD: the typed widen-plan contract + its SK-HDC-003 layer-1 validator — `GLOBAL-041` Phase A step 2 (parse half).**
Step 0: open PRs = 0, branch even with `main@c4b4cab` (#1105). **Lever choice:** engine KPIs are lever priority #1 (founder-set 2026-09-04); KPI 1's live instrument (run 196) reads `null` at N=0 because the
widen-on-write path is unbuilt. Steps 3–4 (compiler + allow-list) landed run 197, but the widen path's LLM-output shape (`WidenPlan`) was a hand-written TS type with **no runtime gate** — a real SK-HDC-003
defense-in-depth gap, while its sibling create path validates every LLM plan through `SchemaPlanSchema` before `compile-ddl.ts`. The Zod contract is the pure, fully-testable, **zero-hot-path-risk** piece the
untrusted extend-prompt output (step 2 exec half, still to come) must pass before the compiler. BIRD/Spider dark; UX-flow rows #21/#15 green; distribution paused (`GLOBAL-041`). **Change:** added
`WidenPlanSchema` + `AddColumnOpSchema` (and derived `WidenPlan`/`AddColumnOp` types) to `packages/db/src/types.ts`, re-exported from `packages/db/src/index.ts` — the canonical `{ create_tables[], add_columns[] }`
contract the extend prompt emits (JSON, never DDL — `GLOBAL-037`). It reuses the create path's `ColumnSchema`/`TableSchema`/`IdentifierSchema` and layers the two widen-only refinements — nullable (`SK-SCHEMA-008`:
an already-populated table cannot take a NOT NULL add) and no DEFAULT (`SK-SCHEMA-009`: a defaulted add is a retype proposal) — plus a non-empty-plan `.refine` (the compiler's `empty_plan` guard lifted to
parse time), one grammar across **parse → compile → allow-list**. `apps/api/src/db-create/compile-write-ddl.ts` now imports `WidenPlan`/`AddColumnOp` from `@nlqdb/db` (dropping the local hand-written type) and
re-exports them for call-path stability; the compiler's own `validateAddColumn`/`validateCreateTable` guards stay as defence-in-depth for hand-built plans (presets, tests). **Verified:** new
`packages/db/test/widen-plan-schema.test.ts` (6 cases — accepts an add+create plan, defaults omitted `nullable` to true, rejects empty-plan / NOT NULL add / DEFAULT add / reserved-word identifier);
`compile-write-ddl.test.ts` (10) + `sql-validate-ddl.test.ts` (18) still green through the type rewire. **Number moved:** row 16 (Phase 2 exit gate) / row E1 build-order state — **extend path steps 3–4/9 →
steps 2(parse)+3+4 built** (a named direct input to KPI 1). KPI 1 itself stays `null` (numerator moves only when routing + prompt exec + transaction land, steps 1/2-exec/5–6). **KPI (GLOBAL-025 —
engine-quality pillar):** advanced; no KPI degrades — `typecheck` exit 0 (0 `error TS`), `check` exit 0 (53 pre-existing warnings), full `test` exit 0 (db 287 = 281 + 6 new, api 1492 passed / 26 skipped,
llm 295, mcp 221, events-worker 54, mcp-server 32). Diff is pure + additive; the `/v1/ask` hot path is untouched (the widen path is not yet wired into the orchestrator — Phase A steps 1, 2-exec, 5).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
