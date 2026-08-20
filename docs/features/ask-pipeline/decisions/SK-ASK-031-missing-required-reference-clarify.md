# SK-ASK-031 — A missing-required-reference write failure becomes a `clarify_required` with candidate parent rows

Parent feature: [`ask-pipeline/FEATURE.md`](../FEATURE.md). The second rider on
the [`SK-ASK-026`](./SK-ASK-026-destructive-ambiguous-clarify.md) clarify rail; refines the
[`SK-ASK-029`](./SK-ASK-029-write-constraint-envelope.md) envelope for the
`not_null` / `foreign_key` kinds.

- **Decision:** When exec fails a write on a `not_null` or `foreign_key`
  constraint whose column the DB's own `schema_text` shows referencing a
  parent table, the orchestrator returns `clarify_required`
  (`clarification: "missing_required_reference"`) with one re-sendable option
  per candidate parent row — labels fetched by one bounded
  `SELECT "<label>" FROM "<parent>" LIMIT 6` on the same DB (cap 4 chips,
  label column preferring `name`/`title`/… then any textual non-id column).
  An empty parent table offers a single "add a `<parent>` first" option. Any
  failure on this path (no FK in `schema_text`, no textual column, fetch
  error) falls back to the plain `write_constraint` envelope — a UX upgrade,
  never a new failure mode.
- **Core value:** Effortless UX, Bullet-proof, Goal-first
- **Why:** Fifth production attempt at *"add an idea …"* (2026-08-19), against
  a pre-`SK-HDC-022` schema (`ideas.user_id NOT NULL` → FK `users`): with the
  `SK-LLM-050` directive live, the **free** planner still guessed a scalar
  subquery (`WHERE name = '<goal token>'` → NULL → `23502`) and the **paid**
  planner still invented the all-zero UUID (`23503`). A planner that must fill
  a required column the goal cannot answer has no honest output, so no prompt
  rule closes this — the recovery has to be a question. The `SK-ASK-029` copy
  ("include that field in your request") asked the user to do something a chat
  user can't. Chips of their own rows are the one-click answer.
- **Consequence in code:** `ask/constraint-clarify.ts`
  (`referencedTable` / `labelColumnOf` / `constraintClarify`), called from the
  orchestrator's `WriteConstraintError` catch under a
  `nlqdb.ask.constraint_clarify` span (swallow-to-null). Values shown are the
  user's own parent-table cells returned to their surface — they never enter
  an LLM prompt (`GLOBAL-037`); a chosen value re-enters as goal text exactly
  as if the user had typed it. Surfaces need no changes: `clarify_required`
  options already render as chips (web), an option list (CLI), and elicitation
  choices (MCP).
- **Alternatives rejected:** Harder prompt rules alone — measurably
  insufficient (both lanes violated `SK-LLM-050` on the same day it shipped;
  the directive still gains the scalar-subquery clause as a belt).
  Auto-picking a parent row server-side — recreates the silent-misattribution
  bug `SK-LLM-050` exists to kill. Backfilling old schemas to nullable FKs —
  ALTERing user data structure without consent; the interaction layer owns
  legacy schemas. Feeding seed rows to the planner — `GLOBAL-037` (open
  question in `hosted-db-create`).
