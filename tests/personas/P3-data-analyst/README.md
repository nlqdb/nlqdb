# P3 — The Data-Curious Analyst / PM / Ops

> Canonical persona definition: [`docs/research/personas.md`](../../../docs/research/personas.md#p3--the-data-curious-analyst--pm--ops)

**Real-life journey (a PM or analyst who can write SQL if forced but resents it):**

1. Opens the web app, hits Ctrl+G to reveal the chat input.
2. Types a vague question: `"anything interesting in here?"`. Web app surfaces a clarification chip + a sample row, not a dead-end error.
3. Types a count: `"how many users are there?"`. Reply has both the number and a one-sentence summary.
4. Types a missing-table question: `"show me all the orders"`. Reply names the missing table (or available `users` table) — not "Something went wrong".
5. Opens the trace pane (`Ctrl+/`). Sees the SQL — the analyst is the audit trail.

This persona is the existing [`tests/opencheck/tests.yaml`](../../opencheck/tests.yaml) coverage target — covered in full by the original 14-case suite that proved the harness. This README is the persona-shaped index over those cases so reviewers can trace persona → existing case.

## Surface coverage matrix

| Step | Surface | Runner | File |
|------|---------|--------|------|
| 1 — Ctrl+G unhides the hero input | Web | opencheck | [`tests/opencheck/tests.yaml`](../../opencheck/tests.yaml) (case `#hero-or-cmdg`) |
| 2 — vague prompt → clarification, not dead-end | Web | opencheck | [`tests/opencheck/tests.yaml`](../../opencheck/tests.yaml) (case `#vague-question-handled`) |
| 3 — count returns a number + a summary | Web | opencheck | [`tests/opencheck/tests.yaml`](../../opencheck/tests.yaml) (case `#count-summarizes`) |
| 4 — missing-table prompt clarifies (GLOBAL-012) | Web | opencheck | [`tests/opencheck/tests.yaml`](../../opencheck/tests.yaml) (case `#schema-mismatch-clarifies`) |
| 5 — trace pane shows the SQL (GLOBAL-011 + GLOBAL-023) | Web | opencheck | [`tests/opencheck/tests.yaml`](../../opencheck/tests.yaml) (case `#trace-shows-sql`) |
| 5 — Cmd+K palette discoverable for non-keyboard-power-users | Web | opencheck | [`tests/opencheck/tests.yaml`](../../opencheck/tests.yaml) (case `#cmdk-palette-discoverable`) |

## GLOBALs this journey verifies end-to-end

- **GLOBAL-011** (honest latency / live trace) — trace pane shows the SQL as it runs.
- **GLOBAL-012** (one-sentence errors) — vague + missing-table replies surface a next-action, never a bare failure.
- **GLOBAL-023** (trust-UX baseline) — visible SQL on every reply.

## How to run just this persona

```bash
gh workflow run e2e.yml -f surface=web
```
