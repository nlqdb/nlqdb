# SK-AUTH-011 — Rotation has a 60-day grace window + webhook; global sign-out leaves `sk_live_` / `pk_live_` alone

- **Decision:** `nlq keys rotate <id>` mints a new key and deprecates the old with a 60-day grace, emitting a webhook on rotation. "Global sign-out" invalidates all sessions, device refresh tokens, and `sk_mcp_…` keys — but **does not** revoke `sk_live_…` or `pk_live_…` (those are production credentials and rotate separately).
- **Core value:** Bullet-proof, Effortless UX, Seamless auth
- **Why:** Hard-revoking a production secret on sign-out from a developer's laptop would take down their deployed app — a foot-gun. The 60-day grace lets ops swap a `sk_live_…` across deployments without a flag day. The webhook lets customers automate the swap if they prefer.
- **Consequence in code:** `keys.rotate()` writes the new key, marks the old as deprecated with `expires_at = now + 60d`, and enqueues the rotation webhook. `globalSignout()` filters by key type — the SQL `WHERE` excludes `sk_live_*` / `pk_live_*`. UI labels global-sign-out as "Sign out everywhere" and explicitly notes that production keys must be rotated separately.
- **Alternatives rejected:** Hard-revoke on rotate (no grace) — production outages on every rotation. No webhook — customers polling the dashboard for rotations.
- **Source:** docs/architecture.md §4.5
