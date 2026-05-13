# SK-AUTH-012 — No plaintext key retrieval — lost means rotate

- **Decision:** API keys (`pk_live_…`, `sk_live_…`, `sk_mcp_…`) are hashed with Argon2id at rest. The last 4 characters are stored cleartext for display ("sk_live_…a4f7"). There is no "reveal" path — losing the key means rotating it.
- **Core value:** Bullet-proof, Free, Open source
- **Why:** A reveal button is a single XSS / session-hijack / shoulder-surf away from a credential leak. Forcing rotation when a key is lost is mildly inconvenient and the right default; making rotation cheap (`SK-AUTH-011`) is the trade-off.
- **Consequence in code:** No endpoint returns plaintext key material after creation. The `keys` table stores `key_hash` + `last_4`. PRs that add a "show key" button are rejected.
- **Alternatives rejected:** Reveal-once flag tied to email re-confirmation — adds an "or you can have it back" path that erodes the discipline. Encrypted-at-rest with a master key — still a key-recovery surface; same risk model as plaintext.
- **Source:** docs/architecture.md §4.1
