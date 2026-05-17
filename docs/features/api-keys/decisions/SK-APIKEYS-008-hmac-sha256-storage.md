# SK-APIKEYS-008 — HMAC-SHA256 replaces Argon2id for all key storage on the Workers runtime

- **Decision:** API keys (all types: `pk_live_`, `sk_live_`, `sk_mcp_…`) are stored as `HMAC-SHA256(BETTER_AUTH_SECRET, plaintext_key)` (hex-encoded) in D1, not as Argon2id digests. Phase 2 migration to a dedicated `API_KEY_SECRET` secret is tracked as an open question in [`FEATURE.md`](../FEATURE.md). `sk_live_` and `sk_mcp_…` keys ship in Phase 2 (CLI install, MCP onboarding); this decision lands with `pk_live_` in Phase 1.
- **Core value:** Bullet-proof, Simple, Free
- **Why:** Argon2id is not available in the Cloudflare Workers runtime — Web Crypto only surfaces SHA, HMAC, AES, PBKDF2, HKDF, RSA, and ECDH. For random 128-bit secrets (which all three key types are), HMAC-SHA256 gives equivalent protection: preimage cost is 2^128 SHA-256 ops regardless of memory-hardness. Argon2id's memory-hardening only adds value for *low-entropy* inputs (user-chosen passwords). Reusing `BETTER_AUTH_SECRET` avoids a Phase 1 secret-add; different HMAC messages keep key hashes distinct from the anon-stash cookie HMACs.
- **Consequence in code:** `apps/api/src/api-keys.ts` is the only file that hashes keys. `api_keys` stores `key_hash TEXT UNIQUE` (HMAC hex) + `last_4 TEXT`. Lookup is constant-time at the HMAC layer (identical-length hex). PRs that store plaintext or use a non-HMAC-SHA256 hash fail review.
- **Alternatives rejected:**
  - Argon2id WASM — unavailable as a first-party Workers primitive; smallest WASM builds add ~200 KB, blocking `GLOBAL-013`'s 3 MiB total budget.
  - PBKDF2 — single-threaded, still insufficient for low-entropy inputs at practical iterations; irrelevant for random keys.
  - Plaintext storage — D1 at rest is Cloudflare-encrypted but operator-readable.
  - SHA-256 without HMAC — no keyed component means a DB dump alone is enough; HMAC binds to the server secret.

Supersedes the Argon2id hash in [`SK-APIKEYS-002`](SK-APIKEYS-002-argon2id-no-plaintext.md). The "no plaintext retrieval" + `last_4`-only display posture of that decision is unchanged.
