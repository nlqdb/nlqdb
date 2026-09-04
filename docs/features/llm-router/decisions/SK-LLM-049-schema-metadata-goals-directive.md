# SK-LLM-049 — Schema-metadata goals directive in the planner prompt (answer structure questions from the Schema block, never system catalogs)

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Extends
[`SK-LLM-018`](./SK-LLM-018-schema-fidelity-prompt.md) (the `PLAN_DIRECTIVES`
block) — the metadata sibling of its "schema-literal identifiers" bullet,
placed immediately after it so the two schema-grounding rules read together.
Orthogonal to the result-shape / grain / cast bullets
([`SK-LLM-027`](./SK-LLM-027-result-shape-directives.md) and successors). Not
replaced; one more bullet in the same block.

- **Decision:** `PLAN_DIRECTIVES` (`packages/llm/src/prompts.ts`) gains one
  bullet after the schema-literal bullet: "When the goal asks about the
  database's structure itself — what tables exist, or what columns a table
  has — answer from the Schema block by selecting the names as literal values
  (e.g. `SELECT 'albums' AS table_name UNION ALL SELECT 'artists'`); never
  query system catalogs (`information_schema`, `pg_catalog`,
  `sqlite_master`) — they are outside the provided schema and the query will
  be rejected." No exemplar is added or refit (see *Alternatives rejected*).
- **Core value:** Engine quality, Effortless UX, Bullet-proof
- **Why:** A metadata goal has no answer inside the user's tables, so a small
  model improvises a catalog query — the classic schema-grounding gap
  (hallucination surveys name fabricated structural references as the core
  text-to-SQL failure; grounding generation in the provided schema plus a
  validation backstop is the standard mitigation). Production instance
  (2026-08-16, chat): *"show all tables"* on a one-table DB → the free
  planner (gpt-oss-120b) emitted `SELECT table_name FROM
  information_schema.tables WHERE table_schema = 'members_e57783'` at
  confidence 1.00 → the `SK-ASK-016` pre-flight flagged `tables` as missing
  (`extractTables` yields the catalog relation, never in the compiled DDL) →
  `schema_mismatch` 409, rendered as the near-nonsensical *"No such table:
  tables"*. The failure is deterministic and non-recoverable
  (`Nonrecoverable`, no replan), so the prompt is the only quality lever; the
  pre-flight stays as the enforcement backstop (layered guardrails,
  `docs/research-receipts.md §1`). The Schema block the planner already
  receives IS the authoritative answer, and the constant-SELECT shape is the
  one way to return it through the pipeline unchanged: a FROM-less `SELECT`
  passes `validateSql` (read verb, no embedded reject), passes pre-flight
  (`extractTables` finds no relation nodes → no mismatch), is read-only (no
  `SK-TRUST-001` confirm gate), and is valid in both shipped dialects.
  BIRD/Spider contain no metadata goals, so the expected benchmark delta is
  ≈ 0 — the gain lands on the stranger-facing first-queries path
  (`GLOBAL-025` onboarding KPI) where "show all tables" currently dead-ends.
  Combined effect is re-measured on the next eval run, not on a PR
  ([`SK-QUAL-002`](../../quality-eval/decisions/SK-QUAL-002-weekly-cron.md));
  the [`SK-LLM-044`](./SK-LLM-044-entity-identification-projection-directive.md)
  posture applies — one-line revert if the paired BIRD+Spider run regresses.
- **Consequence in code:** `packages/llm/src/prompts.ts` adds one string to
  the `PLAN_DIRECTIVES` array (≈55 input tokens per `plan` call).
  `PLAN_SYSTEM` and per-provider wiring unchanged;
  `packages/llm/test/prompts.test.ts` pins the bullet, including the
  catalog ban and the constant-SELECT mechanism.
- **Alternatives rejected:**
  - **Deterministic metadata intercept before the planner** (detect "list
    tables" goals server-side, answer from `schemaText` without an LLM/exec
    hop). Right long-term shape for a top-N intent, but it inserts an
    unsanctioned step into the `SK-ASK-002` canonical order, needs its own
    NL-intent detection (exactly the planner's job — a regex fork of it
    drifts), and adds a code path where a prompt rule suffices (`CLAUDE.md`
    §P5). Revisit if metadata goals show up hot in demand-signal telemetry.
  - **Allow scoped `information_schema` reads.** The catalog is not
    RLS-protected — an unfiltered read leaks every tenant's schema and table
    names from the shared cluster, and correctness would hinge on the model
    filtering by the right schema name every time (the incident shows it
    guesses). The DDL validator already hard-bans catalog references
    (`SK-ASK-004` posture); loosening the read path inverts layered
    guardrails for zero product gain.
  - **Add or refit an `SK-LLM-026` exemplar.** Same rejection as
    `SK-LLM-043`: the static exemplar block is pending per-lever attribution
    (`SK-LLM-041`); editing it contaminates that measurement. The bullet
    carries an inline example instead.
  - **Post-process catalog queries into constant SELECTs.** A string-rewriting
    post-processor duplicating planner judgement, brittle across dialects and
    query shapes — the standing rejection from `SK-LLM-027`/`-032`/`-034`/
    `-040`/`-043` (§P5).
- **Source:** production trace 2026-08-16 (chat, `schema_mismatch` on
  *"show all tables"*) · Wren AI, *Reducing Hallucinations in Text-to-SQL*
  (schema grounding + validation) · DataFocus, *Deep Dive into Text-to-SQL
  Hallucinations* (schema-based hallucination taxonomy) ·
  [`SK-ASK-016`](../../ask-pipeline/decisions/SK-ASK-016-schema-mismatch-envelope.md)
  (the enforcement backstop this directive front-runs)
