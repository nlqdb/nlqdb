# SK-QUAL-001 — Benchmark canon: BIRD (real-world) + Spider 2.0 (multi-dialect); accuracy reported by tier

Parent feature: [`quality-eval/FEATURE.md`](../FEATURE.md).

- **Decision:** The eval harness runs two open benchmarks: **BIRD** (Big Bench for Industrial Database; messy real-world schemas — BIRD Mini-Dev ships 500 questions across 11 SQLite DBs, with MySQL + Postgres transpilations added 2025-07) and **Spider 2.0-lite** (SQLite subset only — the upstream `xlang-ai/Spider2@main` ships **547 rows** total across BigQuery (180) / Snowflake (207) / SQLite (135) / Google-Analytics SF (25); DuckDB lives in the separate `spider2-dbt` dataset, not lite; zero Postgres rows. Cross-engine generalisation evidence comes from BIRD's dialect transpilations instead). Accuracy is reported separately for each tier of the [`llm-router`](../../llm-router/FEATURE.md) — Tier 1 (cheap classify), Tier 2 (Sonnet plan), Tier 3 (Opus hard) — and separately with and without the semantic-layer scaffolding.
- **Core value:** Bullet-proof, Honest latency
- **Why:** A single accuracy number averaged across tiers hides the failure mode (Opus is fine, Tier 1 misroutes). Per-tier reporting tells us *which model* to retrain / swap / cap. BIRD is the standard "messy real-world" benchmark and the closest analogue to the schemas users build with `db.create`. Spider 2.0 covers dialect / cross-domain generalization that BIRD doesn't. Both are public; results stay comparable to published research.
- **Consequence in code:** `tools/eval/src/runner.ts` (shipped slice 1) loads BIRD Mini-Dev, calls `packages/llm/src/router.ts::plan()` with the question + schema, executes the generated SQL against the BIRD SQLite fixtures, and compares the result-set to the gold answer. Per-lane accuracy lands in `tools/eval/results/<iso>.json`; baseline diff + event emission ship in slice 2 per [`SK-QUAL-002`](./SK-QUAL-002-weekly-cron.md). Spider 2.0-lite SQLite loader ships in slice 3a per [`SK-QUAL-007`](./SK-QUAL-007-spider2-lite-loader.md); slice 3b ([`SK-QUAL-008`](./SK-QUAL-008-spider2-lite-multi-csv-scorer.md)) ships the canonical multi-CSV scorer so all 135 `local###` rows contribute. The harness is a tool, not a CI gate (see `SK-QUAL-002`).
- **Alternatives rejected:**
  - Bespoke internal benchmark — non-comparable to research; no external validity.
  - WikiSQL only — too easy; saturated by 2024.
  - Spider 1.0 only — superseded; 2.0 covers more dialects.
  - Single averaged accuracy number — hides per-tier regression, the actionable signal.
  - **Spider 2.0 full set including BQ/Snowflake via transpilation** — adds a transpilation-bug failure mode the harness can't distinguish from a model-quality regression; SQLite subset is the honest call (corrected 2026-05).
