# SK-APIKEYS-003 — `pk_live_` is read-only, origin-pinned, rate-limited; writes need `<nlq-action>` with a signed write-token

- **Decision:** Publishable keys cannot be used to mutate data. The edge rejects any `INSERT/UPDATE/DELETE` (and any `/v1/run` write call) with a `pk_live_` before the plan executes. Origin pinning is enforced at the edge by `Origin` / `Referer` matching against the key's allow-list. Writes from the browser go through `<nlq-action>` with a signed short-lived write-token (Phase 2).
- **Core value:** Bullet-proof, Effortless UX
- **Why:** A browser key is, by definition, in a hostile environment — anyone who views source can copy it. Read-only + origin-pinned + rate-limited makes the worst-case leak an annoyance, not a breach. Routing writes through a signed write-token keeps the threat model crisp: write capability is bound to a session, not to a long-lived browser-visible token.
- **Consequence in code:** `validatePkLive()` rejects any non-`SELECT` plan. `Origin` mismatch returns `403 origin_not_allowed`. `<nlq-action>` requires a write-token issued by the session-bound `/v1/write-token` endpoint. Writes attempted via `<nlq-data>` fail at the edge before reaching the planner.
- **Alternatives rejected:** Allow writes if `pk_live_` carries a `write` claim — cancels the read-only guarantee. Accept a CSRF token from the page — doesn't help in non-cookie contexts (static HTML on a CDN).
- **Source:** docs/architecture.md §4.1, §4.4
