# SK-APIKEYS-005 — Rotation has 60-day grace + webhook; rotate is the only path to recover from a lost key

- **Decision:** `nlq keys rotate <id>` (or the dashboard equivalent) mints a new key and deprecates the old with a 60-day grace window, emitting a webhook on rotation. There is no "reveal lost key" path; rotation is the recovery mechanism.
- **Core value:** Bullet-proof, Effortless UX, Honest latency
- **Why:** Hard-revoking on rotation would force every deployed system to swap simultaneously, taking a production app down on every rotation. 60 days is long enough to roll a key through a CI/CD pipeline at a reasonable cadence, short enough that long-tail use of the old key gets noticed. The webhook lets customers automate the swap if they prefer (e.g., update a Vercel env var).
- **Consequence in code:** `keys.rotate()` writes the new key, marks the old `expires_at = now + 60d`, and enqueues the rotation webhook (event-pipeline). The dashboard shows both the new and old key's `last_used_at` so the operator can see when the old one stops being used. The CLI verb is `nlq keys rotate <id>`; no `--force-revoke` flag.
- **Alternatives rejected:** Hard-revoke on rotate (no grace) — production outages on every rotation. Rotation copies the secret across deploys automatically — would require us to push to the customer's deploy target, which we do not have credentials for.
- **Source:** docs/architecture.md §4.5

**Status:** rotation has not shipped yet. Hard-revoke ([`SK-APIKEYS-011`](SK-APIKEYS-011-hard-revoke.md)) is the MVP recovery path; the 60-day grace + webhook land in a follow-up slice alongside the events-pipeline rotation event.
