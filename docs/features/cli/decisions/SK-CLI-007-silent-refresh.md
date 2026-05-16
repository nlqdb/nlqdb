# SK-CLI-007 — Silent refresh: 401 → refresh → retry once; refresh fail → re-run device flow in place

- **Decision:** On any 401 response, the CLI's HTTP layer (via `packages/sdk`) silently calls `POST /v1/auth/refresh`, retries the original call once, and proceeds. If the refresh itself fails (refresh token revoked or expired), the CLI re-runs the device flow in the same shell, then resumes the original command. The user **never** sees a bare 401 or "session expired" message.
- **Core value:** Seamless auth, Effortless UX, Bullet-proof
- **Why:** A user-visible 401 is a regression — the refresh path is supposed to be reliable enough that auth-expiry never breaks a long-running CLI session. This is the CLI manifestation of `GLOBAL-009`. Re-running device flow in place (rather than failing the command) preserves the user's intent: they wanted an answer, not to be told their session expired.
- **Consequence in code:** This logic lives once in `packages/sdk` (per `GLOBAL-001`); `cli/` consumes it without re-implementing. The `Once` semantics matter — recursive 401-on-refresh-retry is a bug, not a feature. The re-auth path prints a single `→ Re-authenticating…` line and resumes. Tests cover (a) 401-then-200-after-refresh, (b) 401-on-refresh-then-device-flow.
- **Alternatives rejected:**
  - Force re-login on expiry — kills long-running CLI / agent sessions.
  - Aggressive proactive refresh on every call — wastes the auth server's budget.
