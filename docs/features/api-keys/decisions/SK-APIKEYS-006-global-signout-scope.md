# SK-APIKEYS-006 — Global sign-out clears `sk_mcp_…` but leaves `sk_live_` / `pk_live_` alone

- **Decision:** "Sign out everywhere" invalidates web sessions, CLI device refresh tokens, and every `sk_mcp_…` key — but does **not** revoke `sk_live_…` or `pk_live_…` keys. Production credentials must be rotated explicitly (`SK-APIKEYS-005`).
- **Core value:** Bullet-proof, Effortless UX, Honest latency
- **Why:** A user signing out from a stolen laptop should not also take down their production app. Sessions and MCP keys are tied to *a person on a device*; `sk_live_` / `pk_live_` are tied to *a deployment*. Conflating them turns a security action ("sign out") into a customer-facing outage.
- **Consequence in code:** `globalSignout(user_id)` filters by key type — the SQL `WHERE` excludes `sk_live_*` / `pk_live_*`. UI labels the action as "Sign out everywhere" with explicit copy that production keys must be rotated separately. The dashboard's production-key list links to the rotate flow.
- **Alternatives rejected:** Hard global sign-out (everything goes) — production outages on every "I left my laptop on the train." Leave MCP keys alone too — defeats the point; agents on a lost device keep working.
- **Source:** docs/architecture.md §4.5
