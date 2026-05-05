# GLOBAL-017 — Two endpoints, two CLI verbs, one chat box — one way to do each thing

- **Decision:** The HTTP API exposes two primary endpoints (`/v1/ask`,
  `/v1/run`). The CLI exposes two primary verbs (`nlq ask`, `nlq run`).
  The web app exposes one chat box. There is exactly one way to
  perform each conceptual operation; no aliases, no shadow endpoints.
- **Core value:** Simple, Effortless UX
- **Why:** Surface area is the enemy of learnability. If a user can
  do X "via two endpoints" or "via three commands," they spend energy
  on which one to pick instead of on their goal. A small canonical
  surface keeps docs short and behavior consistent.
- **Consequence in code:** New conceptual operations require a
  decision: extend an existing endpoint/verb, or introduce a third
  one (which requires explicit justification). No aliases. The CLI
  may have helpers (`nlq init`, `nlq login`) — but the *operations
  on data* are the two verbs.
- **Alternatives rejected:**
  - REST resource explosion (`/v1/queries`, `/v1/runs`, `/v1/plans`)
    — bigger surface, more docs, more inconsistency.
  - Multiple aliased CLI verbs — every alias becomes a new way to
    misuse the tool.
