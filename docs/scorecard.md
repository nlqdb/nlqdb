# Scorecard — current state

Point-in-time **progress tracker**, regenerated each
[`/daily`](../.claude/commands/daily.md) run from live sources (D1, KV, CF
GraphQL, `tools/eval/baseline-2026-06-15.json`). **Current state only — no
run-by-run changelog accretes here** (that is what kept this file growing past
its cap). Full per-run history lives in `git log` +
[`progress/quality-score-verification-log.md`](progress/quality-score-verification-log.md)
(engine) + the WS-*/E-* worksheets. The 20-row Pivot section mirrors
[`agent-memory-pivot/worksheets/INDEX.md`](features/agent-memory-pivot/worksheets/INDEX.md)
and collapses to a one-line summary once the pivot completes (GLOBAL-036).

**Weekly focus number:** *(none set — founder picks at the weekly session;
until then the daily lever targets the worst number below)*

**Worst number today:** real strangers reaching a first answer = **0**
(funnel/distribution lane) — the product is open, so the engine-side worst,
**Spider 0.1852 vs 0.75**, owns it. Bottleneck = **SQL reasoning** (mismatches),
not provider availability (Gemini healed 06-17, `SK-LLM-039`) nor literal
grounding (`SK-QUAL-014`: `literal_only` = 0). BIRD re-run 06-19 **flat**
(0.522 → 0.520, McNemar p=0.50) ⇒ directive levers (T13–T22) **saturated**; the
path to target is the §4 **reasoning** levers (#1 DAIL-SQL retrieval, #3
self-consistency), both **built end-to-end** but **dispatch-gated today** (both
evals < 7 d, §5). The DAIL-SQL **selector** half is at its **offline ceiling**
(run 52; held-out precision@1 **14/14**) and **pool curation is now exhausted
too** (run 81: the 3 residual persona-bench misses q8/q10/q22 are *not*
phrasing leaks — own-ICP precision@1 **20/23**, held-out 14/14). The only
remaining offline #1 gain is SQL-skeleton similarity (an LLM round-trip, not a
daily lever) or the gated dispatch. Free chain scores **0.90 EX (18/20) on the
ICP shape** (row 8, run 58) — **1.7× BIRD, 4.9× Spider** — the GLOBAL-026 bet
that clean product-shaped schemas are already solved on free LLMs. The
**frontier** delta (row 9, headline) is **secret-blocked, not dispatch-blocked**:
`OPENROUTER_FRONTIER_API_KEY` empty in CI (filed in `blocked-by-human.md`);
lands the instant the founder sets it.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel — bot-filtered, 2026-06-22 (live re-pull)** | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 62 visits / 98 pageloads | was 94/147 (06-15); walker traffic still aging out of the 7d window |
| 2 | Waitlist rows, real | 1 of 79 | 78 walker/test/probe; the 1 is the founder → ~0 genuine strangers |
| 3 | Registered users, real strangers | 0 | 7 total = 3 founder/company + 4 test/dev accounts |
| 4 | Anon DBs with a recorded first answer | **113 of 113** | instrument fix (runs 1–3) holding; +12 since 06-15 (119 DBs total, 6 authed). Genuine-stranger subset still ~0 (rows #2/#3) — the real worst-number |
| | **Engine — BIRD 2026-06-19 (< 7d) · Spider 2026-06-17 (crosses 7d on 06-25) · persona-bench 2026-06-22** | | `tools/eval/baseline-2026-06-15.json` (BIRD/Spider only; persona-bench never overwrites the canonical baseline, `SK-QUAL-018`). Spider re-dispatch is due 06-25 on a run that does **not** merge a PR (a merge moves `main` and misses the SHA-keyed multi-window checkpoint); last run completed clean on main (no resumable checkpoint), so it will be a fresh windowed run, not a resume |
| 6 | BIRD raw EX | 0.520 | target 0.65; was 0.522 (06-12). Canonical re-run on current main (T20–T22): 260/500, `no_sql` 3 → 1. **Flat within variance** — McNemar b=38/c=37, p=0.50, no regression. Directive levers saturated; literal/value (§4 #2a) + date-encoding (§4 #2c) levers both falsified standalone offline (run 31) ⇒ reasoning levers (§4 #3/#1) next |
| 7 | Spider raw EX | 0.1852 | target 0.75; was 0.1704 (06-12). Gemini key restored 06-17 → `no_sql` 36 → 9 (`SK-LLM-039`). Run 33: external-knowledge injection (`SK-QUAL-016`). **Self-consistency `SK-QUAL-017` (§4 #3): vote core (34) + execution half (37) + temperature-sampling half (run 40) + **runner `--self-consistency N` / `--sc-temperature T` main-loop wiring (run 41)** — `samples>=2` branch in `runOneQuestion` (separate from `withExecRetry`): `samplePlans`→`voteOverSamples` over `executeRows`→score-the-winner; folds into checkpoint/budget-stop/`attempts`, `.scN` checkpoint variant. The lever is now end-to-end bar the CI `workflow_dispatch` input. EX delta next dispatch** |
| 8 | persona-bench free-chain EX | **0.90 (18/20)** | full-chain ICP EX (run 58 GHA 27983818047; **run 63 reproduced it locally**). **1.7× BIRD, 4.9× Spider** — GLOBAL-026 bet. **Single N=20 runs are ±1 noisy** — misses flake across legs/runs (q8/q11/q18) as failover assigns models per run — so canonical N=500 BIRD/Spider (dispatch-gated <7d) stay the only *powered* engine levers. Run 63 root-caused the one **stable** miss q8: a **tie-fragile gold**, not an engine gap — `score.ts` is sequence-strict on `ORDER BY` golds and q8 tied two facts at count 2, so the weak llama leg (`GROUP BY object`) false-mismatched gold (`GROUP BY f.id`); fixed tie-free (`SK-QUAL-019`, fixture-only). Batch 3 (run 68) 20 → 23 q, gold-exec 23/23 (GHA 0.90 was on 20 q; local throttled 21/23); retrieval precision@1 18/20 → 18/23 (run 68) → 19/23 (run 74) → **20/23** (run 76: q20 landed by reframing the `scalar-subquery` demo to the natural "Which products are priced above the average price? List the product names"; both q21+q20 were exemplar-phrasing leaks, not selector gaps; held-out still 14/14; 3 residual misses q8/q10/q22 stay selector-side) |
| 9 | free-vs-frontier delta | null *(secret-blocked, not dispatch-blocked)* | run 58 dispatched persona-bench with `include_frontier=true`, but the job log shows `OPENROUTER_FRONTIER_API_KEY:` resolves **empty** → only the free lane built, `free_vs_frontier_delta=null`. Root-caused + filed in `blocked-by-human.md` (founder sets the repo secret). The dispatch path itself is proven working; the delta lands the moment the key is set. Agentic lane also not yet run (`SK-QUAL-004`, target ≤ 25 pp) |
| | **Ops — 7d, CF Workers analytics (06-22 re-pull)** | | wall-time, all routes (not `/ask`-only) |
| 10 | nlqdb-api requests / errors | 990 / 0 (0.00%) | mcp 314 req, events-worker 37 req, both 0 err; 7d totals lower as walker traffic ages out |
| 11 | nlqdb-api wall-time p50 / p95 | 0.94 ms / 2.62 s (06-22) | `workersInvocationsAdaptive` wallTime; p50 trivial routes (static/CORS/health), p95 LLM-bound asks; `/ask`-only split needs Grafana `metrics:read` (agent has write-only key) |
| 12 | $ spend | ~$0 | free tiers across CF / Neon / LLM chain |
| | **Pivot — agent-memory wedge** (GLOBAL-036) | 14 / 20 + 10 memory /vs pages | tick ⬜→✅ with PR link on merge; mirrors `docs/features/agent-memory-pivot/worksheets/INDEX.md`; run 53 +`/vs/pinecone` (P2 cluster 4→5); run 56 +`/vs/chroma` (OSS-first vector wing — P2 cluster 5→6); run 59 +`/vs/weaviate` (enterprise/hybrid-search wing — P2 cluster 6→7); run 61 +`/vs/qdrant` (Rust/quantization wing — P2 cluster 7→8, closes the top-tier vector-DB brand cluster); run 79 +`/vs/cognee` (knowledge-graph wing — P2 cluster 8→9, the "not a vector store" memory framework); run 84 +`/vs/milvus` (open-source billion-scale ANN wing — P2 cluster 9→10) |
| | *Messaging track — WS-\** | 12 / 13 (WS-07 ✅ 3/3, WS-09 ✅ 2/2, WS-12 ✅ 2/2, WS-13 ✅) | pick when worst number is funnel / distribution |
| WS-01 | competitors.md anchor (Zep / Letta / LangMem) | ✅ | run 19 — §4 + threat matrix; unblocks WS-02 |
| WS-02 | memory `/vs` pages (one per run) | ✅ 3/3 | run 20 — **Zep ✅** (`/vs/zep`); run 21 — **Letta ✅** (`/vs/letta`); run 22 — **LangMem ✅** (`/vs/langmem`) — WS-02 closed |
| WS-03 | solve pages — sharpen + sibling | ✅ 2/2 | run 23 — **sharpen ✅**; run 25 — **analytical sibling ✅** (`analytical-queries-over-agent-memory`, the read-side report-over-memory wedge) |
| WS-04 | MCP tool + package + docs framing | ✅ | run 24 — three tool descriptions + `package.json` desc + `mcp.mdx` intro now lead with "analytical memory" (copy only; SK-PIVOT-003) |
| WS-05 | carousel analytics-over-memory slides | ✅ | run 26 — 2 analytics-over-memory slides (`GROUP BY category` + top-N `ORDER BY … LIMIT 5`), MCP surface; data-only `showcase-examples.ts` |
| WS-06 | Mem0 \| Zep \| Letta \| nlqdb capability matrix | ✅ | run 27 — **data ✅** (`agentMemoryMatrix.ts`, 9 honest rows + test); run 28 — **render ✅** (`AgentMemoryMatrix.astro`, four-up glyph grid, nlqdb accent column, no `<img>`) |
| WS-07 | `/agents` landing | ✅ 3/3 | run 30 — **skeleton + hero ✅**; run 31 — **matrix + moat ✅** (WS-06 matrix + typed-plan trust-boundary pipeline + FSL/BYO-key band); run 35 — **CTA + demand-signal ✅** (memory-shaped "try this query" → `agents.try_query_clicked` GLOBAL-024 → `/app/new`; Topnav `Agents` link; P2-keyed `/vs` cross-link). WS-07 closed → **unblocks E-06** |
| WS-08 | on-brand OG / social images | ✅ | run 42 — `scripts/og/gen-og.mjs` SVG→PNG generator + 5 committed `public/og/*.png` cards (`/agents` + the 4 P2 memory `/vs`); `ogImage` wired; generator stays out of `astro build` (SK-PIVOT-012) |
| WS-09 | "database, not a vector store" blog + live demo | ✅ 2/2 | run 30 — **blog draft ✅** (launch post in `distribution-queue.md`); run 41 — **live `/agents` demo ✅** — fixture round-trip (`agent_memory` rows → English goal → compiled `GROUP BY` SQL → result table, server-rendered for AEO/no-JS per SK-PIVOT-004; "Run this query" button → `agents.demo_run_clicked` GLOBAL-024 signal; no open `/v1/ask`). WS-07 page existing cleared the #430 collision |
| WS-10 | FSL self-host messaging (GLOBAL-019 / arch §0 doc-fix shipped) | ✅ | run 28 — pricing self-host band + README "Models & plans" self-host line (FSL-accurate; no turnkey-image claim per WS-11 note) |
| WS-11 | pull `ghcr.io/nlqdb/api` self-host container forward | ⬜ | high · multi · WS-10 · infra-gated |
| WS-12 | home reweight + demote P1/P3/P4 to "also works for…" | ✅ 2/2 | run 43 band; run 44 `AlsoWorksFor` fold before CodePanel + Replaces (composition-only, nothing deleted, hero untouched) |
| WS-13 | headline reposition (hero / README / llms.txt / JSON-LD) | ✅ | **founder tripped the gate 2026-06-24** (SK-PIVOT-013); 4 lead strings → "Analytical memory for AI agents" + `/agents` connect-via-MCP CTA |
| | *Engine track — E-\** | 2 / 7 | pick when worst number is engine quality / agent on-ramp |
| E-01 | `agent_memory_v1` schema preset for `db.create` | ✅ | run 29 module + run 30 wiring (SK-HDC-020): `db.create { preset: "agent_memory_v1" }` provisions the 4 tables deterministically, no LLM; gated behind `MEMORY_PRESET`. One follow-on: quality-eval ablation row (Neon-branch gated) |
| E-02 | additive MCP tool `nlqdb_remember` (no rename) | ✅ | run 31 (SK-PIVOT-008): server-built deterministic parameterised INSERT via `POST /v1/memory/remember` (never `/v1/run` — trust boundary), `wrong_preset` guard, SDK `remember()`, `nlqdb_remember` tool. Follow-ons: e2e Neon smoke (infra) + CLI `nlq remember` (Go) |
| E-03 | per-agent / end-user / thread scoping — **RLS, not query-rewriting** (SK-PIVOT-009, mechanism corrected run 32) | ⬜ | **high · security-critical** · ~2 runs · E-01 · Neon-gated |
| E-04 | TTL + cron sweep (`expires_at`) | ⬜ | low · 1 run · E-01 |
| E-05 | hybrid recall — pgvector + `nlqdb_recall` | ⬜ | high · multi · E-01 · infra-gated |
| E-06 | preset on-ramp — **authed** create surface (`MEMORY_PRESET`-gated) | ⬜ redirected | run 37 (SK-PIVOT-010): anon `/agents` CreateForm path infeasible (3 auth boundaries); blocked on `MEMORY_PRESET=1` in prod (dark) |
| E-07 | workload-analyzer rule: memory DBs → ClickHouse (Phase 3) | ⬜ | med · multi · E-01 + Phase-3 multi-engine |

## Last change

**2026-06-24 (founder-directed, #506)** — WS-13 headline reposition: the site
now leads with the agent-memory wedge sitewide and `/agents` connects an agent
over MCP instead of dropping it into the generalist create flow. Pivot
13 → 14/20, messaging 11 → 12/13. **KPI:** onboarding + UX (GLOBAL-025); none
degraded — copy/markup only, hero input (SK-WEB-002) + `AlsoWorksFor` fold +
off-wedge pages kept (dual front door). Revert cost = one commit.

*Full per-run history: `git log`, `progress/quality-score-verification-log.md`,
and the WS-*/E-* worksheets — not this file.*
