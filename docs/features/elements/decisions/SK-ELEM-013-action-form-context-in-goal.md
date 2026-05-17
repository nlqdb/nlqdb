# SK-ELEM-013 — Form data serialized into the goal text; no new `/v1/ask` shape

- **Decision:** When `<nlq-action>` fires, FormData entries from the associated form are appended to the `goal` attribute as a structured markdown-list suffix:

  ```
  <user goal>

  Form data:
  - <key>: <value>
  - <key>: <value>
  ```

  The composed string is sent as the single `goal` field on `POST /v1/ask`. File inputs (`File` values) are skipped — multipart is out of scope for v0.1. No new field is introduced on `/v1/ask`.
- **Core value:** Simple, Goal-first
- **Why:** `/v1/ask` already accepts `{ goal, dbId, confirm, engine }` and the planner already reads the goal text. Adding a `context: Record<string, string>` field would ripple through MCP tool schemas, the CLI client, the TS SDK, the chat surface, and every existing test fixture — a horizontal change for a vertical feature. Goal-text concatenation works with the existing plan/validate/diff path; the LLM sees the field values *inside* the same prompt that says "add an order" and produces an INSERT. The structured-suffix shape (markdown list with a `Form data:` header) is intentionally explicit so the planner can recognise it as field-name → value mapping rather than free-form text.
- **Consequence in code:** `action-goal.ts` exports `appendFormContext(goal, entries)` — a pure function with full unit-test coverage. Multiple values per name (multi-select inputs) are preserved in order, not deduplicated. The element extracts FormData entries via `new FormData(form).entries()` and filters File values. Server-side guards stay intact: the SQL allowlist rejects anything that isn't a parameterised INSERT/UPDATE/DELETE for write paths, and [`SK-TRUST-001`](../../trust-ux/FEATURE.md)'s render-before-commit gate makes any silent-wrong-write impossible by construction.
- **Alternatives rejected:**
  - Add a `context: Record<string, string>` field to `/v1/ask` — ripples through every surface and every SDK; designed shape doesn't reduce planner ambiguity over the goal-text path.
  - Have the planner read form data through a tool call — over-engineering for a write-counterpart element; adds a second LLM hop per click.
  - Send form data as `application/x-www-form-urlencoded` instead of JSON — breaks every other client's expectation of the `/v1/ask` shape.
