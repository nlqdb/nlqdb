# GLOBAL-028 — `docs/research/automated-icp-validation-plan.md` is the canonical acquisition progress tracker (with its [GLOBAL-029](./GLOBAL-029-acquisition-verification-tracker.md) mirror); all updates are agent-ran

- **Decision:** `docs/research/automated-icp-validation-plan.md` is the single source of truth for client-acquisition progress. It records every acquisition experiment attempted, how it was implemented, the results, and what remains untried. Updates to this file are automated and agent-ran — each PR that implements an acquisition-related feature must update the file's `## Progress Log` section with the implementation date, method, result, and outcome.

- **Core value:** Honest latency, Goal-first, Simple

- **Why:** Client acquisition work spans many experiments with no single canonical home, making it easy for agents and humans to lose track of what was tried, how thoroughly, and whether it worked. A single progress-bar document — updated automatically by the same agent that implements the experiment — creates an auditable record without requiring a separate planning session or manual update discipline. The "agent-ran" requirement prevents the doc from going stale: the implementation PR is also the doc update PR.

- **Consequence in code:** Every PR that implements a section of `docs/research/automated-icp-validation-plan.md` must: (1) update the relevant phase section to mark it as implemented with the date; (2) append a row to `## Progress Log` with `| date | phase | what | result |`; (3) update `## Current status` with the honest KPI snapshot. Agents that read CLAUDE.md §5 before editing acquisition paths will find this file via the `docs/research/automated-icp-validation-plan.md` glob entry in the path map.

- **Alternatives rejected:** Per-experiment files under `docs/research/experiments/` (fragmented; no single dashboard view); embedding progress in individual FEATURE.md files (acquisition isn't a feature — it spans the entire product and needs a unified view).
