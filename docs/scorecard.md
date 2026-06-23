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
reasoning** (mismatches), not provider availability (Gemini healed 06-17,
`SK-LLM-039`) nor literal grounding (`SK-QUAL-014`: `literal_only` = 0). BIRD
re-run 06-19 is **flat** (0.522 → 0.520, McNemar p=0.50) ⇒ directive levers
(T13–T22) **saturated**; the path to the gate floor is the §4 **reasoning**
levers (#1 DAIL-SQL retrieval, #3 self-consistency), both **built end-to-end
and dispatchable** but **dispatch-gated today** (both evals < 7 d, §5). The
DAIL-SQL pool/lexical-selector half is at its **offline ceiling** (run 52:
q8/q10 ICP misses falsified as lexically-unfixable; held-out precision@1
**14/14**, own-ICP **18/20**); the only remaining offline #1 gain is
SQL-skeleton similarity (an LLM round-trip, not a daily lever) or the gated
dispatch. **Run 55** shipped the persona-bench **dispatch**
(`quality-eval-persona-bench.yml`): the free chain is now scoreable on nlqdb's
OWN ICP schemas, ungated by the < 7-day rule (it never touches the canonical
baseline); free-chain EX + the ICP free-vs-frontier delta land on the first
post-merge dispatch. Today's non-colliding lever is the funnel's top-of-funnel
AEO surface (distribution lane).

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
| 8 | persona-bench | **20 q / 2 ICP schemas; CI-dispatchable (run 55); 20/20 golds execute** | run 55 — `quality-eval-persona-bench.yml` (the documented "last half") makes the free chain scoreable on the ICP shape: `workflow_dispatch` `persona: all\|P1\|P2` + `include_frontier`, no fixture/baseline/emit, so ungated by `SK-QUAL-002`'s < 7-day rule. Free-chain EX + ICP free-vs-frontier delta land on the first dispatch (post-merge — `workflow_dispatch` needs the file on `main`). Batch 2 (run 47) grew 12 → 20 q; retrieval precision@1 18/20 (`SK-LLM-041 × SK-QUAL-018`) |
| 9 | free-vs-frontier delta | null | agentic lane not yet run (`SK-QUAL-004`, target ≤ 25 pp); the **ICP-shape** delta is now dispatchable via persona-bench (run 55, `include_frontier`) |
| | **Ops — 7d, CF Workers analytics (06-22 re-pull)** | | wall-time, all routes (not `/ask`-only) |
| 10 | nlqdb-api requests / errors | 990 / 0 (0.00%) | mcp 314 req, events-worker 37 req, both 0 err; 7d totals lower as walker traffic ages out |
| 11 | nlqdb-api wall-time p50 / p95 | 0.94 ms / 2.62 s (06-22) | `workersInvocationsAdaptive` wallTime; p50 trivial routes (static/CORS/health), p95 LLM-bound asks; `/ask`-only split needs Grafana `metrics:read` (agent has write-only key) |
| 12 | $ spend | ~$0 | free tiers across CF / Neon / LLM chain |
| | **Pivot — agent-memory wedge** (GLOBAL-036) | 13 / 20 + 7 memory /vs pages | tick ⬜→✅ with PR link on merge; mirrors `docs/features/agent-memory-pivot/worksheets/INDEX.md`; run 53 +`/vs/pinecone` (P2 cluster 4→5); run 56 +`/vs/chroma` (OSS-first vector wing — P2 cluster 5→6); run 59 +`/vs/weaviate` (enterprise/hybrid-search wing — P2 cluster 6→7) |
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

- 2026-06-22 (run 59) — **Distribution: shipped `/vs/weaviate`, the
  enterprise/hybrid-search wing of the "database, not a vector store" wedge.**
  Worst real number is the genuine-stranger funnel (rows #2/#3 ≈ 0), engine-gated
  (GLOBAL-027) — but the engine lane is dispatch-gated (BIRD 06-19 / Spider 06-17
  < 7 d, §5) **and** owned (open PR #475, persona-bench dispatch, run 58), so the
  non-colliding lever is the funnel's top-of-funnel AEO surface. Run 53 gave the
  *hosted* vector DB (Pinecone) its page, run 56 the *OSS-first* one (Chroma);
  Weaviate is the **enterprise / hybrid-search** vector store the comparison-pages
  FEATURE.md named as the next P2 follow-on — first-class fused BM25 + vector
  ranking plus built-in multi-tenancy / replication / RBAC, the differentiator
  axis Pinecone (hosted) and Chroma (OSS-first) don't lead with. Same aggregation
  wedge: hybrid search ranks the relevant, it has no GROUP BY / JOIN / HAVING.
  **Δ (measured, distribution lane):** comparison pages **11 → 12**; P2
  agent-builder cluster **6 → 7** (WS-07 cross-link + WS-08 OG card auto-extend on
  the P2 persona key); OG cards **7 → 8** (`vs-weaviate.png`, generator
  deterministic — 7 existing cards byte-identical); llms.txt + sitemap **+1**.
  Facts web-verified 2026-06-22: BSD-3-Clause self-host (full-featured, free) +
  Weaviate Cloud (Sandbox / Flex $45 / Plus $280 / Premium), first-class hybrid
  search, multi-tenancy / replication / RBAC, official `mcp-server-weaviate`, no
  SQL / joins / aggregations. **KPI:** onboarding / distribution (AEO on "Weaviate
  hybrid search agent memory"); **none degraded** — content + typed-data + one PNG,
  prod byte-identical, no engine file touched, BIRD 06-19 / Spider 06-17 untouched;
  13 competitors invariants green, astro-check 0 errors. Artifact: *"Hybrid search
  made your recall smarter. It still can't count."*
- 2026-06-22 (run 57) — **Hygiene (D4 + D5 + P3): `docs/performance.md`
  net-shrunk 26,378 → 24,441 B (−1,937 B) by collapsing §4's "slice-by-slice
  instrumentation plan".** Both live lanes were owned by open PRs (engine #472 ·
  distribution #473) and the canonical BIRD/Spider dispatch is gated (06-19 /
  06-17 both < 7 d, §5), so the non-colliding lever was doc hygiene. §4's
  slice-3–7 table re-listed a **stale subset** of the §3 span/metric catalog
  (P3 — §3 is the single source of truth, per observability/FEATURE.md) and its
  per-slice "CI assertion" notes duplicate specs that live in the test files
  (D5: inferable from code). Replaced with the load-bearing standing rule
  (catalog names + vitest assertion + budget assertion); **0 span/metric names
  lost** — the two `nlqdb.cache.first_query.lookup`/`commit` spans the §4 table
  named but §3 omitted were added to the §3 catalog so it stays the single
  source of truth; observability cross-ref label synced. **KPI:**
  performance / onboarding (the perf-doc front door lands on the live §3
  catalog, not a stale plan); **none degraded** — docs-only, prod byte-identical,
  BIRD 06-19 / Spider 06-17 untouched. Artifact: *"Your 'instrumentation plan'
  is lying to you — the catalog already shipped."*
- 2026-06-22 (run 56) — **Distribution: shipped `/vs/chroma`, the OSS-first
  vector-store wing of the "database, not a vector store" wedge.** Worst real
  number is the genuine-stranger funnel (rows #2/#3 ≈ 0), engine-gated
  (GLOBAL-027) — but the engine lane is dispatch-gated (BIRD 06-19 / Spider
  06-17 < 7 d, §5) **and** owned (open PR #472, persona-bench dispatch), so the
  non-colliding lever is the funnel's top-of-funnel AEO surface. Run 53 gave
  the *hosted* vector DB (Pinecone) its page; Chroma is the **open-source /
  self-hostable** vector store the OSS-first ICP reaches for — the differentiator
  axis Pinecone can't claim, plus full-text search. Same aggregation wedge: no
  SQL / joins / GROUP BY. **Δ (measured, distribution lane):** comparison pages
  **10 → 11**; P2 agent-builder cluster **5 → 6** (WS-07 cross-link + WS-08 OG
  card auto-extend on the P2 persona key); OG cards **6 → 7** (`vs-chroma.png`,
  generator deterministic — 6 existing cards byte-identical); llms.txt + sitemap
  **+1**. Facts web-verified 2026-06-22: Apache-2.0, embedded / self-host /
  serverless Chroma Cloud, `chroma-mcp` server, vector + full-text + metadata
  search only (no SQL). **KPI:** onboarding / distribution (AEO on "open source
  agent memory vector store"); **none degraded** — content + typed-data + one PNG,
  prod byte-identical, no engine file touched, BIRD 06-19 / Spider 06-17 untouched;
  13 competitors invariants green, astro-check 0 errors. Artifact: *"'Self-hosted'
  fixes lock-in, not the query model — your open-source vector store still can't
  GROUP BY."*
- 2026-06-22 (run 55) — **Engine measurement: shipped
  `quality-eval-persona-bench.yml`, the documented "last half" of SK-QUAL-018 —
  the free chain is now scoreable on nlqdb's OWN ICP-shaped schemas.** A
  *measurement* with no baseline to overwrite, so it is explicitly **ungated** by
  `SK-QUAL-002`'s < 7-day rule and needs no upstream fixture (inline DDL via
  `loadPersonaBench`). **Δ (measurement infra):** persona-bench free-chain EX
  (row 8) + the **ICP free-vs-frontier delta** (row 9, the GLOBAL-025 headline
  KPI) go from **undispatchable → a single `workflow_dispatch`** (`persona:
  all\|P1\|P2`, `include_frontier`); the EX number lands on the first post-merge
  dispatch. Runner path unchanged, unit-test-verified (eval 17/17, retrieval
  precision@1 18/20). **KPI:** engine quality; **none degraded** — additive
  workflow + docs only, prod byte-identical, BIRD 06-19 / Spider 06-17 untouched.
  Artifact: *"Your text-to-SQL accuracy is measured on schemas your users will
  never build."*
- 2026-06-22 (runs 51–54) — engine + distribution + hygiene wave (all merged;
  BIRD 06-19 / Spider 06-17 untouched). **Engine (run 51):** §4 #1 DAIL-SQL pool
  grown 13 → 14 (+`order-by-limit` plain top-N, `SK-LLM-041 × SK-QUAL-018`), q0
  flipped off the GROUP-BY stand-in onto plain `ORDER BY … LIMIT`; ICP precision@1
  18/20, held-out 14/14. **Engine finding (run 52, Δ ≤ 0 reverted):** the
  lexical-selector avenue for the two pinned ICP misses (q8/q10) is falsified —
  stopword filter regresses 18/20 → 17/20, phrase-norm flat (`SK-LLM-036/037`);
  the pool/lexical half of §4 #1 is at its **offline ceiling** (only
  query-skeleton similarity, an LLM round-trip, or the gated dispatch remain).
  **Distribution (run 53):** shipped `/vs/pinecone` (the first *vector DB* /vs
  page, vs the memory-layer set mem0/zep/letta/langmem), comparison pages 9 → 10,
  P2 cluster 4 → 5, OG cards 5 → 6, sitemap/llms.txt +1. **Hygiene (run 54):**
  `docs/progress.md` net-shrunk 22,108 → 20,428 B under the 20 KB cap (§0 Notes
  trimmed of accreted feature-doc bodies, P3; 0 rows/facts removed). None
  degraded; prod byte-identical.
- 2026-06-22 (runs 48–50) — engine + distribution + hygiene wave (all merged;
  BIRD 06-19 + Spider 06-17 untouched). **Engine (run 48):** §4 #1 DAIL-SQL pool
  grown 12 → 13 (+`null-filter`) on a new persona-bench ICP-retrieval probe
  (`SK-LLM-041 × SK-QUAL-018`); "who never logged in" (q3) flipped off the
  misleading anti-join NOT-IN demo onto `IS NULL` — ICP precision@1 17/20 → 18/20,
  held-out 13/13, q8/q10 documented selector-side misses. **Distribution (run
  49):** 5 older `/vs` pages stopped fabricating a phantom MCP `create_database`
  verb (10 → 0 occurrences; corrected to `nlqdb_query`/`_list_databases`/`_describe`
  per `SK-MCP-002`; AEO copy is lifted verbatim by AI search) — 2 new
  `competitors.test.ts` invariants, web tests 11 → 13. **Hygiene (run 50):**
  `quality-score-source-of-truth.md` net-shrunk 21,229 → 20,322 B under the D4
  cap (collapsed 5 redundant directive-bullet rows, links kept). KPI engine
  quality / UX / onboarding; none degraded.
- 2026-06-22 (runs 43–47) — engine + distribution + hygiene wave (all merged;
  BIRD 06-19 + Spider 06-17 untouched). **Engine:** §4 #1 DAIL-SQL retrieval
  T9-ablation wiring `buildPlanSystem(goal,schema,k)` (run 43, static at `k<=0`)
  + curated pool grown 10 → 12 buckets with anti-join `NOT IN` + group-order-limit
  (run 46, `SK-LLM-041`, precision@1 12/12, prod byte-identical); persona-bench v0
  (run 43, `SK-QUAL-018`, 12 golds execute) → runner-wired dispatchable
  `EvalDataset` (run 44, `@nlqdb/eval` → 258) → grown 12 → 20 golds (run 47,
  batch 2 — anti-join + challenging multi-join shapes; 20/20 execute). **Distribution:** WS-12 closed
  (`AgentMemoryBand` + `AlsoWorksFor` fold, runs 43–44) → messaging 11/13, pivot
  13/20. **Hygiene:** `distribution-queue.md` net-shrunk 35.9 → 9.1 KB under cap
  (run 46). **Measurement (run 45, live):** metrics re-pulled (table above) —
  genuine-stranger lane still 0, engine-gated. KPI engine quality / onboarding;
  none degraded.
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
