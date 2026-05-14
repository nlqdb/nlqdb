# SK-MCP-006 — Revocation surfaces a recoverable `401 key_revoked` with one-line CTA

- **Decision:** A revoked `sk_mcp_*` key returns `401 { code: "key_revoked", message: "…", action: "Sign in again: run `nlq mcp install`." }` on the next call. The MCP server passes that message through to the host LLM as a tool error, so the agent surfaces *"Sign in again: run `nlq mcp install`."* to the user.
- **Core value:** Bullet-proof, Seamless auth, Effortless UX
- **Why:** Revocation that "eventually" propagates is a security hole (`GLOBAL-018`), and a 401 with no next-action message strands the user (`GLOBAL-012`). One sentence + one command is the recovery path; re-running `nlq mcp install` auto-detects the original host and re-mints a key in seconds.
- **Consequence in code:** Auth middleware on the MCP server pulls `code/message/action` from the API error envelope and serializes it into the MCP tool-error shape. Tests cover "revoke from web → next MCP tool call returns the recoverable error".
- **Alternatives rejected:**
  - Drop a generic 401 — host LLMs render it as "tool unavailable" without recovery context.
  - Auto-prompt for re-install from the MCP server — the MCP server can't run a CLI; the recovery has to live where the user can act on it (`nlq mcp install` in the user's shell).
