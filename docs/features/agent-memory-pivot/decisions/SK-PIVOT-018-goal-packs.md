# SK-PIVOT-018 — Memory ships persona-goal packs on the one canonical schema, never per-vertical schemas

- **Decision:** The wedge grows by **goal packs**: persona-shaped bundles of
  (a) an extraction recipe — a skill prompt telling a coding agent what
  structured knowledge to pull from the user's own sources, (b) seed
  entities/goals, and (c) a golden-query set — all riding the **one
  canonical `agent_memory_v1` schema** (`SK-PIVOT-007`: evolve by version,
  never fork per vertical). Pack #1 is **repo-ops** (the `SK-PIVOT-017`
  docs→memory extraction). Pack #2 is **founder-ops** (founder-directed
  2026-07-27): accounts, credential *metadata* (service, key name, scope,
  date — **never secret values**), external listings/submissions, and the
  human-actions log — seeded from
  [`docs/history/founder-actions-log.md`](../../../history/founder-actions-log.md)
  and answering the builder's replay queries ("what did I have to do by
  hand before first deploy, in order?", "which submissions are pending?",
  "replay this launch for product X").
- **Core value:** Simple, Goal-first, Honest
- **Why:** nlqdb's own history proves the demand: every human action was
  documented *somewhere* (runbook, history docs, decision records, deleted
  queue bullets) yet "rebuild this as a new SaaS in a day" was a git-
  archaeology job — knowledge the founder owned but could not query. Every
  agent-operated company accumulates the same corpus. Packs make the
  memory DB useful on day one for a named persona (the cold-start fix,
  same as SK-PIVOT-017) while keeping the engine surface unchanged; a new
  pack is content + a skill prompt, not a migration.
- **Consequence in code:** A goal pack adds **no** schema, no endpoint and
  no tool — it is seed content written through the public
  `nlqdb_remember`/`nlqdb_query` surface plus a skill file in the
  agent-artifacts family. A reviewer rejects: a pack that introduces
  DDL or a new preset version (that path is `SK-PIVOT-007`'s, with its
  own decision), and any pack that stores secret **values** rather than
  credential metadata. Each pack ships with ≥ 5 golden queries added to
  the `SK-QUAL-023` eval family.
- **Alternatives rejected:** **Per-vertical schema presets**
  (`agent_founder_ops_v1`, …) — schema explosion, contradicts
  `SK-PIVOT-007`, and every one multiplies the validator/eval surface. ·
  **A dedicated "founder ops" SaaS feature** (dashboards, CRUD UI) —
  builds product before the memory wedge has a single external user; a
  pack is content and costs nothing to retire. · **Keep founder actions in
  markdown only** — leaves the flagship "queryable operational memory"
  claim undemonstrated on the corpus nlqdb itself generates daily.
