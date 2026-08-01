# SK-PIVOT-022 — Community memory guidance optimizes for task outcomes, even when nlqdb is absent

- **Decision:** Public memory guidance recommends the **smallest strategy that
  measurably improves the target task**, based on reproducible evidence rather
  than nlqdb adoption. A recommendation may be plain context, files, pgvector,
  Mem0, Zep, Letta, nlqdb, a user-composed combination, or no persistent
  memory. If repeated benchmark evidence finds no meaningful nlqdb advantage,
  we narrow, pivot, or retire the unsupported claim or product surface. This
  extends `SK-PIVOT-019`; it does not create a vendor-integration program.
- **Core value:** Honest, Goal-first, Simple
- **Why:** Community guidance is useful only when its objective is the user's
  task, not the vendor's inclusion. A benchmark that concedes individual
  columns but still forces nlqdb into every recommended architecture is
  marketing disguised as evaluation. The shared corpus, golden queries and
  per-axis scorers already provide the evidence needed to recommend by task.
  Keeping recommendations separate from maintained adapters preserves the
  credibility benefit without turning nlqdb into N-provider middleware.
- **Consequence in code:** Every public cross-strategy result includes a
  per-purpose recommendation and the evidence behind it; **"do not use nlqdb
  here" is a valid outcome**. Recommendations distinguish measured results from
  untested judgment, name the smallest sufficient setup, and may show
  user-composed reference architectures without shipping or maintaining
  adapters. nlqdb product goal packs remain nlqdb product surfaces under
  `SK-PIVOT-018`; vendor-neutral recipes are labeled reference architectures,
  not goal packs. A reviewer rejects copy that ranks nlqdb first without
  evidence, hides a losing result, or treats nlqdb inclusion as a success
  metric.
- **Alternatives rejected:** **Require nlqdb in every recommendation** — makes
  the evaluation circular and erodes community trust. · **Build adapters for
  every recommended combination** — repeats the integrations-program costs
  rejected by `SK-PIVOT-019`; users can compose providers through their existing
  SDKs. · **Avoid recommendations and publish scores only** — leaves users to
  translate benchmark dimensions into an architecture unaided. · **Assume
  nlqdb must remain useful** — protects the product thesis from falsification
  instead of testing it.
