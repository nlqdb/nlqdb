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
DAIL-SQL retrieval core (`SK-LLM-041`, run 38 — question masking + masked-token
similarity + top-k select); each still needs its dispatch half, EX delta next
canonical run.

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
| 7 | Spider raw EX | 0.1852 | target 0.75; was 0.1704 (06-12). Gemini key restored 06-17 → `no_sql` 36 → 9 (`SK-LLM-039`). Run 33: external-knowledge injection (`SK-QUAL-016`). **Self-consistency `SK-QUAL-017` (§4 #3 reasoning lever): vote core (run 34) + execution half — `executeRows` + `voteOverSamples` (run 37) — shipped; only the temperature-sampling half + dispatch remain, EX delta next dispatch** |
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

- 2026-06-21 (run 38) — **Engine: similarity-retrieved few-shot deterministic
  core shipped (`SK-LLM-041`, T23) — the §4 #1 retrieval half of DAIL-SQL
  ([arXiv:2308.15363](https://arxiv.org/abs/2308.15363)) that T9 left, the top
  reasoning lever alongside #3.** Worst number is engine (Spider 0.1852, BIRD
  0.520) but BIRD 06-19 + Spider 06-17 are both < 7 d (§5: no back-to-back
  dispatch), and the two open PRs own the other lanes — #442 the §4 #3
  self-consistency *execution half*, #441 the agent-memory E-06 docs. The clean
  non-colliding engine slice is the **other** named reasoning lever's core. New
  pure `packages/llm/src/few-shot-select.ts`: question **masking** (literal
  values → one `val` placeholder ⇒ similarity scores the question skeleton, so
  an exemplar can cross domains) + masked-token Jaccard `questionSimilarity` +
  stable top-k `selectExemplars` (drops zero-similarity, ties → earliest for
  run-to-run reproducibility). Proven offline by the cross-domain-twin-beats-
  value-distractor fixture (the exact DAIL masking property). Staged ahead of
  the exemplar *pool* + embedding index + `buildPlanUser` wiring (gated on the
  T9 ablation, `CLAUDE.md` §P5) — no prod path imports it, so the `SK-LLM-024`
  determinism invariant + BIRD/Spider baselines are untouched; EX delta is the
  next canonical dispatch (`SK-QUAL-002`). **Δ:** §4 #1 backlog → retrieval core
  shipped + proven (11 unit cases); `@nlqdb/llm` 175 → 186 tests green.
  **KPI:** engine quality; **none degraded** — no prod chain/scorer/runner
  change, baselines + perf untouched. `verification-log.md` net-shrunk 20161 →
  20073 B; `scorecard.md` net-shrunk (D4). Artifact: "Retrieving the right
  few-shot example by masking the question, not matching the words." queued.
- 2026-06-21 (run 37) — **Engine: self-consistency *execution half* shipped
  (`SK-QUAL-017` follow-on) — the connective tissue between the vote core (run
  34) and the runner.** Worst number is engine (Spider 0.1852); BIRD 06-19 +
  Spider 06-17 both < 7 d so §5 forbids a dispatch, and the open PR owns the
  agent-memory/E-06 docs lane — leaving the named §4 #3 follow-on as the clean
  non-colliding engine slice. `majorityVote` needs each candidate's **rows**,
  which only a DB round-trip supplies: added `score.ts::executeRows` (SQL →
  rows, `null` on empty/exec-error; shares `scoreOne`'s SQLite path so a sample
  scores byte-identically to the winner) + `self-consistency.ts::voteOverSamples`
  (executes each sample via an *injected* executor, then votes — pure ⇒
  offline-tested on a real SQLite fixture; the §5 "separate code path" that
  never touches the greedy `scoreOne`/`withExecRetry` path). **Δ:** §4 #3
  vote-core → vote-core **+ execution half** shipped+proven; only the
  temperature-sampling half + dispatch remain. KPI: **engine quality**; none
  degraded — no prod chain/scorer/runner change, baselines untouched, perf N/A;
  239 eval tests green (was 232). Artifact: "Voting on the answer needs the
  answer: executing N SQL samples to consensus" queued. Next: the
  temperature-sampling half (`PlanRequest.temperature` + `--self-consistency N`).
- 2026-06-21 (run 37) — **Engine-track finding (SK-PIVOT-010): E-06's
  anon-`/agents`-CreateForm preset on-ramp is infeasible — redirected to the
  authed create surface.** Worst number is engine (Spider 0.1852); BIRD 06-19 +
  Spider 06-17 both < 7 d so §5 forbids a back-to-back dispatch, and the named
  reasoning lever (self-consistency *sampling*, run 35's follow-on) needs a
  dispatch to measure — so the clean in-bounds engine slice was E-06, run 36's
  flagged "next." Investigating it (the loop's job) found the on-ramp can't
  work as written across **three** auth boundaries: `POST /v1/databases` is
  `requireSession` + `MEMORY_PRESET`-gated (`index.ts:2357,2390`),
  `POST /v1/memory/remember` rejects anon+pk_live (`index.ts:1426-1433`), and
  CreateForm is anon-only by contract (`credentials:"omit"`, SK-ANON-008). The
  preset on-ramp moves to the **authed** create surface and is blocked on
  `MEMORY_PRESET=1` in prod (now in `blocked-by-human.md`). **Δ:** a finding
  prunes/resizes a backlog lever (low/1-run → med/~2 + prod-flag prereq) before
  a broken on-ramp ships — the run-32 SK-PIVOT-009 precedent. Docs-only; no
  code/engine/chain/scorer/eval touched; BIRD 06-19 + Spider 06-17 untouched.
  KPI: **engine quality / onboarding** (correctness of the on-ramp design);
  **none degraded**. Artifact: "Why agent memory is authed-only (and what that
  costs the anon on-ramp)" queued.
- 2026-06-20 (run 36) — **WS-07 closed: `/agents` conversion CTA + GLOBAL-024
  demand signal → messaging 7 → 8/13, pivot 9 → 10/20.** Memory-shaped "try this
  query" button on `/agents` seeds `nlqdb_draft` (SK-ANON-011), fires
  `agents.try_query_clicked` (GLOBAL-024) → `/app/new` (reusing the `/vs` +
  `/solve` pattern, P5); `Agents` Topnav link + P2-keyed `/agents` cross-link on
  the four memory `/vs` pages. 127 tests green; additive markup only. KPI:
  **onboarding**; none degraded; BIRD 06-19 + Spider 06-17 untouched.
- 2026-06-20 (run 35) — **Engine: self-consistency vote core shipped
  (`SK-QUAL-017`) — the §4 #3 reasoning lever.** Non-colliding engine slice
  (both evals < 7 d ⇒ §5 no dispatch; #438 owned messaging). Pure
  `majorityVote` + `fingerprintRows` cluster N executed plans by their **result
  set** (the answer, not the SQL string); deterministic ties → earliest
  cluster. Staged ahead of the sampling half (greedy `SK-LLM-024` untouched),
  the prove-the-primitive pattern. **Δ:** §4 #3 → vote-core shipped+proven (12
  unit cases); EX delta next dispatch. KPI **engine quality**; none degraded;
  232 eval tests green (was 220). Artifact "Why we vote on the answer, not the
  SQL" queued.
- 2026-06-20 (run 34) — **Engine (memory write-path): fail-loud TTL gap +
  phantom-column footgun fixed.** `validateRememberInput` parsed `ttlSeconds`
  for every `kind` but only `facts` carries `expires_at` → a TTL on an
  episode/entity was **silently dropped** (GLOBAL-012); now rejected. E-04
  worksheet corrected to facts-only sweep + RLS TTL. **Δ:** `remember.test.ts`
  16 → 18. KPI engine quality / onboarding; none degraded.
- 2026-06-20 (run 33) — **Engine: Spider external-knowledge injection shipped
  (`SK-QUAL-016`) — fixes a measured handicap on the worst number.** Worst
  number is engine (Spider 0.1852); BIRD 06-19 + Spider 06-17 both < 7 d so §5
  forbids a back-to-back dispatch, and both open PRs own a lane (#435 E-03 RLS
  docs, #436 `nlq remember` CLI) — the clean non-colliding engine lever is the
  Spider loader (`tools/eval/`, untouched by either). The loader parsed
  `external_knowledge` but **dropped the doc body**, so Spider questions got no
  provided context while BIRD injects `evidence`. Measured offline: **13/135
  `local###` (9.6%)** carry a dropped doc (haversine, RFM, music-length,
  f1-overtake, …) across 8 DBs — the docs *are* the answer, so these are
  unanswerable, not hard. `loadExternalKnowledge` now injects the `<name>.md`
  body through `evidence` → `enrichedGoal` (cache-authoritative, fail-soft,
  traversal-gated). **Δ:** 13/135 addressable handicap closed; EX delta measured
  by the next canonical Spider dispatch (`SK-QUAL-002`). KPI: **engine quality**;
  none degraded — no runner/scorer/chain change, BIRD 06-19 + Spider 06-17
  untouched, perf N/A; 29 spider2-lite tests green (was 24).
- 2026-06-20 (run 32) — **Engine-track finding (SK-PIVOT-009): E-03's documented
  compile-layer scoping mechanism is infeasible — the `/v1/ask` path executes
  free-form LLM SQL via `neonSql.unsafe(sql)` with no AST step to inject a
  `WHERE agent_id` into, so a SQL-rewriter on a security boundary = breach
  risk. Redirected E-03 (and E-04's read-filter) to row-level RLS keyed on an
  `app.agent_id` GUC — the pattern the provisioner already uses for
  `tenant_isolation`. Corrected E-03/E-04 worksheets + engine INDEX + FEATURE.md.
  **Δ:** a finding prunes a security-critical backlog lever before the
  breach-prone design ships; docs-only, no code/engine/chain/scorer touched,
  BIRD 06-19 + Spider 06-17 untouched. Artifact: the "scoping is RLS, not
  query-rewriting" note (queue).**
- 2026-06-20 (run 32) — **E-02 GLOBAL-003 parity closed: shipped CLI `nlq
  remember`** (SK-CLI-018; engine holds 2/7 — completes the memory-write verb's
  surface parity HTTP/SDK/MCP → **+CLI**, 3/4 → **4/4**). Non-colliding engine
  slice while #435 owned the E-03 RLS finding. `nlq remember [--db] [--kind] <text>`
  wraps `POST /v1/memory/remember`; `wrong_preset` rejects non-memory DBs;
  admitted as a third data verb under GLOBAL-017's explicit-justification clause
  (mirrors the SK-PIVOT-008 third endpoint). Gates green (Go build/vet/test/fmt).
  KPI: **onboarding / engine quality**; none degraded (additive, BIRD 06-19 +
  Spider 06-17 untouched). Artifact: "Give your AI agent memory from the
  terminal" queued.
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
