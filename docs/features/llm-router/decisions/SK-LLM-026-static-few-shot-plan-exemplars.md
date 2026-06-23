# SK-LLM-026 — Static few-shot exemplars in the planner prompt (DAIL-SQL)

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md).

- **Decision:** `PLAN_SYSTEM` (`packages/llm/src/prompts.ts`) is composed
  from two parts: the existing `SK-LLM-018` directives (`PLAN_DIRECTIVES`)
  **plus** a new exported `PLAN_FEW_SHOT` block of **three static**
  Question→strict-JSON exemplars. Each exemplar uses the exact
  `Dialect: / Schema: / Goal:` shape `buildPlanUser` already emits, and
  its answer is built with `JSON.stringify({ sql })` so the demonstrated
  output is guaranteed-valid strict JSON with no trailing semicolon — the
  format the model must echo. Between them the three exemplars demonstrate
  all four `SK-LLM-018` behaviours: (1) schema-literal identifiers +
  verbatim mixed-case/quoted casing + a two-table JOIN (exemplar 1);
  (2) applying a goal's `Evidence:` formula end-to-end (exemplar 2);
  (3) **dialect-strict** output for the named dialect — exemplar 3's
  `Dialect:` line is `postgres` while 1–2 are `sqlite`, so the model sees
  the dialect line as a variable to honour, and the extremum idiom it shows
  (`WHERE col IS NOT NULL … ORDER BY col ASC LIMIT 1`) is the
  `LIMIT`-not-`TOP` form the directive demands for postgres and carries the
  `SK-LLM-029` NULL guard; (4) the strict-JSON,
  no-trailing-semicolon shape, carried by every answer. The set is
  **static** — not similarity-retrieved — and every exemplar SQL is valid
  on both SQLite and Postgres (the two dialects the one shared prompt
  serves per `PlanRequest.dialect`), so the `postgres` label adds the
  dialect-variation signal without a maintenance fork.
- **Core value:** Engine quality, Free
- **Why:** `PLAN_SYSTEM` was zero-shot; the planner is the dominant term
  in the 0.318 free-chain BIRD-dev baseline, below the
  [`GLOBAL-025`](../../../decisions/GLOBAL-025-north-star.md) engine-quality
  floor. Few-shot in-context exemplars are
  the single biggest *prompt-only* lever in the text-to-SQL literature:
  DAIL-SQL ([arXiv:2308.15363](https://arxiv.org/abs/2308.15363) / VLDB
  vol. 17 p. 1132) establishes that exemplar **format and organization**
  (Question→SQL pairs) raise execution accuracy on their own, with the
  optimal count in the 3–5 range and diminishing returns past it (2024–25
  surveys — Open-SQL [arXiv:2405.06674](https://arxiv.org/html/2405.06674v1),
  OpenSearch-SQL [arXiv:2502.14913](https://arxiv.org/pdf/2502.14913),
  Solid-SQL [arXiv:2412.12522](https://arxiv.org/pdf/2412.12522)). The
  gain is largest on the small / open models the strict-$0 chain runs.
  Demonstrating the four `SK-LLM-018` behaviours (instead of only
  *stating* them) is the cheapest way to convert mismatches into matches
  on **both** BIRD and Spider, since the exemplars are dataset-agnostic.
- **Consequence in code:** `packages/llm/src/prompts.ts` splits the
  planner prompt into `PLAN_DIRECTIVES` (private) + `PLAN_FEW_SHOT`
  (exported) and recomposes `PLAN_SYSTEM` as the directives, a blank
  line, then the few-shot block; every provider keeps importing the
  single `PLAN_SYSTEM` constant, so
  there is **no per-provider plumbing** and no change to `_chat-provider`
  or any wire format. `packages/llm/test/prompts.test.ts` pins the
  contract: exactly three exemplars, every answer line parses as strict
  JSON `{sql}` with no trailing semicolon, the verbatim-casing / Evidence
  / NULL-safe-extremum demonstrations are present, and directives precede examples.
  The few-shot block is a **fixed prefix**, so it is cache-friendly under
  [`SK-LLM-009`](./SK-LLM-009-prompt-caching.md) on providers that support
  prompt caching. **Cost / capacity tradeoff (honest):** the exemplars
  add ≈250–350 input tokens to every `plan` call. The free-tier binding
  limit is per-minute token quota, so under burst load this can
  marginally raise the chain-exhaustion `no_sql` rate the
  [engine-quality source of truth](../../../progress/quality-score-source-of-truth.md)
  §2 tracks. The set is kept to the literature-optimal **floor of 3** to
  bound that cost; the combined effect (EX lift vs token-budget pressure)
  is measured on the next eval run after this lands — it is not
  measured on a PR (`SK-QUAL-002`).
- **Alternatives rejected:**
  - **Similarity-retrieved exemplars (full DAIL-SQL).** The larger half
    of DAIL-SQL's gain, but it needs an exemplar pool + an embedding /
    masked-question similarity index — a new dependency and a retrieval
    code path on the hot plan call (against `CLAUDE.md` §P5). Static
    exemplars capture the documented format/organization gain at
    zero-dep; retrieval stays a separate, later lever in the §4 backlog.
  - **More exemplars (5–8).** Diminishing returns past ≈3–5 in the cited
    surveys, and every extra exemplar spends more of the scarce
    per-minute token quota — net-negative against the `no_sql`
    capacity risk. Start at the floor; raise only if a cron measures
    headroom.
  - **Per-request exemplars in `buildPlanUser`.** Exemplars are task
    *demonstration*, not request data; putting them in the system prompt
    keeps them out of the cache-busting per-request suffix and out of the
    retry-framing path.
  - **Dialect-specific exemplar sets (one for SQLite, one for Postgres).**
    Doubles the surface and the maintenance for no measured gain. Instead,
    the three chosen statements are valid in both dialects, and labelling
    exemplar 3 `postgres` (1–2 `sqlite`) carries the dialect-variation
    signal — the model sees the `Dialect:` line vary — from a single
    portable set.
