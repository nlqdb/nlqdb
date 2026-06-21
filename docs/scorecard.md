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
engine-side worst, **Spider 0.1852 vs 0.75**, owns it. **The Gemini free-tier
key was restored 2026-06-17** (fresh AI Studio key, mirrored to GHA + Worker)
and the full canonical Spider eval re-ran on the healed chain: raw EX
**0.1704 → 0.1852**, `no_sql` **36 → 9**, and `gemini:http_4xx`/`auth_denied`
is gone (`SK-LLM-039`). The 27 newly-answered questions mostly mismatch (hard
benchmark), so the engine bottleneck is now **SQL reasoning** (mismatches), not
provider availability. The run-15 `SK-QUAL-014` classifier buckets the 236 BIRD
mismatches: the mass is aggregation/DISTINCT **grain** + subquery **shape**,
much of it value/literal/column grounding. **BIRD re-run 2026-06-19** on current
main (first canonical since T20–T22 merged): raw EX 0.522 → **0.520** (260/500),
`no_sql` 3 → 1 — **statistically flat** (McNemar p=0.50, b=38/c=37, no
regression). The directive levers (T13–T16/T22) have **saturated on BIRD**.
**2026-06-19 (run 18): the `SK-QUAL-014` literal axis falsifies value-retrieval
as the top lever** — of the 238 BIRD mismatches, `literal_diff` is the largest
tag (90) but `literal_case_only` is 6 and **`literal_only` is 0**: no mismatch
is recoverable by fixing string literals alone (each co-occurs with a structural
error). So value-sampling (§4 #2a) flips ~0 rows standalone; the path to the
gate floor is the §4 **reasoning** levers (#3 self-consistency, #1 retrieval
few-shot), not retrieval. Value-retrieval is demoted + privacy-gated. **Both
reasoning-lever cores now ship:** #3 vote core (`SK-QUAL-017`, run 34) + #1
DAIL-SQL retrieval (`SK-LLM-041`) — and #1 is now **built end-to-end bar the
`buildPlanUser` wiring**: core (run 38) + pool-curation mask (run 39) +
**schema-aware selector** `selectExemplarsForSchema` (run 41) that masks the
goal against the live schema and each pool row against its own — the entry
point that finally consumes the masking half. Both levers still need their
prod-wiring/dispatch half, EX delta next canonical run.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel — bot-filtered, 2026-06-15** | | walkers = `flow-004-walker` source / `nlqdb-flow004-*` emails |
| 1 | Visits, 7d (CF Web Analytics) | 94 visits / 147 pageloads | was 114/175 (06-13); walker traffic aged out of the 7d window |
| 2 | Waitlist rows, real | 1 of 69 | 68 walker/test/probe; the 1 is the founder → ~0 genuine strangers |
| 3 | Registered users, real strangers | 0 | 7 total = 3 founder + 4 test/dev accounts |
| 4 | Invite-valve crossings (KV `wl:invite-cap`) | 9/wk (06-13, carried) | cap 200/wk — no exhaustion risk; mostly walker-triggered; not re-pulled this run |
| 5 | Anon DBs with a recorded first answer | **101 of 101** | instrument fix (runs 1–3) holding; +8 since 06-13. Genuine-stranger subset still ~0 (rows #2/#3) — the real worst-number |
| | **Engine — BIRD 2026-06-19 · Spider 2026-06-17 (both fresh, < 7d)** | | `apps/api/src/gate/eval-baseline.ts` |
| 6 | BIRD raw EX | 0.520 | target 0.65; was 0.522 (06-12). Canonical re-run on current main (T20–T22): 260/500, `no_sql` 3 → 1. **Flat within variance** — McNemar b=38/c=37, p=0.50, no regression. Directive levers saturated; literal/value (§4 #2a) + date-encoding (§4 #2c) levers both falsified standalone offline (run 31) ⇒ reasoning levers (§4 #3/#1) next |
| 7 | Spider raw EX | 0.1852 | target 0.75; was 0.1704 (06-12). Gemini key restored 06-17 → `no_sql` 36 → 9 (`SK-LLM-039`). Run 33: external-knowledge injection (`SK-QUAL-016`). **Self-consistency `SK-QUAL-017` (§4 #3): vote core (34) + execution half (37) + temperature-sampling half — per-request `PlanRequest.temperature` (default greedy, `SK-LLM-024` intact) + `samplePlans` (run 39) — all shipped; only the runner `--self-consistency N` main-loop wiring + dispatch remain. EX delta next dispatch** |
| 8 | persona-bench | — | not yet built |
| 9 | free-vs-frontier delta | null | agentic lane not yet run (`SK-QUAL-004`, target ≤ 25 pp) |
| | **Ops — 7d, CF Workers analytics** | | wall-time, all routes (not `/ask`-only) |
| 10 | nlqdb-api requests / errors | 2,268 / 0 (0.00%) | mcp 284 req, events-worker 91 req, both 0 err |
| 11 | nlqdb-api latency p50 / p95 | 666 ms / 7.05 s (06-13) | p95 dominated by LLM-bound asks; `/ask`-only split needs Grafana `metrics:read` (agent has write-only key) |
| 12 | $ spend | ~$0 | free tiers across CF / Neon / LLM chain |
| | **Pivot — agent-memory wedge** (GLOBAL-036) | 10 / 20 + 3 memory /vs pages | tick ⬜→✅ with PR link on merge; mirrors `docs/features/agent-memory-pivot/worksheets/INDEX.md` |
| | *Messaging track — WS-\** | 8 / 13 (WS-07 ✅ 3/3, WS-09 🟡 1/2) | pick when worst number is funnel / distribution |
| WS-01 | competitors.md anchor (Zep / Letta / LangMem) | ✅ | run 19 — §4 + threat matrix; unblocks WS-02 |
| WS-02 | memory `/vs` pages (one per run) | ✅ 3/3 | run 20 — **Zep ✅** (`/vs/zep`); run 21 — **Letta ✅** (`/vs/letta`); run 22 — **LangMem ✅** (`/vs/langmem`) — WS-02 closed |
| WS-03 | solve pages — sharpen + sibling | ✅ 2/2 | run 23 — **sharpen ✅**; run 25 — **analytical sibling ✅** (`analytical-queries-over-agent-memory`, the read-side report-over-memory wedge) |
| WS-04 | MCP tool + package + docs framing | ✅ | run 24 — three tool descriptions + `package.json` desc + `mcp.mdx` intro now lead with "analytical memory" (copy only; SK-PIVOT-003) |
| WS-05 | carousel analytics-over-memory slides | ✅ | run 26 — 2 analytics-over-memory slides (`GROUP BY category` + top-N `ORDER BY … LIMIT 5`), MCP surface; data-only `showcase-examples.ts` |
| WS-06 | Mem0 \| Zep \| Letta \| nlqdb capability matrix | ✅ | run 27 — **data ✅** (`agentMemoryMatrix.ts`, 9 honest rows + test); run 28 — **render ✅** (`AgentMemoryMatrix.astro`, four-up glyph grid, nlqdb accent column, no `<img>`) |
| WS-07 | `/agents` landing | ✅ 3/3 | run 30 — **skeleton + hero ✅**; run 31 — **matrix + moat ✅** (WS-06 matrix + typed-plan trust-boundary pipeline + FSL/BYO-key band); run 35 — **CTA + demand-signal ✅** (memory-shaped "try this query" → `agents.try_query_clicked` GLOBAL-024 → `/app/new`; Topnav `Agents` link; P2-keyed `/vs` cross-link). WS-07 closed → **unblocks E-06** |
| WS-08 | on-brand OG / social images | ⬜ | low · ~2 runs · WS-07 |
| WS-09 | "database, not a vector store" blog + live demo | 🟡 1/2 | run 30 — **blog draft ✅** (launch post in `distribution-queue.md`: Replit incident → recall≠analytics → typed-plan boundary → measured BIRD 0.52 / Spider 0.1852 + `tools/eval/` link + WS-06 matrix); live `/agents` demo deferred (run 1, collides with WS-07 #430) |
| WS-10 | FSL self-host messaging (GLOBAL-019 / arch §0 doc-fix shipped) | ✅ | run 28 — pricing self-host band + README "Models & plans" self-host line (FSL-accurate; no turnkey-image claim per WS-11 note) |
| WS-11 | pull `ghcr.io/nlqdb/api` self-host container forward | ⬜ | high · multi · WS-10 · infra-gated |
| WS-12 | home reweight + demote P1/P3/P4 to "also works for…" | ⬜ | med · ~2 runs · WS-06, WS-07 |
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

- 2026-06-21 (run 41) — **Engine: similarity-retrieved few-shot *schema-aware
  selector* shipped (`SK-LLM-041` follow-on, T23) — the §4 #1 DAIL-SQL lever is
  now built end-to-end bar the `buildPlanUser` wiring.** Worst number is engine
  (Spider 0.1852, BIRD 0.520); both baselines < 7 d (§5: no back-to-back
  dispatch) and open PR #447 owns the §4 #3 self-consistency runner lane, so the
  clean non-colliding slice is #1's next staged half. Closed a real gap: run 39's
  `maskWithSchema` had **no selector that consumed it** — a cross-schema pool
  could only be ranked by hand-masking each row. New `SchemaExemplar<T>` (row
  carries its own schema) + `selectExemplarsForSchema(goal, goalSchema, pool, k)`
  masks the goal against the live schema and each row against its own, sharing a
  factored-out top-k core with `selectExemplars` (P5: −duplication). Proven
  offline: a cross-domain twin (different schema, same skeleton) ranks top from
  **raw** rows, beating a same-schema different-shape row, no hand-masking.
  Staged ahead of the curated pool *rows* + index + `buildPlanUser` wiring
  (T9-ablation-gated); no prod import ⇒ `SK-LLM-024` determinism + baselines +
  perf untouched, EX delta next dispatch. **Δ:** §4 #1 mask-half → **+ selector
  that consumes it**; `@nlqdb/llm` few-shot cases 16 → 20 (suite 198 green).
  **KPI:** engine quality; **none degraded.** `verification-log` net-shrunk (D4).
  Artifact: "Mask each exemplar against its own schema, the goal against the
  live one" queued.
- 2026-06-21 (run 40) — **Engine: self-consistency *temperature-sampling half*
  shipped (`SK-QUAL-017` follow-on) — the §4 #3 lever is now wired end-to-end
  bar the runner main loop.** No dispatch (BIRD 06-19 + Spider 06-17 both < 7 d,
  §5). An optional per-*request* `PlanRequest.temperature` threads through every
  provider `callChat` (`temperature ?? 0`) — **default greedy, so `SK-LLM-024`
  is byte-identical; only the eval sampler sets it > 0** (the per-request
  mechanism SK-LLM-024 reserved) — plus `self-consistency.ts::samplePlans`
  (draws N plans at temp > 0; a throwing draw → no-vote empty sample so N-1 still
  reach consensus; injected `plan` ⇒ offline-tested). **Δ:** §4 #3 +sampling-half;
  only the runner `--self-consistency N` wiring + dispatch remain. KPI **engine
  quality**; none degraded; `@nlqdb/llm` 186 → 189 + eval 19 → 21 green.
- 2026-06-21 (run 39) — **Engine (agent-memory wedge): E-04 TTL-sweep core
  shipped (`SK-PIVOT-011`)** — pure `apps/api/src/memory/expire.ts`:
  `buildExpirySweep` (deterministic parameterised `DELETE FROM facts WHERE
  expires_at < $1`, never LLM-composed) + `orchestrateSweep` (memory-preset DBs
  only, per-DB failure isolation). Engine lane blocked (both evals < 7 d; PR #444
  owned §4 #3 sampling), so picked the lowest open engine-track item. **Δ:** E-04
  ⬜ → sweep core 🟡 (7 cases); apps/api memory tests 18 → 25. KPI engine
  quality / onboarding; none degraded (no prod import, baselines + perf untouched).
- 2026-06-21 (run 39) — **Engine: similarity-retrieved few-shot *pool-curation
  masking half* shipped (`SK-LLM-041` follow-on, T23)** — `maskSchemaIdentifiers`
  / `maskWithSchema` fold schema table/column words → `col` (reusing exported
  `schema-prune.ts::schemaTokens`), the DAIL §4.1 cross-domain step value-masking
  can't reach alone. Proven offline: two same-shape questions over *unrelated*
  schemas → identical skeleton (similarity 1 vs < 1 value-only). **Δ:** §4 #1
  core → **+ pool-curation mask**; `@nlqdb/llm` 186 → 191 (16 few-shot cases).
  KPI engine quality; none degraded (no prod import, baselines + perf untouched).
- 2026-06-21 (run 38) — **Engine: similarity-retrieved few-shot deterministic
  core shipped (`SK-LLM-041`, T23) — the §4 #1 retrieval half of DAIL-SQL
  ([arXiv:2308.15363](https://arxiv.org/abs/2308.15363)) that T9 left.** New
  pure `few-shot-select.ts`: value **masking** (`val`) + masked-token Jaccard
  `questionSimilarity` + stable top-k `selectExemplars` (drops zero-similarity,
  ties → earliest). Proven offline by the cross-domain-twin-beats-value-distractor
  fixture. Staged ahead of the pool + index + `buildPlanUser` wiring (T9-ablation-
  gated). **Δ:** §4 #1 backlog → retrieval core shipped (11 unit cases);
  `@nlqdb/llm` 175 → 186 tests. KPI engine quality; none degraded (no prod
  import, baselines + perf untouched). Artifact queued.
- 2026-06-21 (run 37) — **Engine: self-consistency *execution half* shipped
  (`SK-QUAL-017` follow-on) — the tissue between the vote core (run 34) and the
  runner.** `majorityVote` needs each candidate's **rows**: added
  `score.ts::executeRows` (SQL → rows, shares `scoreOne`'s SQLite path) +
  `self-consistency.ts::voteOverSamples` (executes each sample via an *injected*
  executor, then votes — pure ⇒ offline-tested; the §5 "separate code path").
  **Δ:** §4 #3 vote-core → **+ execution half**; only the sampling half + dispatch
  remain; 239 eval tests (was 232). KPI engine quality; none degraded. Artifact
  queued.
- 2026-06-21 (run 37) — **Engine-track finding (SK-PIVOT-010): E-06's
  anon-`/agents`-CreateForm preset on-ramp is infeasible — redirected to the
  authed create surface.** The on-ramp can't work across **three** auth
  boundaries (`POST /v1/databases` requireSession + `MEMORY_PRESET`-gated;
  `/v1/memory/remember` rejects anon+pk_live; CreateForm anon-only by contract,
  SK-ANON-008); moved to the **authed** create surface, blocked on
  `MEMORY_PRESET=1` in prod. **Δ:** a finding resizes a backlog lever before a
  broken on-ramp ships (run-32 precedent). Docs-only; nothing engine touched.
  KPI engine quality / onboarding; none degraded. Artifact queued.
- 2026-06-20 (run 36) — **WS-07 closed: `/agents` conversion CTA + GLOBAL-024 demand signal → messaging 7 → 8/13, pivot 9 → 10/20.** Memory-shaped "try this query" button seeds `nlqdb_draft` (SK-ANON-011), fires `agents.try_query_clicked` (GLOBAL-024) → `/app/new`; `Agents` Topnav + P2-keyed `/vs` cross-links. 127 tests green; additive markup. KPI onboarding; none degraded.
- 2026-06-20 (run 35) — **Engine: self-consistency vote core shipped** (`SK-QUAL-017`, §4 #3) — pure `majorityVote` + `fingerprintRows` cluster N executed plans by their **result set** (deterministic ties → earliest), staged ahead of the sampling half (greedy `SK-LLM-024` untouched). 12 unit cases; KPI engine quality, none degraded; 232 eval tests (was 220). Artifact queued.
- 2026-06-20 (run 34) — **Engine (memory write-path): fail-loud TTL gap fixed** (`validateRememberInput` silently dropped a TTL on non-`facts` kinds, GLOBAL-012; now rejected). `remember.test.ts` 16 → 18; KPI engine quality / onboarding, none degraded.
- 2026-06-20 (run 33) — **Engine: Spider external-knowledge injection shipped** (`SK-QUAL-016`) — `loadExternalKnowledge` injects the dropped `<name>.md` doc body through `evidence` → `enrichedGoal`; 13/135 `local###` (9.6%) handicap closed, EX delta next Spider dispatch. KPI engine quality; none degraded (29 spider2-lite tests, was 24).
- 2026-06-20 (run 32) — **Engine-track finding (SK-PIVOT-009): E-03's compile-layer scoping is infeasible** — `/v1/ask` runs free-form LLM SQL via `neonSql.unsafe(sql)` with no AST step, so a SQL-rewriter on a security boundary = breach risk; redirected E-03/E-04 to row-level RLS on an `app.agent_id` GUC. Docs-only, no engine/chain/scorer touched. Artifact queued.
- 2026-06-20 (run 32) — **E-02 GLOBAL-003 parity closed: CLI `nlq remember`** (SK-CLI-018) — wraps `POST /v1/memory/remember`; surface parity HTTP/SDK/MCP → 4/4. Additive, baselines untouched. Artifact queued.
- 2026-06-20 (runs 30–31) — six closed slices (all additive; BIRD 06-19 +
  Spider 06-17 untouched): **E-01** preset wired into the create path → closed
  (engine 0 → 1/7; SK-HDC-020, `POST /v1/databases { preset }` behind
  `MEMORY_PRESET`); **E-02** `nlqdb_remember` write primitive → closed (engine
  → 2/7; #432, SK-PIVOT-008, server-built INSERT via `POST /v1/memory/remember`,
  SDK `remember()` + tool); **WS-07 runs 1–2/3** skeleton+hero then
  matrix+moat+FSL band on `/agents` (#433); **WS-09 run 2/2** launch-post draft;
  **§4 #2c date-normalisation directive FALSIFIED standalone** (#434, parked
  like #2a). Per-slice detail in the WS/E worksheets + verification log.
- 2026-06-20 (runs 26–29) — agent-memory pivot wave (all closed/merged,
  additive; no engine/chain/scorer touched; BIRD 06-19 + Spider 06-17 untouched).
  Engine lane blocked all four (both evals < 7 d, §5), so each picked the
  lowest-numbered in-bounds pivot slice: **WS-05** (run 26) two analytics-over-memory
  home-carousel `read` slides (`GROUP BY`/top-N over an `agent_memory` table;
  data-only `showcase-examples.ts`); **WS-06** (runs 27+28) the Mem0·Zep·Letta·nlqdb
  capability matrix — data `agentMemoryMatrix.ts` (9 honest rows, SK-PIVOT-001,
  self-host row honesty-corrected vs the framing doc) then the `AgentMemoryMatrix.astro`
  four-up glyph render (live text, no `<img>`, SK-PIVOT-004) → WS-06 ✅, unblocks
  WS-07; **WS-10** (run 28) FSL-1.1 self-host copy on `/pricing` + README
  (SK-PIVOT-005, no turnkey-image claim); **E-01** (run 29) the `agent_memory_v1`
  preset DDL module (`agent-memory-v1.ts`, plain DDL through `sql-validate-ddl`,
  SK-PIVOT-006/007). Counters reached pivot 9/20, messaging 7/13, engine 1/2.
  Per-slice detail in the WS/E worksheets; drafts queued in `distribution-queue.md`.
- 2026-06-20 (run 25) — **WS-03 run 2/2: analytical sibling solve page
  `/solve/analytical-queries-over-agent-memory` shipped → WS-03 closed**
  (messaging 3 → 4/13, pivot 3 → 4/20, solve pages 5 → 6). The read-side wedge:
  reports (counts/top-N/averages per group) over agent memory a vector store
  can't run. Additive `SolveEntry`; no engine/chain/scorer touched; BIRD 06-19 +
  Spider 06-17 untouched. KPI onboarding. Detail in the WS-03 worksheet.
- 2026-06-19/20 (runs 23–24) — agent-memory messaging wave (both closed, additive copy; no engine/chain/scorer touched; BIRD 06-19 + Spider 06-17 untouched): **WS-03 run 1/2** (run 23) sharpened `/solve/give-ai-agent-persistent-memory` to the retrieval≠analytics wedge + fixed phantom MCP tool names (real three only, SK-PIVOT-002); **WS-04** (run 24) reframed the MCP surface — three tool `description`s/`title`s + `package.json` + `mcp.mdx` lead with "analytical memory" (copy only, SK-PIVOT-003; SK-MCP-002 contract + 33 tests intact). Messaging track → 3/13, pivot → 3/20. Per-slice detail in the WS worksheets; drafts queued in `distribution-queue.md`.
- 2026-06-19/21 (runs 19–22) — agent-memory wedge launch wave (all closed, additive content; no engine/chain/scorer touched): **WS-01** anchored the Zep / Letta / LangMem cluster in `docs/competitors.md §4` (run 19, pivot 0 → 1/20); **WS-02** shipped the three memory `/vs` pages — `/vs/zep` (run 20), `/vs/letta` (run 21), `/vs/langmem` (run 22) — each one `Competitor` entry keyed on the retrieval-vs-analytics wedge (`GROUP BY`/`JOIN`/`HAVING` over memory), facts web-verified 06-19, real tool names only. WS-02 closed → messaging track 2/13, pivot 2/20. Per-slice detail in the WS worksheets + `competitors.ts` history; comparison drafts queued in `distribution-queue.md`.
- 2026-06-19 (runs 17–18) — canonical BIRD re-run flat (EX 0.522 → 0.520,
  McNemar p=0.50) ⇒ prompt-directive levers saturated; the `SK-QUAL-014`
  literal axis then **falsified value-retrieval as the top lever**
  (`literal_only` = 0), demoting it below the reasoning levers. No
  engine/chain change; no eval dispatched. Detail in the verification log.
- 2026-06-13/18 (runs 1–16) — day-one scorecard + engine-instrument /
  provider-resilience / deferred-lever waves (Gemini key heal + Spider re-run
  to 0.1852, join-bridge pruner T21, HAVING directive T22, `SK-QUAL-014/015`
  classifiers, `SK-LLM-038/039`, `SK-HDC-019`). Full per-run detail:
  `progress/quality-score-verification-log.md`.
