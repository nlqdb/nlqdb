# SK-AUTH-005 — Edge is the only component that sees external credentials; downstream gets a 30 s internal JWT

- **Decision:** External credentials (bearer tokens, `pk_live_…`, `sk_live_…`, `sk_mcp_…`) terminate at the Cloudflare Worker edge. The edge mints a 30-second internal JWT carrying `{user_id, db_scope}` (signed with `INTERNAL_JWT_SECRET`, a Workers-only secret) and passes that JWT to every downstream component (plan cache, LLM router, DB pool).
- **Core value:** Bullet-proof, Simple, Seamless auth
- **Why:** A leaked external key has the blast radius of *that key's scope*; downstream components are protected even if a single secret leaks. Centralising external-credential validation means one place to add a credential type, one place to reason about revocation, one place to instrument. 30 s is short enough to bound replay risk and long enough to outlive any single DB call.
- **Consequence in code:** Downstream components verify the internal JWT, never the external bearer. `packages/auth-internal` exposes `mintInternalJwt({user_id, db_scope}, ttlSec=30)` and `verifyInternalJwt`; both are the only paths to the secret. The edge is the only file that imports Better Auth's session-verifier.
- **Alternatives rejected:** Each component re-validates the bearer — every component owns part of the auth surface; revocation rules duplicate; bugs multiply. Bearer pass-through with no internal token — a leaked DB-pool URL is a leaked external key.
- **Source:** docs/architecture.md §4.4
