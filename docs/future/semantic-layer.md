# Future plan — Semantic-layer adoption (Phase 2)

> **Status:** planned for Phase 2. This doc carries forward the
> semantic-layer adoption plan from the deleted `docs/design.md §17`
> (PR #81 consolidation). Promote any decision below into a `SK-HDC-NNN` /
> `SK-ASK-NNN` block — or a `GLOBAL-NNN` if cross-cutting — once it's
> firm. Per `P4 / D1` of `CLAUDE.md §2`, vague decisions are worse than
> no decision; do not promote until the underlying choice is resolved.

**Cross-refs:**
- [`docs/architecture.md §3.6.3`](../architecture.md) — auto-generated semantic-layer moat at create time (the seed)
- [`docs/research-receipts.md §8`](../research-receipts.md) — research backing (dbt 2026 benchmark, OSI standard, Cortex / Genie / Wren AI)
- [`docs/features/hosted-db-create/SKILL.md`](../../docs/features/hosted-db-create/SKILL.md) — Phase 1 metrics/dimensions emission
- [`docs/features/ask-pipeline/SKILL.md`](../../docs/features/ask-pipeline/SKILL.md) — runtime planner that consumes the layer
- [`docs/features/sql-allowlist/SKILL.md`](../../docs/features/sql-allowlist/SKILL.md) — semantic-aware allow-list extension

---

## Why

The 2025–2026 NL-to-SQL frontier diverged hard from raw-schema
introspection. dbt's 2026 benchmark reports up to **3× accuracy** when
the LLM queries through a curated semantic model rather than raw
`information_schema` columns; Snowflake Cortex Analyst, Databricks
Genie, Wren AI, and the new [Open Semantic Interchange (OSI)](https://www.dataengineeringweekly.com/p/knowledge-metrics-and-ai-rethinking)
standard all converge on semantic-first NL2SQL. Full receipts in
[`docs/research-receipts.md §8`](../research-receipts.md).

## Relationship to the auto-baseline

The typed-plan output of `db.create` (`docs/architecture.md §3.6.2`)
already carries `metrics` and `dimensions`. Phase 1 emits an
auto-generated baseline at create time; Phase 2 makes that baseline
**editable, OSI-compatible, and source-controlled**. The auto-baseline
is the seed, not a parallel system.

## Shape of the Phase 2 ship

1. **OSI-compatible YAML** at `~/.nlqdb/semantic.yml` (or per-DB in
   the registry). Compatible subset of MetricFlow + OSI shape —
   `entities`, `dimensions`, `metrics`, `joins`. The user's existing
   dbt MetricFlow / Cube / LookML dump becomes the source of truth.
2. **Optional, not required.** Without `semantic.yml` the planner
   still works against raw schema. With it, the LLM's `plan` prompt
   receives the curated dimensions/metrics list instead of (or in
   addition to) the raw schema dump.
3. **`nlq semantic init`** — bootstraps a starter `semantic.yml`
   from the live schema by inferring entities and 5–10 obvious
   metrics. User edits, commits to repo. Alternative path: export
   the §3.6 auto-baseline directly — no inference needed.
4. **Semantic-aware allow-list.** `apps/api/src/ask/sql-validate.ts`
   gains an optional pass that verifies referenced columns belong to
   dimensions/metrics declared in `semantic.yml`. Mis-references fail
   with `semantic_violation` instead of leaking schema.
5. **Cache key includes the `semantic.yml` fingerprint** so the
   cached schema hash invalidates when a metric is renamed
   (extension of `GLOBAL-006` plan-cache keying).

## Out of scope for Phase 2

- Authoring UI (no in-product YAML editor).
- Multi-engine semantic projection (BigQuery / Snowflake-specific
  dialects via sqlglot transpile).
- Semantic-layer marketplace.

## Deferred decisions

- **dbt MetricFlow ingest.** Whether to ingest dbt MetricFlow
  `*.yml` directly (would force a Python sidecar via
  `metricflow-semantics`) or only the OSI-standardized subset.
  Current lean: OSI only, to keep the Worker bundle clean. Revisit
  if a customer asks for native MetricFlow.
- **Embedding cache for dimension descriptions.** pgvector on Neon
  vs Cloudflare Vectorize. Vectorize wins on operational simplicity;
  benchmark before committing.

## Promotion path

When Phase 2 work begins, decisions from this doc move into:

- Plan-cache fingerprint extension → `SK-PLAN-NNN` in `plan-cache/SKILL.md`.
- Semantic-aware allow-list → `SK-SQLALLOW-NNN` in `sql-allowlist/SKILL.md`.
- `nlq semantic init` verb → `SK-CLI-NNN` in `cli/SKILL.md`.
- `semantic.yml` shape and registry layout → `SK-HDC-NNN` in `hosted-db-create/SKILL.md`.

Once promoted, this doc becomes a back-reference (delete the
duplicated body and link forward) — same convention as
`docs/research/open-questions.md`.
