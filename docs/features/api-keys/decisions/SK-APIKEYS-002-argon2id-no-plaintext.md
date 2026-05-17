# SK-APIKEYS-002 — Hash with Argon2id; store last 4 cleartext for display; no plaintext retrieval

- **Decision:** All API keys are hashed with Argon2id at rest. The last 4 characters are stored in cleartext purely for display (`"sk_live_…a4f7 · 3m ago · Cursor on macbook-air"`). Once issued, there is no path to retrieve the plaintext — losing a key means rotating it.
- **Core value:** Bullet-proof, Free, Open source
- **Why:** A "reveal" path is one XSS / session-hijack / shoulder-surf away from a leak. Argon2id is the OWASP-recommended password-hash for greenfield work; we use it for keys for the same reasons (memory-hardness against GPU attackers). The `last_4` stub gives users enough to recognise *which* key they're looking at without giving anyone enough to use it.
- **Consequence in code:** The `keys` table stores `key_hash` (argon2id) + `last_4`. Verification is constant-time. No endpoint returns plaintext key material after creation. PRs that add a "show key" button or an `unhash_key()` helper are rejected at review.
- **Alternatives rejected:** Reveal-once flag tied to email re-confirmation — adds an "or you can have it back" path that erodes the discipline. Encrypted-at-rest with a master key — still a key-recovery surface; same risk model as plaintext. Bcrypt — older, no memory-hardness; reach for Argon2id per `GLOBAL-016`.
- **Source:** docs/architecture.md §4.1

**Superseded on Workers:** the Argon2id hash function was replaced by HMAC-SHA256 in [`SK-APIKEYS-008`](SK-APIKEYS-008-hmac-sha256-storage.md) because Workers' Web Crypto doesn't surface Argon2id. The rest of this decision (no plaintext retrieval, `last_4`-only display, no "reveal" path) still applies.
