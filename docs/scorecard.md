# Scorecard

Regenerated daily by [`/daily`](../.claude/commands/daily.md) step 1 from live
sources (D1, KV, CF GraphQL, `tools/eval/baseline-2026-06-15.json`). One table; soft 5 KB cap
**relaxed while the agent-memory pivot is in flight** (GLOBAL-036) — the
20-row Pivot section mirrors [`agent-memory-pivot/worksheets/INDEX.md`](features/agent-memory-pivot/worksheets/INDEX.md)
so every WS-* / E-* status is visible at a glance; the section collapses
back to a one-line summary once the pivot completes. Published distribution
URLs land here when a queue entry ships.

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

## Deltas (recent runs)

- 2026-06-24 (founder-directed) — **WS-13 headline reposition shipped — the
  site now leads with the wedge sitewide, and `/agents` connects an agent over
  MCP instead of dumping it into the generalist create flow.** Founder tripped
  the GLOBAL-036 founder-gate directly (SK-PIVOT-013), overriding the
  "wait for non-zero wedge-sourced waitlist rows" default — the wedge surface
  (`/agents` + matrix + 10 memory `/vs` + live demo) is live and the revert
  cost is one commit. **Δ:** four lead strings (`Hero.astro` lede/sub,
  `README` H1+tagline, `llms.txt` lede, homepage `<title>`+description/JSON-LD,
  root `package.json` desc, `Base.astro` default `ogImageAlt`) → "Analytical
  memory for AI agents"; homepage OG → wedge card `/og/agents.png`; `/agents`
  terminal CTA rebuilt to connect-via-MCP (paste `mcp.nlqdb.com` + `nlq mcp
  install` + docs link, naming Claude/Cursor/Codex), generalist `/app/new`
  demoted to a secondary link, new `agents.connect_clicked` demand signal
  (GLOBAL-024). Pivot **13→14/20**, messaging **11→12/13**. **KPI:** onboarding
  + UX (GLOBAL-025); **none degraded** — copy/markup only, hero input
  (SK-WEB-002) + `AlsoWorksFor` fold + off-wedge pages kept (dual front door),
  no engine/ops/funnel-instrument file touched. If the repositioned funnel still
  shows ~0 wedge-sourced signups after a fair window, revert (WS-13 rollback note).
- 2026-06-24 (run 87) — **UX/a11y: the Cmd+K command palette is now a proper
  WAI-ARIA combobox — assistive tech announces each command as the user arrows
  through it.** Arrow-key navigation moved only a *visual* `data-highlight`; the
  input had no `aria-activedescendant`, the list no `listbox`/`option` roles, so
  screen-reader users heard nothing as the selection moved (SK-WEB-005 is
  keyboard-first — this closes the silent-SR gap). Input → `role=combobox` +
  `aria-controls` + `aria-activedescendant`; list → `role=listbox`; rows →
  `role=option` + `aria-selected`. The clamp/bounds nav logic was extracted to a
  tested pure `lib/palette-nav.ts` (mirrors run 82's `create-errors.ts`), which
  also hardened the out-of-range recovery (a narrowing filter can leave the index
  past the end). **Δ:** web tests **+7**; palette active-command ARIA associations
  **0 → 3** (combobox→listbox + active option + `aria-selected`). **KPI:** UX
  (GLOBAL-025); none degraded — additive ARIA + pure-logic extraction, no
  engine/funnel/ops file touched; astro-check 0 errors, biome clean. (#507)
- 2026-06-24 (run 86) — **AEO: `llms.txt` now advertises the `/agents` pivot
  landing + `/pricing`** (the crawler index LLM IDEs fetch had omitted the wedge's
  *headline* page); also corrected the stale `Status` line (`closed beta` → `open`,
  GLOBAL-027 gate removed in #496). **Δ:** `PRIMARY_LINKS` **4 → 6** (verified in
  `dist/llms.txt`); web tests **132 → 135 (+3)** (new `llms.txt.test.ts` pins the
  routes + open-status). **KPI:** onboarding / distribution; none degraded —
  additive index entries + copy fix + test, no engine/funnel/ops file touched.
- 2026-06-24 (run 85) — **Distribution: `/solve/track-ai-token-usage-and-cost`**
  — solve pages 8 → 9, the first P2 LLM-spend-attribution on-ramp (log each call
  as a typed row → `GROUP BY` in SQL). Web tests 129 → 132; none degraded. (#504)
- 2026-06-24 (run 84) — **Distribution: `/vs/milvus`** — comparison pages 18 → 19,
  P2 memory vector-cluster 9 → 10 (OSS ANN; embedding recall, no JOIN/GROUP BY).
  None degraded. (#503)
- 2026-06-24 (runs 82–83) — **UX/AEO wave (both merged; engine untouched; none
  degraded).** Run 82: CreateForm error state now exposed to assistive tech
  (`aria-invalid` + `aria-describedby` → one `role="alert"` region; per-kind copy
  to tested `lib/create-errors.ts`; ARIA associations 0 → 2, net −1 error branch;
  web tests 121 → 129). Run 83: homepage declares its brand entity —
  `Organization` + `WebSite` JSON-LD with stable `@id`s, every page's
  `SoftwareApplication` names that Organization as `publisher`; **no SearchAction**
  (the hero submits via JS, no GET `q` route — a sitelinks-searchbox target would
  be a lie); homepage entity nodes 1 → 3 (verified in `dist/`).
- 2026-06-24 (run 81) — **AEO: `/vs` + `/solve` *hub* pages emit `ItemList`
  JSON-LD enumerating the full collection — hub pages with a collection signal
  0 → 2** (`lib/itemlist-jsonld.ts`, data-driven from `COMPETITORS`/`SOLVE_ENTRIES`
  so the JSON-LD can't drift; `dist/`: `/vs` 17 items, `/solve` 7). First
  confirmed offline-retrieval is **exhausted** for the 3 residual persona-bench
  misses (q8/q10/q22 are *not* q20/q21-style phrasing leaks; the one latent
  ratio-cast plural/singular imperfection doesn't move precision@1). None
  degraded; 133 web tests.
- 2026-06-24 (runs 79–80) — **Distribution wave (both merged; engine
  dispatch-gated, none degraded).** Run 79: `/vs/cognee` (18th comparison page,
  P2 knowledge-graph wing — Cognee does hybrid vector+KG recall but ships no SQL
  layer; comparison pages 17 → 18, memory /vs 8 → 9). Run 80:
  `/solve/store-query-chatbot-conversation-history` (8th solve page, the
  conversation-transcript + engagement-analytics wedge — a vector store recalls
  a message but can't `GROUP BY`; solve pages 7 → 8). Both additive AEO pages
  with FAQPage/BreadcrumbList(/HowTo) JSON-LD verified in `dist/`, honest limits
  stated; no engine/funnel/ops file touched.
- 2026-06-21/23 (runs 37–78) — **engine + distribution + doc-hygiene waves (all
  merged; BIRD 06-19 / Spider 06-17 untouched; none degraded). Full per-run
  detail: `progress/quality-score-verification-log.md` + git.** **Engine (offline
  retrieval instrument):** §4 #1 DAIL-SQL retrieval built end-to-end offline
  (`few-shot-select.ts` value-mask + Jaccard + top-k, schema-aware selector,
  `buildPlanSystem(goal,schema,k)`, `SK-LLM-041`); §4 #3 self-consistency
  (`SK-QUAL-017`, runner `--self-consistency`/`--sc-temperature`, default greedy
  byte-identical); pool 12 → 14, run-52 lexical-selector avenue falsified ⇒
  selector half at offline ceiling; pool-curation fixes (q21 run 74, q20 run 76 —
  exemplar-phrasing leaks) → own-ICP precision@1 **12/12 → 20/23**, held-out
  **14/14**; persona-bench → dispatchable `EvalDataset` 20 → 23 golds, gold-exec
  23/23 (SK-QUAL-018); `quality-eval-persona-bench.yml` shipped + first dispatch →
  free-chain **EX 0.90 (18/20)** on the ICP shape (row 8; 1.7× BIRD, 4.9× Spider;
  GHA 27983818047). Frontier lane (row 9) secret-blocked
  (`OPENROUTER_FRONTIER_API_KEY` empty), filed in `blocked-by-human.md`. Plus E-04
  TTL-sweep core (`SK-PIVOT-011`) + SK-PIVOT-010 finding. **Distribution (AEO):**
  `/vs/pinecone`, `chroma`, `weaviate`, `qdrant`, `julius`, `retool`, `basedash`,
  `metabase` → comparison pages **9 → 17**, OG cards (WS-08, SK-PIVOT-012); WS-09
  `/agents` fixture demo; WS-12 → messaging 11/13, pivot 13/20; FAQPage (run 77,
  site 24 → 25) + BreadcrumbList (run 78, 0 → 24 pages); `trailingSlash: "always"`
  → sitemap 200/307 **1/27 → 28/0** (run 69);
  `/solve/database-claude-cursor-can-query` (solve 6 → 7). **Doc-hygiene
  (D4+D5+P3, prod byte-identical):** `distribution-queue.md` 35.9 → 9.1 KB;
  net-shrank `hosted-db-create` (−1,277 B), `ask-pipeline` (−1,257 B),
  `anonymous-mode` (−3,974 B), `performance.md`, `architecture.md`, `runbook.md`,
  `progress.md`, `quality-score-source-of-truth.md` — all under the D4 cap, all
  SK-IDs intact.
- 2026-06-13/20 (runs 1–36) — day-one scorecard + engine-instrument /
  provider-resilience waves, then the agent-memory pivot launch (all
  closed/additive; BIRD 06-19 + Spider 06-17 untouched). Engine: Gemini key heal,
  Spider 0.1852, join-bridge pruner T21 + HAVING directive T22, `SK-QUAL-014/015/016/017`,
  `SK-LLM-038/039`, `SK-HDC-019` — then canonical BIRD flat (0.522 → 0.520,
  McNemar p=0.50) ⇒ directive levers saturated, value-retrieval falsified
  (`literal_only` = 0, `SK-QUAL-014`). Pivot → 10/20, messaging → 8/13: **E-01**
  `agent_memory_v1` preset + **E-02** `nlqdb_remember` (+CLI parity) → engine 2/7,
  competitors anchor, memory `/vs` pages, `/agents` skeleton+hero+matrix+CTA,
  launch post, FSL self-host copy; TTL fail-loud (GLOBAL-012); findings
  SK-PIVOT-009/010. Full per-run detail:
  `progress/quality-score-verification-log.md` + the WS/E worksheets.
