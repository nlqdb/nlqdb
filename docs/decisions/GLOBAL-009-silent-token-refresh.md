# GLOBAL-009 — Tokens refresh silently — never surface a 401

- **Decision:** When a token expires, the SDK refreshes it transparently
  before any user-visible failure. A 401 reaching the surface (web
  banner, CLI error, MCP tool error) is a bug, not a normal flow.
- **Core value:** Seamless auth, Effortless UX, Bullet-proof
- **Why:** Auth failures interrupt the user's actual goal. If the
  refresh path is reliable, the user never has to think about tokens.
  A user-visible 401 is a regression — file a bug.
- **Consequence in code:** `packages/sdk` wraps fetch with a
  refresh-on-401 retry that uses the refresh token. CLI and MCP rely on
  this same logic; they don't implement their own refresh. The web
  app's `useSession` hook auto-refreshes ahead of expiry where the
  expiry is observable.
- **Alternatives rejected:**
  - Force re-login on expiry — kills long-running CLI / agent sessions.
  - Aggressive proactive refresh on every call — wastes the auth
    server's budget.
