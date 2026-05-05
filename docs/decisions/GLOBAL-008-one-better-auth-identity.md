# GLOBAL-008 — One Better Auth identity across all surfaces

- **Decision:** A user has exactly one identity, managed by Better Auth.
  CLI, MCP, web, and SDK all authenticate through that identity (via
  bearer / cookie / device-flow). No surface owns its own auth store.
- **Core value:** Seamless auth, Simple, Bullet-proof
- **Why:** Multi-surface products fragment when each surface owns its
  own identity model — a user signs in to web but the CLI doesn't know,
  or the MCP key isn't tied to the same human. One identity model means
  one revocation surface (`GLOBAL-018`), one rate-limit surface, one
  audit log.
- **Consequence in code:** `packages/auth-internal` is the only thing
  that talks to Better Auth. Every other surface consumes its
  primitives. CLI's device-flow auth and MCP's host-scoped keys both
  resolve to a single `user_id`.
- **Alternatives rejected:**
  - Per-surface identity systems — fragmented audit trails, fragmented
    revocation, no cross-surface session continuity.
  - Bring-your-own-IdP only — punts the problem to operators; bad
    default for the free tier.
