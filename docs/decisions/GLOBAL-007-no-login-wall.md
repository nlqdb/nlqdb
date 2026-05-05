# GLOBAL-007 — No login wall before first value

- **Decision:** A first-time visitor — on the web, in the CLI, or via an
  MCP-aware client — gets to a working answer before being asked to sign
  in. Anonymous mode is the default first-touch experience.
- **Core value:** Free, Effortless UX, Goal-first
- **Why:** Login walls kill the activation funnel. Our pitch is "a
  database you talk to" — not "create an account, verify email, choose
  a region, then talk." We can ask for the email after the user has
  already had a `wow`.
- **Consequence in code:** `apps/web` boots into a usable demo without
  a session. CLI's first `nlq ask` accepts an anonymous device, which
  later attaches to a Better Auth identity on first sign-in. The API
  has an explicit anonymous-mode rate-limit tier.
- **Alternatives rejected:**
  - Required signup with "free trial" framing — measurably worse for
    activation.
  - Auth-deferred-but-persistent — same effect as a wall, just delayed
    by one screen.
