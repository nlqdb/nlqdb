# SK-APIKEYS-013 — Mint idempotency via redact-on-replay

- **Decision:** `POST /v1/keys` (and the other mint-like endpoints) accept
  `Idempotency-Key` like every mutation (`GLOBAL-005`), but the
  idempotency middleware is told to **redact the secret on replay**. The
  dedupe record is still written — so a network-blip retry cannot mint a
  *second* key — but the stored/replayed response body carries only the
  non-secret metadata (`id`, `last_4`, `label`, `created_at`) plus
  `plaintext_unavailable: true`. The plaintext is returned exactly once,
  on the original response, never from the dedupe cache.
- **Core value:** Bullet-proof, Effortless UX
- **Why:** Two rules collide head-on: `GLOBAL-005` wants every mutation
  idempotent, and `SK-APIKEYS-002` says once a key is issued there is no
  path to retrieve the plaintext. Caching the mint response body to
  satisfy `GLOBAL-005` would persist the plaintext in the dedupe store —
  breaking `SK-APIKEYS-002`. Exempting `/v1/keys` from `GLOBAL-005`
  instead would let a retried `POST` after a dropped connection mint two
  keys, which is exactly the double-execution `Idempotency-Key` exists to
  prevent. Redact-on-replay keeps both rules: dedupe protects against the
  double-mint, redaction protects the secret. Resolved per `GLOBAL-033`
  (surface-parity / security → honour both controls, don't carve one out).
- **Consequence in code:** The idempotency middleware (`SK-IDEMP-*`,
  still unbuilt) gains a per-route `redactReplay?: (body) => body` hook;
  `/v1/keys` registers one that strips the plaintext field. The dedupe
  row stores the redacted body, so even a direct store read never yields
  the secret. Pairs with `SK-IDEMP-009` (a key reused with a different
  body still `409`s).
- **Alternatives rejected:**
  - **Exempt `/v1/keys` from `GLOBAL-005`** — a retry after a network
    blip mints a duplicate key; defeats the point of idempotency on the
    one endpoint where double-execution is most expensive.
  - **Cache the full body (including plaintext)** — violates
    `SK-APIKEYS-002`; the plaintext would live in the dedupe store for
    the whole `SK-IDEMP-008` window.
  - **Return the plaintext again on replay** — same violation, and
    encourages clients to treat replay as a retrieval path.
