# SK-ERR-003 — Surfaces render wire copy; overrides are sparse and type-checked

Parent feature: [`error-taxonomy/FEATURE.md`](../FEATURE.md).

- **Decision:** Every surface's default is to render the wire's `message` +
  `action`. A surface may override **per code** only where its next action is
  genuinely different in kind — an MCP tool to re-call, a CLI command to run.
  Override tables pass through `assertOverrides`, so their keys are type-checked
  ⊆ the registry's codes. Anything not overridden falls through to wire copy, so
  a new error code needs **zero** surface edits and can never regress to
  "Something went wrong".
- **Core value:** Effortless UX, Simple
- **Why:** The four tables were four copies of one judgment, and the drift was
  already user-visible: the CLI and the web each carried a full duplicate of the
  SQL-allowlist reject reasons, worded differently, and the MCP table covered
  codes the web's didn't. The remaining differences are real, though, and worth
  keeping typed rather than flattened: an MCP host needs *"Re-call
  nlqdb_remember without `db`"*, not *"pick a different database"*, and a
  terminal user needs *"run `nlq byollm set`"*, not *"open Settings"*. Making the
  override keys a checked subset means a typo or a retired code fails the build
  instead of silently never firing — the failure mode the old tables had.
- **Consequence in code:** the migration is majority deletion —
  `packages/mcp/src/tools.ts` 894 → 705 lines (`ERROR_COPY`,
  `BRANCH_HANDLED_CODES` and the two body-readers replaced by a pass-through plus
  9 tool-name overrides); `apps/web` `error-message.ts` 95 → 36 (the per-code
  switch and `SQL_REJECT_COPY` gone, keeping only the two client-owned
  sentinels the server never sees, `aborted` and `network_error`);
  `packages/elements` `render.ts` + `action-render.ts` lose their bespoke
  rate-limit copy; the Go CLI loses `sqlRejectedMessage` (26 lines) and renders
  wire copy lower-cased into its own voice via `printWireError`.
  `KNOWN_ERROR_CODES` in the MCP is now simply the registry's list, so its
  anti-regression sweep covers every code automatically.
- **Alternatives rejected:**
  - **No overrides at all.** Would force one voice on a terminal, a browser chip
    and an agent's tool loop; the MCP's tool-name actions are the whole reason a
    host can recover without a human.
  - **Overrides keyed by free-form string.** The exact drift this replaces — an
    entry for a code that no longer exists looks fine forever.
