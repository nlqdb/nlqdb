# Scorecard

Regenerated daily by [`/daily`](../.claude/commands/daily.md) step 1 from live
sources (D1, KV, CF GraphQL, `eval-baseline.ts`). One table; soft 5 KB cap
**relaxed while the agent-memory pivot is in flight** (GLOBAL-036) — the
20-row Pivot section mirrors [`agent-memory-pivot/worksheets/INDEX.md`](features/agent-memory-pivot/worksheets/INDEX.md)
so every WS-* / E-* status is visible at a glance; the section collapses
back to a one-line summary once the pivot completes. Published distribution
URLs land here when a queue entry ships.

**Weekly focus number:** *(none set — founder picks at the weekly session;
until then the daily lever targets the worst number below)*

**Worst number today:** real strangers reaching a first answer = **0**
(funnel/distribution lane) — gated by the engine (GLOBAL-027 valve), so the
engine-side worst, **Spider 0.1852 vs 0.75**, owns it. The bottleneck is **SQL
reasoning** (mismatches), not provider availability (Gemini key healed 06-17,
`SK-LLM-039`) and not value/literal grounding (`SK-QUAL-014` run 18:
`literal_only` = 0 — no mismatch fixable by literals alone). BIRD re-run 06-19
is **flat** (0.522 → 0.520, McNemar p=0.50) ⇒ directive levers (T13–T22)
**saturated**; the path to the gate floor is the §4 **reasoning** levers.
**#3 self-consistency** is now **fully dispatchable**: runner merged (#447,
`SK-QUAL-017`) + the `self_consistency`/`sc_temperature` smoke-job
`workflow_dispatch` inputs (run 42, baseline-safe vehicle — no-emit, never
overwrites the canonical baseline). **#1 DAIL-SQL retrieval** — selector +
masking + the **curated pool (#451, half (a))** + now the **T9-ablation wiring
`buildPlanSystem` (half (b), run 43)**: default off ⇒ static `PLAN_SYSTEM`
byte-for-byte, the eval `--retrieve-exemplars k` flag swaps in the retrieved
prefix (token-budget 0.935× of static — token-negative), so the next dispatch
A/Bs greedy-static vs greedy-retrieved. **#1 is now built end-to-end bar the
dispatch**; only the hot-path embedding index remains — the **pool grew 10 → 13
buckets** (run 46 +anti-join/NOT-IN negation + order-by-aggregate-limit top-N;
**run 48 +null-filter**), held precision@1 at 13/13. **Run 48 added a second
evidence source — a persona-bench ICP-retrieval probe** (`SK-LLM-041 ×
SK-QUAL-018`): over nlqdb's OWN 20 ICP queries the pool's retrieval precision@1
is **17/20 → 18/20** (the "who never logged in" P1 query flips off the
misleading anti-join NOT-IN demo onto the `IS NULL` demo; q8/q10 pinned misses).
The #3 EX delta is the
greedy-vs-SC smoke gap on the first N>=2 dispatch; both land the next canonical
dispatch (blocked today — both evals < 7 d, §5).

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel — bot-filtered, 2026-06-22 (live re-pull)** | | walkers = `flow-004-walker` source / `nlqdb-flow004-*` emails |
| 1 | Visits, 7d (CF Web Analytics) | 62 visits / 98 pageloads | was 94/147 (06-15); walker traffic still aging out of the 7d window |
| 2 | Waitlist rows, real | 1 of 79 | 78 walker/test/probe; the 1 is the founder → ~0 genuine strangers |
| 3 | Registered users, real strangers | 0 | 7 total = 3 founder/company + 4 test/dev accounts |
| 4 | Invite-valve crossings (KV `wl:invite-cap`) | 9/wk (06-13, carried) | cap 200/wk — no exhaustion risk; mostly walker-triggered; not re-pulled this run |
| 5 | Anon DBs with a recorded first answer | **113 of 113** | instrument fix (runs 1–3) holding; +12 since 06-15 (119 DBs total, 6 authed). Genuine-stranger subset still ~0 (rows #2/#3) — the real worst-number |
| | **Engine — BIRD 2026-06-19 · Spider 2026-06-17 (both fresh, < 7d)** | | `apps/api/src/gate/eval-baseline.ts` |
| 6 | BIRD raw EX | 0.520 | target 0.65; was 0.522 (06-12). Canonical re-run on current main (T20–T22): 260/500, `no_sql` 3 → 1. **Flat within variance** — McNemar b=38/c=37, p=0.50, no regression. Directive levers saturated; literal/value (§4 #2a) + date-encoding (§4 #2c) levers both falsified standalone offline (run 31) ⇒ reasoning levers (§4 #3/#1) next |
| 7 | Spider raw EX | 0.1852 | target 0.75; was 0.1704 (06-12). Gemini key restored 06-17 → `no_sql` 36 → 9 (`SK-LLM-039`). Run 33: external-knowledge injection (`SK-QUAL-016`). **Self-consistency `SK-QUAL-017` (§4 #3): vote core (34) + execution half (37) + temperature-sampling half (run 40) + **runner `--self-consistency N` / `--sc-temperature T` main-loop wiring (run 41)** — `samples>=2` branch in `runOneQuestion` (separate from `withExecRetry`): `samplePlans`→`voteOverSamples` over `executeRows`→score-the-winner; folds into checkpoint/budget-stop/`attempts`, `.scN` checkpoint variant. The lever is now end-to-end bar the CI `workflow_dispatch` input. EX delta next dispatch** |
| 8 | persona-bench | **20 q / 2 ICP schemas, dispatchable; 20/20 golds execute** | run 47 — batch 2 grew 12 → **20 q** (first `challenging` tier + anti-join/negation + multi-join shapes v0 lacked, the `SK-QUAL-014` mass `SK-LLM-041` targets). `loadPersonaBench` materialises both schemas to SQLite; `--dataset persona-bench [--persona P1\|P2]` scores the free chain. Additive new-branch, BIRD/Spider byte-untouched; free-chain EX = next dispatch (a `workflow_dispatch` job is the last half). `@nlqdb/eval` 258 tests, 78 → 118 persona-bench expect() calls |
| 9 | free-vs-frontier delta | null | agentic lane not yet run (`SK-QUAL-004`, target ≤ 25 pp) |
| | **Ops — 7d, CF Workers analytics (06-22 re-pull)** | | wall-time, all routes (not `/ask`-only) |
| 10 | nlqdb-api requests / errors | 990 / 0 (0.00%) | mcp 314 req, events-worker 37 req, both 0 err; 7d totals lower as walker traffic ages out |
| 11 | nlqdb-api wall-time p50 / p95 | 0.94 ms / 2.62 s (06-22) | `workersInvocationsAdaptive` wallTime; p50 trivial routes (static/CORS/health), p95 LLM-bound asks; `/ask`-only split needs Grafana `metrics:read` (agent has write-only key) |
| 12 | $ spend | ~$0 | free tiers across CF / Neon / LLM chain |
| | **Pivot — agent-memory wedge** (GLOBAL-036) | 13 / 20 + 3 memory /vs pages | tick ⬜→✅ with PR link on merge; mirrors `docs/features/agent-memory-pivot/worksheets/INDEX.md` |
| | *Messaging track — WS-\** | 11 / 13 (WS-07 ✅ 3/3, WS-09 ✅ 2/2, WS-12 ✅ 2/2) | pick when worst number is funnel / distribution |
| WS-01 | competitors.md anchor (Zep / Letta / LangMem) | ✅ | run 19 — §4 + threat matrix; unblocks WS-02 |
| WS-02 | memory `/vs` pages (one per run) | ✅ 3/3 | run 20 — **Zep ✅** (`/vs/zep`); run 21 — **Letta ✅** (`/vs/letta`); run 22 — **LangMem ✅** (`/vs/langmem`) — WS-02 closed |
| WS-03 | solve pages — sharpen + sibling | ✅ 2/2 | run 23 — **sharpen ✅**; run 25 — **analytical sibling ✅** (`analytical-queries-over-agent-memory`, the read-side report-over-memory wedge) |
| WS-04 | MCP tool + package + docs framing | ✅ | run 24 — three tool descriptions + `package.json` desc + `mcp.mdx` intro now lead with "analytical memory" (copy only; SK-PIVOT-003) |
| WS-05 | carousel analytics-over-memory slides | ✅ | run 26 — 2 analytics-over-memory slides (`GROUP BY category` + top-N `ORDER BY … LIMIT 5`), MCP surface; data-only `showcase-examples.ts` |
| WS-06 | Mem0 \| Zep \| Letta \| nlqdb capability matrix | ✅ | run 27 — **data ✅** (`agentMemoryMatrix.ts`, 9 honest rows + test); run 28 — **render ✅** (`AgentMemoryMatrix.astro`, four-up glyph grid, nlqdb accent column, no `<img>`) |
| WS-07 | `/agents` landing | ✅ 3/3 | run 30 — **skeleton + hero ✅**; run 31 — **matrix + moat ✅** (WS-06 matrix + typed-plan trust-boundary pipeline + FSL/BYO-key band); run 35 — **CTA + demand-signal ✅** (memory-shaped "try this query" → `agents.try_query_clicked` GLOBAL-024 → `/app/new`; Topnav `Agents` link; P2-keyed `/vs` cross-link). WS-07 closed → **unblocks E-06** |
| WS-08 | on-brand OG / social images | ✅ | run 42 — `scripts/og/gen-og.mjs` SVG→PNG generator + 5 committed `public/og/*.png` cards (`/agents` + the 4 P2 memory `/vs`); `ogImage` wired; generator stays out of `astro build` (SK-PIVOT-012) |
| WS-09 | "database, not a vector store" blog + live demo | ✅ 2/2 | run 30 — **blog draft ✅** (launch post in `distribution-queue.md`); run 41 — **live `/agents` demo ✅** — gate-honest fixture round-trip (`agent_memory` rows → English goal → compiled `GROUP BY` SQL → result table, server-rendered for AEO/no-JS per SK-PIVOT-004; "Run this query" button → `agents.demo_run_clicked` GLOBAL-024 signal; no open `/v1/ask`). WS-07 page existing cleared the #430 collision |
| WS-10 | FSL self-host messaging (GLOBAL-019 / arch §0 doc-fix shipped) | ✅ | run 28 — pricing self-host band + README "Models & plans" self-host line (FSL-accurate; no turnkey-image claim per WS-11 note) |
| WS-11 | pull `ghcr.io/nlqdb/api` self-host container forward | ⬜ | high · multi · WS-10 · infra-gated |
| WS-12 | home reweight + demote P1/P3/P4 to "also works for…" | ✅ 2/2 | run 43 band; run 44 `AlsoWorksFor` fold before CodePanel + Replaces (composition-only, nothing deleted, hero untouched) |
| WS-13 | headline reposition (hero / README / llms.txt / JSON-LD) | ⬜ | high · ~2 runs · WS-07, WS-12 · 🔒 **FOUNDER-GATED** |
| | *Engine track — E-\** | 2 / 7 | pick when worst number is engine quality / agent on-ramp |
| E-01 | `agent_memory_v1` schema preset for `db.create` | ✅ | run 29 module + run 30 wiring (SK-HDC-020): `db.create { preset: "agent_memory_v1" }` provisions the 4 tables deterministically, no LLM; gated behind `MEMORY_PRESET`. One follow-on: quality-eval ablation row (Neon-branch gated) |
| E-02 | additive MCP tool `nlqdb_remember` (no rename) | ✅ | run 31 (SK-PIVOT-008): server-built deterministic parameterised INSERT via `POST /v1/memory/remember` (never `/v1/run` — trust boundary), `wrong_preset` guard, SDK `remember()`, `nlqdb_remember` tool. Follow-ons: e2e Neon smoke (infra) + CLI `nlq remember` (Go) |
| E-03 | per-agent / end-user / thread scoping — **RLS, not query-rewriting** (SK-PIVOT-009, mechanism corrected run 32) | ⬜ | **high · security-critical** · ~2 runs · E-01 · Neon-gated |
| E-04 | TTL + cron sweep (`expires_at`) | ⬜ | low · 1 run · E-01 |
| E-05 | hybrid recall — pgvector + `nlqdb_recall` | ⬜ | high · multi · E-01 · infra-gated |
| E-06 | preset on-ramp — **authed** create surface (`MEMORY_PRESET`-gated) | ⬜ redirected | run 37 (SK-PIVOT-010): anon `/agents` CreateForm path infeasible (3 auth boundaries); blocked on `MEMORY_PRESET=1` in prod (dark) |
| E-07 | workload-analyzer rule: memory DBs → ClickHouse (Phase 3) | ⬜ | med · multi · E-01 + Phase-3 multi-engine |

## Deltas (recent runs)

- 2026-06-22 (run 50) — **D4 doc hygiene: `quality-score-source-of-truth.md`
  net-shrunk 21,229 → 20,322 B, back under the 20 KB cap.** No number-moving
  lever was non-colliding: engine (Spider 0.1852) is dispatch-gated (BIRD 06-19 /
  Spider 06-17 both < 7 d, §5) **and owned by #464**; #465 owns comparison-pages,
  #458 the SDK; §4 backlog exhausted (#1 owned, #2 falsified, #3 dispatch-only,
  #5/#6 blocked); growing persona-bench would collide with #464's
  `persona-retrieval.test.ts` (hardcoded 19/20). So per the loop the deliverable
  is the sanctioned cleanup of the engine progress bar agents read every run (a
  standing D4 offender per `blocked-by-human.md`). **Δ:** collapsed the 5 redundant
  prompt-directive-bullet rows (T10, T13–T16 — each "one bullet, measured combined
  in T17," bodies canonical in their `SK-LLM-*` per P3) into one row; all 5
  `SK-LLM-*` links kept, §3 table 19 → 15 rows, −907 B. **KPI:** onboarding/UX of
  the autonomous loop; **none degraded** — docs-only, BIRD 06-19 + Spider 06-17
  byte-untouched. Artifact deferred (avoids colliding with #464's
  `distribution-queue.md` edit; runs 47–48 precedent), draft parked: *"We cap
  every internal doc at 20 KB — even the engine-quality progress tracker."*
- 2026-06-22 (run 49) — **Distribution/UX: AEO-copy correctness fix — 5 comparison
  pages stop fabricating a phantom MCP `create_database` verb.** Worst number is
  still engine (Spider 0.1852), but it's dispatch-gated (BIRD 06-19 / Spider 06-17
  both < 7 d, §5) **and the engine lane is owned by the one open daily PR (#464,
  DAIL-SQL pool 12→13 + persona-bench retrieval); #458 owns the SDK lane** — so
  the non-colliding lever is a documented correctness bug on the distribution
  surface. The comparison-pages feature flagged it (Open questions): the 5 older
  `/vs` pages (Supabase / Vanna AI / Mem0 / Outerbase / Wren AI) named
  `create_database`, `ask`, `run` as MCP verbs that **do not exist** —
  [`SK-MCP-002`](features/mcp-server/decisions/SK-MCP-002-three-tools.md) is
  explicit there is **no `nlqdb_create_database` tool** (`nlqdb_query`
  materialises Postgres on first reference). Comparison FAQs are **lifted verbatim
  by AI search engines** (the feature's whole thesis, §Why this exists), so this
  copy was actively mis-teaching ChatGPT/Perplexity/Claude nlqdb's own API.
  **Δ (measured, before/after on the data file):** phantom-verb occurrences
  **10 → 0** across the 5 pages; corrected to the real trio
  `nlqdb_query` / `nlqdb_list_databases` / `nlqdb_describe` (+23 correct-tool
  mentions added); 3 stale `MCP server with provisioning verbs` labels aligned to
  `MCP server (agent-callable)` (the label the 4 newer pages use). Locked by **2
  new `competitors.test.ts` invariants** (no `create_database` token; every
  `nlqdb_*` token in the SK-MCP-002 allowed set) — web tests **11 → 13**,
  `676` expect() calls, astro-check 0 errors, biome clean. **KPI:** UX +
  onboarding (accurate third-party-keyword on-ramp copy); **none degraded** —
  web-data-only, zero engine/SDK/funnel-code touch, BIRD 06-19 + Spider 06-17
  byte-untouched. **Artifact (step 3) deferred** to avoid colliding with #464's
  in-flight `distribution-queue.md` append; queue once #464 lands. Draft:
  *"Your competitor comparison pages are teaching ChatGPT the wrong API — we
  found 10 fabricated tool names on our own site and pinned a test so they can't
  come back."*
- 2026-06-22 (run 48) — **Engine: §4 #1 DAIL-SQL pool grown 12 → 13 + a new
  persona-bench ICP-retrieval probe (`SK-LLM-041 × SK-QUAL-018`).** Worst number
  is engine (Spider 0.1852), dispatch-gated (both baselines < 7 d, §5), and the
  one open PR (#458, external SDK packaging) owns no engine lane — so the
  non-colliding, offline-measurable engine slice is the retrieval lever on
  nlqdb's *own* ICP. Built a probe that runs `retrievePlanExemplars` over the 20
  persona-bench questions (the real target distribution, not synthetic held-out
  probes) and scores precision@1 against a structural expected-bucket map. **It
  surfaced a real gap:** the headline "who never logged in" P1 query (q3)
  retrieved the **anti-join NOT-IN** demo — the wrong shape for a plain
  `WHERE col IS NULL` (a NULL *attribute*, not a missing *relation*). Added one
  `null-filter` pool row (placed after anti-join so an ambiguous "never
  <relation>" still ties to anti-join). **Δ (offline, same-probe before/after —
  the `SK-LLM-036/037` pattern):** ICP retrieval **precision@1 17/20 → 18/20**;
  the pool's own held-out precision@1 **held 13/13**; q3 flips anti-join →
  `IS NULL`, while q12/q16 ("never placed an order / recalled") + the in-subquery
  probe stay put (bidirectional guard — the verb discriminates, not "never").
  The 1 remaining miss (q8 masks to `ratio-cast`) is **documented as a
  selector-side artifact**, not absorbed. **KPI:** engine quality (ICP-relevant
  NL→SQL); **none degraded** — prod byte-identical (`buildPlanSystem` default-off
  `k<=0` ⇒ static `PLAN_SYSTEM`; BIRD 06-19 / Spider 06-17 untouched); 209 llm
  tests (was 208), 262 eval (was 258). Artifact: "Your few-shot pool, tested
  against your *own* users' queries — not just the benchmark" queued.
- 2026-06-22 (run 47) — **Engine: persona-bench grown 12 → 20 questions
  (`SK-QUAL-018` documented "one batch per run" follow-on).** Worst number is
  engine (Spider 0.1852), but it's dispatch-gated (both baselines < 7 d, §5) and
  the open daily PRs own the live engine/docs/SDK lanes (#461 SK-LLM-041 pool,
  #462 distribution-queue D4, #458 SDK packaging) — so the non-colliding,
  offline-measurable engine slice is growing nlqdb's *own* ICP benchmark. Batch 2
  adds 8 hand-authored, hand-checked golds across the existing two schemas: the
  **anti-join / negation** (`NOT IN` — "never placed an order", "never recalled")
  and **challenging multi-join** shapes v0 lacked, plus the first `challenging`
  difficulty tier. These are precisely the `SK-QUAL-014` structural loss mass
  `SK-LLM-041`'s new pool exemplars target, so persona-bench can now *measure*
  whether those exemplars help on ICP-shaped queries. **Δ (offline, the
  gold-executability invariant — no LLM, no quota):** #8 — **12/12 → 20/20 golds
  execute non-empty**; persona-bench assertions 78 → 118 expect() calls;
  `@nlqdb/eval` 258 tests green, typecheck + biome clean. **KPI:** engine quality
  (the ICP-relevant NL→SQL number); **none degraded** — additive data-only (no
  `runner.ts`/chain/scorer edit), PR CI never fires keys (`SK-QUAL-002`),
  BIRD 06-19 + Spider 06-17 byte-untouched, free-chain EX = next dispatch.
  Artifact (step 3) deferred this run to avoid colliding with #462's in-flight
  full rewrite of `distribution-queue.md`; queue once #462 lands.
- 2026-06-22 (runs 43–46) — engine + distribution + hygiene wave (all merged;
  BIRD 06-19 + Spider 06-17 untouched). **Engine:** §4 #1 DAIL-SQL retrieval
  T9-ablation wiring `buildPlanSystem(goal,schema,k)` (run 43, static at `k<=0`)
  + curated pool grown 10 → 12 buckets with anti-join `NOT IN` + group-order-limit
  (run 46, `SK-LLM-041`, precision@1 12/12, prod byte-identical); persona-bench v0
  (run 43, `SK-QUAL-018`, 12 golds execute) → runner-wired dispatchable
  `EvalDataset` (run 44, `@nlqdb/eval` → 258). **Distribution:** WS-12 closed
  (`AgentMemoryBand` + `AlsoWorksFor` fold, runs 43–44) → messaging 11/13, pivot
  13/20. **Hygiene:** `distribution-queue.md` net-shrunk 35.9 → 9.1 KB under cap
  (run 46). **Measurement (run 45, live):** visits 62/98, waitlist 79 rows (1 real
  = founder), users 7 (0 real strangers), anon DBs 113/113 first-answer, api 990
  req / 0 err, p50 0.94 ms / p95 2.62 s, ~$0 — genuine-stranger lane still 0,
  engine-gated. KPI engine quality / onboarding; none degraded.
- 2026-06-21 (runs 37–42) — engine + distribution staging wave (all merged/additive; BIRD 06-19 + Spider 06-17 untouched). **§4 #1 DAIL-SQL retrieval** built end-to-end offline: retrieval core (`few-shot-select.ts` value-mask + Jaccard + top-k, run 38), schema-aware selector (run 40), pool-curation mask + 10-row curated pool precision@1 10/10 (runs 39, 42a, `SK-LLM-041`). **§4 #3 self-consistency** (`SK-QUAL-017`): execution half (run 37) + `temperature`-sampling half (run 40, default greedy ⇒ `SK-LLM-024` byte-identical) + runner `--self-consistency N`/`--sc-temperature T` (run 41) + smoke dispatch vehicle (run 42c) — fully dispatchable. **Distribution:** WS-08 OG cards (run 42b, SK-PIVOT-012), WS-09 gate-honest `/agents` live demo (run 41) → messaging → 10/13, pivot → 12/20. Plus E-04 TTL-sweep core (`SK-PIVOT-011`, run 39) + SK-PIVOT-010 finding (E-06 authed-only). KPI engine quality / onboarding; none degraded.
- 2026-06-19/20 (runs 19–36) — agent-memory pivot launch wave + engine staging
  (all closed/additive; BIRD 06-19 + Spider 06-17 untouched). Messaging
  WS-01..07/09/10: competitors anchor, three memory `/vs` pages, both solve
  pages, MCP framing, carousel slides, the Mem0·Zep·Letta·nlqdb matrix
  (data+render), `/agents` skeleton+hero+matrix+CTA, launch post, FSL self-host
  copy → messaging 8/13, pivot 10/20. Engine: **E-01** `agent_memory_v1` preset +
  **E-02** `nlqdb_remember` (+CLI parity, SK-CLI-018) → engine 2/7;
  self-consistency vote core (`SK-QUAL-017`), Spider external-knowledge injection
  (`SK-QUAL-016`), TTL fail-loud fix (GLOBAL-012); §4 #2a/#2c directive levers
  falsified standalone; findings SK-PIVOT-009/010 (E-03 RLS-not-rewrite, E-06
  authed-only). Per-run detail: `progress/quality-score-verification-log.md` +
  the WS/E worksheets.
- 2026-06-19 (runs 17–18) — canonical BIRD re-run flat (EX 0.522 → 0.520,
  McNemar p=0.50) ⇒ directive levers saturated; `SK-QUAL-014` then **falsified
  value-retrieval as the top lever** (`literal_only` = 0), demoting it below the
  reasoning levers. No engine change. Detail in the verification log.
- 2026-06-13/18 (runs 1–16) — day-one scorecard + engine-instrument /
  provider-resilience / deferred-lever waves (Gemini key heal + Spider re-run
  to 0.1852, join-bridge pruner T21, HAVING directive T22, `SK-QUAL-014/015`
  classifiers, `SK-LLM-038/039`, `SK-HDC-019`). Full per-run detail:
  `progress/quality-score-verification-log.md`.
