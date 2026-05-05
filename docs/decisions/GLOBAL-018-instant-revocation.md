# GLOBAL-018 — Revocation is instant and visible across devices

- **Decision:** Revoking a token, API key, or session takes effect on
  the next request — no caching window, no propagation delay. The
  user sees, in every active surface, that the credential is gone.
- **Core value:** Bullet-proof, Seamless auth, Effortless UX
- **Why:** Revocation that "eventually" propagates is a security
  hole. A user pressing "sign out everywhere" or rotating an API key
  expects immediate effect — across web, CLI, MCP, and any agent
  with the credential. Anything less and the feature has lied.
- **Consequence in code:** Token/key validation hits the auth
  service on every request (or against a sub-second-stale cache);
  revoked credentials return a clear, recoverable error
  (`GLOBAL-012`). Surfaces show a banner / message naming the
  revocation. Tests cover "revoke from web → CLI 401 on next call."
- **Alternatives rejected:**
  - Long-lived JWTs with no revocation list — revocation becomes a
    lie.
  - Soft revocation (mark, sweep later) — same problem, slower.
