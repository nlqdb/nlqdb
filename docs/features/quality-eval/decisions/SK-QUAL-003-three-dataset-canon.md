# SK-QUAL-003 — Three-dataset canon: BIRD-dev + Spider 2.0-lite (SQLite subset) + internal `db.create` eval (the third dataset is the one that matters most)

Parent feature: [`quality-eval/FEATURE.md`](../FEATURE.md).

- **Decision:** The harness reports on **three** datasets, in this order
  of weight: (1) **Internal `db.create` eval** — questions sampled from
  real user `db.create` schemas (anonymized via aggressive column-name +
  value-class swaps; no row data persisted), scored against the gold
  answer the user actually accepted; this is the dataset that most
  closely matches production. (2) **BIRD-dev** (Mini-Dev, 500 SQLite
  questions) — public, comparable to published research, our "honest
  external" yardstick; **annotation errors confirmed at 52.8% (263/498)
  by VLDB/CIDR 2026 papers from the UIUC Kang group**
  ([arXiv:2601.08778](https://arxiv.org/abs/2601.08778) — schema/data
  mismatches 57.8%, ambiguity 29.7%, semantic mismatches 29.3%,
  domain-knowledge issues 10.7%; categories overlap). Runs are also
  evaluated against the `uiuc-kang-lab/text_to_sql_benchmarks` corrected
  variant (`Arcwise-Plat-SQL`) when available — license posture must be
  checked before bundling. (3) **Spider 2.0-lite SQLite subset** —
  upstream ships **547 rows total** (180 BigQuery, 207 Snowflake, 135
  SQLite, 25 GA-on-Snowflake; zero Postgres rows; DuckDB lives in the
  separate `spider2-dbt` dataset). We restrict to the **135 `local###`
  rows**; all 135 are scored via the canonical multi-CSV result-set
  path (slice 3b per
  [`SK-QUAL-008`](./SK-QUAL-008-spider2-lite-multi-csv-scorer.md);
  slice-3a loader contract from
  [`SK-QUAL-007`](./SK-QUAL-007-spider2-lite-loader.md) governs file
  layout + path-traversal guards). Cross-engine generalisation
  evidence comes from BIRD's dialect transpilations (added 2025-07)
  instead.
- **Core value:** Bullet-proof, Honest latency, Free
- **Why:** Public benchmarks are gameable and stale — BIRD's
  distribution doesn't match a `db.create` schema, and Spider 2.0's
  enterprise complexity isn't what a solo-developer persona is asking.
  The internal eval, built from actually-accepted answers, is the only
  dataset that measures the thing we ship. Public benchmarks stay in
  the table for external comparability and so the "free-vs-frontier
  delta" stays meaningful to readers outside the team. **The three
  weights are not equal** — when the internal eval and BIRD disagree,
  internal wins. This prevents BIRD-overfit, the failure mode that
  broke the 2024 leaderboard *and was re-confirmed by VLDB / CIDR 2026
  papers showing 52.8% annotation-error rate on BIRD Mini-Dev*. The
  pre-2026-05 doc claim of "PG + ClickHouse subset only" was wrong —
  Spider 2.0-lite has no PG rows; the previously-cited "~260 rows
  total" reflected a stale HuggingFace mirror, not the upstream's
  canonical 547. Corrected 2026-05.
- **Consequence in code:** `tools/eval/src/datasets/` ships three
  loaders: `bird-mini.ts` (shipped slice 1), `spider2-lite.ts` (shipped
  slices 3a + 3b — all 135 SQLite questions scored via the canonical
  multi-CSV evaluator per
  [`SK-QUAL-007`](./SK-QUAL-007-spider2-lite-loader.md) +
  [`SK-QUAL-008`](./SK-QUAL-008-spider2-lite-multi-csv-scorer.md)),
  and `internal.ts` (slice 3 — reads `db.create` accepted-answer rows
  from a dedicated R2 bucket with `principal.id` stripped at write
  time per
  [`GLOBAL-024`](../../../decisions/GLOBAL-024-demand-signal-telemetry.md)'s
  privacy contract). An eval run covers all three once slice 3
  lands. The Grafana panel shows three lines, plus the
  free-vs-agentic-frontier delta as a separate panel.
- **Alternatives rejected:**
  - Internal-only — no external comparability; can't honestly answer
    "are you state of the art?"
  - BIRD-only — what we already had; misses the production-shape gap.
  - Equal weighting — when internal and BIRD disagree, the team has to
    choose; tying it to "internal wins" pre-commits us to the right
    answer.
  - **Spider 2.0-lite via sqlglot transpilation** (BQ/Snowflake → PG)
    — adds a transpilation-bug failure mode we can't distinguish from
    a model-quality regression; SQLite-only subset is the honest call.
  - **HuggingFace `xlangai/spider2-lite` as the source.** Stale at 260
    rows vs the upstream's 547 — verified by direct download
    2026-05-19; loader pins to the GitHub raw URL instead. See
    [`SK-QUAL-007`](./SK-QUAL-007-spider2-lite-loader.md).
