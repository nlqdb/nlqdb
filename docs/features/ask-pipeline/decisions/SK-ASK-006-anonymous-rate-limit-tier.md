# SK-ASK-006 — Anonymous-mode is a separate rate-limit tier — not "free with a lower limit"

Parent feature: [`ask-pipeline/FEATURE.md`](../FEATURE.md).

- **Decision:** The API has an explicit anonymous-mode rate-limit tier, distinct from authed-free and paid tiers (`GLOBAL-007`). Anonymous traffic shares its tier across all anonymous device-tokens by IP + device-token; signing in promotes the device's outstanding budget to the authed tier (no fresh quota grant).
- **Core value:** Free, Bullet-proof, Goal-first
- **Why:** Without a separate tier, an anonymous abuse spike (per-IP create-floods) eats authed-user budget. With it, abuse is contained in its own bucket while the authed surface stays fast. Promoting on sign-in (no fresh grant) prevents farming free quota by signing in repeatedly under fresh emails.
- **Consequence in code:** Rate-limit middleware reads `(tier, identifier)` where `identifier` is `device_token` for anonymous and `user_id` for authed. `attachIdentity()` carries forward the consumed budget. PoW challenges fire on signup if the bucket spikes (`docs/architecture.md §3.6.8`).
- **Alternatives rejected:** Single global free tier — every anonymous abuse spike degrades authed users. Allow anonymous to refresh budget by attaching a new identity — quota-farming.
