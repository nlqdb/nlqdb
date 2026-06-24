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
| | **Pivot — agent-memory wedge** (GLOBAL-036) | 13 / 20 + 9 memory /vs pages | tick ⬜→✅ with PR link on merge; mirrors `docs/features/agent-memory-pivot/worksheets/INDEX.md`; run 53 +`/vs/pinecone` (P2 cluster 4→5); run 56 +`/vs/chroma` (OSS-first vector wing — P2 cluster 5→6); run 59 +`/vs/weaviate` (enterprise/hybrid-search wing — P2 cluster 6→7); run 61 +`/vs/qdrant` (Rust/quantization wing — P2 cluster 7→8, closes the top-tier vector-DB brand cluster); run 79 +`/vs/cognee` (knowledge-graph wing — P2 cluster 8→9, the "not a vector store" memory framework) |
| | *Messaging track — WS-\** | 11 / 13 (WS-07 ✅ 3/3, WS-09 ✅ 2/2, WS-12 ✅ 2/2) | pick when worst number is funnel / distribution |
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

- 2026-06-24 (run 83) — **AEO: the homepage now declares its brand entity —
  `Organization` + `WebSite` JSON-LD, and every page's `SoftwareApplication`
  names that Organization as `publisher` by `@id`.** With offline-retrieval
  exhausted (run 81), engine canonical dispatch-gated (Spider 06-17 crosses 7 d
  on 06-25 — re-dispatch is due on a run that does *not* merge a PR, so not this
  run), and the CreateForm a11y lever taken by run 82 (PR #501), this took the
  highest-leverage non-colliding structured-data gap: the homepage carried only
  the site-wide `SoftwareApplication` — no `Organization` (brand-authority entity
  for "nlqdb" queries) and no `WebSite` (the node Google reads for the SERP site
  name). Added shared `lib/site-jsonld.ts` (+test); homepage-only nodes with
  stable `@id`s (`#organization`/`#website`) that crawlers consolidate with the
  per-page `publisher` reference. **No SearchAction** — the goal-first hero
  submits via JS to `/v1/ask` (SK-WEB-002) and no GET route consumes a `q` term,
  so a sitelinks-searchbox target would be a broken signal; omitted until a
  URL-driven query entrypoint exists. **Δ:** homepage entity nodes **1 → 3**
  (verified in `dist/index.html`: all 3 parse; `/pricing` correctly carries only
  `SoftwareApplication` + the `publisher` `@id` binding). **KPI:** onboarding /
  distribution; **none degraded** — additive static JSON-LD, no engine/funnel/ops
  file touched; 124 web tests (+3 new) + build green + biome clean.
- 2026-06-24 (run 82) — **UX/onboarding a11y: the anonymous first-query
  CreateForm now exposes its error state to assistive tech.** On a failed first
  query the input gained `aria-invalid` + `aria-describedby` pointing at the
  error, which is now a single `role="alert"` region; previously the field gave
  AT users no invalid signal and wasn't linked to the message, and the two
  duplicate error branches (`error` vs `networkError`) rendered separately. Per-
  kind error copy extracted to a tested `lib/create-errors.ts`; the redundant
  `aria-label` dropped (the visible `<label htmlFor>` already names the field).
  **Δ:** web tests **121 → 129 (+8)**; CreateForm error-state ARIA associations
  **0 → 2**; net −1 error branch (dedup). **KPI:** onboarding / UX (GLOBAL-025);
  **none degraded** — additive a11y attrs + a code dedup, no
  engine/funnel/ops/prod-behaviour change; astro-check 0 errors, biome clean.
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
- 2026-06-23 (runs 77–78) — **AEO structured-data wave (both merged; engine
  dispatch-gated, none degraded).** Run 78: every `/vs` + `/solve` page now
  emits `BreadcrumbList` JSON-LD + a visible breadcrumb trail (shared
  `lib/breadcrumb.ts`, trailing-slash `item` URLs matching the run-69 canonical
  fix; visible `<nav>` matches markup per Google's rule) — **0 → 24 pages**.
  Run 77: the hand-authored `/agents` lead-wedge front door (the only key
  landing page without it) now emits `FAQPage` JSON-LD from a typed `faqs`
  array (visible `<dl>` + schema, can't drift; every answer restates on-page
  copy) — site `FAQPage` pages **24 → 25**. Both additive static structured
  data; 130 web tests + astro-check clean.
- 2026-06-22/23 (runs 48–76) — **engine + distribution + doc-hygiene waves (all
  merged; BIRD 06-19 / Spider 06-17 untouched; none degraded). Full per-run
  detail: `progress/quality-score-verification-log.md` + git.** **Engine (offline
  retrieval instrument):** DAIL-SQL pool 12 → 14, run-52 lexical-selector avenue
  falsified ⇒ selector half at offline ceiling; pool-curation fixes (q21 run 74,
  q20 run 76 — exemplar-phrasing leaks) → own-ICP precision@1 **17/20 → 20/23**,
  held-out **14/14**; persona-bench 20 → 23 golds, gold-exec 23/23 (SK-QUAL-018);
  `quality-eval-persona-bench.yml` shipped + first dispatch → free-chain **EX 0.90
  (18/20)** on the ICP shape (row 8; 1.7× BIRD, 4.9× Spider; GHA 27983818047).
  Frontier lane (row 9) secret-blocked (`OPENROUTER_FRONTIER_API_KEY` empty),
  filed in `blocked-by-human.md`. **Distribution (AEO):** `/vs/pinecone`, `chroma`,
  `weaviate`, `qdrant`, `julius`, `retool`, `basedash`, `metabase` → comparison
  pages **9 → 17**, OG cards +; FAQPage (run 77, site 24 → 25) + BreadcrumbList
  (run 78, 0 → 24 pages); `trailingSlash: "always"` normalize → sitemap 200/307
  **1/27 → 28/0** (run 69); `/solve/database-claude-cursor-can-query` (solve 6 → 7).
  **Doc-hygiene (D4+D5+P3, prod byte-identical):** net-shrank `hosted-db-create`
  (−1,277 B), `ask-pipeline` (−1,257 B), `anonymous-mode` (−3,974 B),
  `performance.md`, `architecture.md`, `runbook.md`, `progress.md`,
  `quality-score-source-of-truth.md` — all under the D4 cap, all SK-IDs intact.
- 2026-06-21/22 (runs 37–47) — engine + distribution + hygiene staging wave (all
  merged/additive; BIRD 06-19 + Spider 06-17 untouched). **Engine:** §4 #1
  DAIL-SQL retrieval built end-to-end offline (`few-shot-select.ts` value-mask +
  Jaccard + top-k, schema-aware selector, `buildPlanSystem(goal,schema,k)`,
  curated pool → 12 buckets, `SK-LLM-041`, precision@1 12/12); §4 #3
  self-consistency (`SK-QUAL-017`, runner `--self-consistency`/`--sc-temperature`,
  default greedy byte-identical); persona-bench → dispatchable `EvalDataset` 20
  golds (`SK-QUAL-018`). **Distribution:** WS-08 OG cards (SK-PIVOT-012), WS-09
  `/agents` fixture demo, WS-12 → messaging 11/13, pivot 13/20. **Hygiene:**
  `distribution-queue.md` 35.9 → 9.1 KB. Plus E-04 TTL-sweep core (`SK-PIVOT-011`)
  + SK-PIVOT-010 finding. KPI engine quality / onboarding; none degraded.
- 2026-06-19/20 (runs 19–36) — agent-memory pivot launch wave + engine staging
  (all closed/additive; BIRD 06-19 + Spider 06-17 untouched). Messaging → 8/13,
  pivot → 10/20 (competitors anchor, memory `/vs` pages, `/agents`
  skeleton+hero+matrix+CTA, launch post, FSL self-host copy). Engine: **E-01**
  `agent_memory_v1` preset + **E-02** `nlqdb_remember` (+CLI parity) → engine
  2/7; self-consistency core (`SK-QUAL-017`), Spider external-knowledge
  (`SK-QUAL-016`), TTL fail-loud (GLOBAL-012); findings SK-PIVOT-009/010. Per-run
  detail: `progress/quality-score-verification-log.md` + the WS/E worksheets.
- 2026-06-13/19 (runs 1–18) — day-one scorecard + engine-instrument /
  provider-resilience / deferred-lever waves (Gemini key heal, Spider 0.1852,
  join-bridge pruner T21, HAVING directive T22, `SK-QUAL-014/015`,
  `SK-LLM-038/039`, `SK-HDC-019`), then canonical BIRD re-run flat (0.522 →
  0.520, McNemar p=0.50) ⇒ directive levers saturated and `SK-QUAL-014`
  falsified value-retrieval as the top lever (`literal_only` = 0). Full per-run
  detail: `progress/quality-score-verification-log.md`.
