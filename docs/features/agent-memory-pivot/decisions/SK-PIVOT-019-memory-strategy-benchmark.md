# SK-PIVOT-019 — nlqdb publishes a reproducible cross-strategy memory benchmark; honest per-purpose winners, never an integrations program

- **Decision:** nlqdb ships a public, reproducible **memory-strategy
  benchmark** (founder-decided 2026-07-27): the same real corpus (the
  `SK-PIVOT-017` ops memories) and the same golden queries, grouped by the
  `SK-QUAL-023` purpose axes (recall, temporal, entity, analytical), run
  against competing memory strategies and published with **per-purpose
  winners even where nlqdb loses**. v1 strategy set: nlqdb, DIY
  Postgres+pgvector, plain-context (no store); hosted competitors (Mem0,
  Zep, …) are added **one per run** (the `SK-PIVOT-002` cadence) as their
  ToS allows. Rendered on the `/agents` surface from a typed data
  structure (the `SK-PIVOT-001` pattern); the harness lives in `tools/`
  beside the eval harness and is public. Build **starts when the
  `SK-PIVOT-017` corpus + golden queries exist** — a sequenced
  prerequisite, not an open decision — and never delays the `SK-PIVOT-016`
  gate or the launch.
- **Core value:** Honest, Goal-first, Free
- **Why:** Benchmarks are the most-cited artifact class in developer
  tooling — answer engines quote them (row #11 sits at 0 citations), and
  they are exactly what the stage-0 searcher and their coding agent
  compare on. A vendor benchmark earns links only by conceding columns:
  admitting "for pure fuzzy recall, top-k wins — here's the number" is
  what makes the analytical column believable (the R-02 build-vs-buy
  lesson). The purpose taxonomy and the corpus already exist, so the
  marginal cost is a harness and runs. Deciding the shape now also kills
  the drift risk early: "combine with other providers" must never become
  memory middleware.
- **Consequence in code:** Harness + corpus + raw results are public;
  provider **defaults**, pinned versions and run dates printed on the
  page. Free tiers only (`docs/cost-ladder.md`). Before any named number
  is published, that provider's ToS is checked for a benchmark clause
  (P2) and the check recorded; a provider that forbids publication is
  listed as **"not benchmarkable under its ToS"** — never renamed or
  anonymised. Hosted-competitor accounts are founder actions → queue
  bullets. A reviewer rejects: winners-only edits, un-pinned provider
  configs, and **any adapter/integration to a competing memory store**
  riding this work — the benchmark is content + harness, retired at zero
  cost.
- **Alternatives rejected:** **Integrations program** (adapters so agents
  "combine" providers) — permanent N-provider maintenance surface, blurs
  the wedge into middleware, and makes the differentiation claim
  unfalsifiable. · **Private/internal benchmark** — unverifiable numbers
  are benchmarketing; the public harness *is* the credibility. ·
  **Winners-only publication** — destroys the trust that is this
  artifact's entire value. · **Parking the idea as an open question until
  the corpus exists** — the shape was decidable today; only the input
  data is pending (founder-rejected 2026-07-27: decide now, sequence the
  build).
