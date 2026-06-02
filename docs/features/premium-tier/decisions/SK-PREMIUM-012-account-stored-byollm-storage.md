# SK-PREMIUM-012 — Account-stored BYOLLM credential: `api_keys` row schema + resolution

Parent feature: [`premium-tier/FEATURE.md`](../FEATURE.md). Implements the
**Storage** clause of
[`SK-PREMIUM-008`](./SK-PREMIUM-008-byollm.md) (`api_keys` with
`scope = "byollm"`) and the step-2 lane of
[`SK-LLM-016`](../../llm-router/decisions/SK-LLM-016-byollm-dispatch.md); it
pins the schema mechanics that were left implicit, it does not change where
the key lives.

- **Decision:** The account-stored BYOLLM key is a row in `api_keys` with
  `scope = "byollm"` and `key_type = "byollm"`. Because it is a
  *decryptable* secret (the opposite of a one-way bearer hash), the row
  holds the [`GLOBAL-031`](../../../decisions/GLOBAL-031-byo-secret-envelope.md)
  sealed envelope in `key_hash` (a reversible blob in lieu of the HMAC the
  minted `pk_*`/`sk_*` keys use, exactly as
  [`api-keys/FEATURE.md`](../../api-keys/FEATURE.md) §GLOBAL-031 describes),
  plus `provider`, `model`, and a display-only `last_4`. One active row per
  account (partial UNIQUE index on `tenant_id WHERE key_type='byollm'`);
  set replaces atomically (delete-then-insert in one `batch`), clear
  hard-deletes (the instant revocation
  [`GLOBAL-018`](../../../decisions/GLOBAL-018-instant-revocation.md) wants).
  Endpoints `POST/GET/DELETE /v1/keys/byollm` are session-only; `GET`
  returns provider/model/last4, never the key or the blob.
- **Core value:** Bullet-proof, Simple, Effortless UX
- **Why:** `api_keys` is the documented home (SK-PREMIUM-008, GLOBAL-026,
  GLOBAL-031, api-keys/FEATURE.md), but its shape is built for hashed
  bearer tokens (`key_hash NOT NULL UNIQUE`, `last_4 NOT NULL`, a
  `key_type` CHECK). Reusing `key_hash` for the sealed envelope satisfies
  both constraints for free — a fresh random IV per seal makes the blob
  unique, and it is non-null — so no schema column is wasted and no bearer
  invariant is weakened (every read/auth path filters `key_type`, so a
  BYOLLM row never matches a bearer lookup; only `listKeysByTenant` needed
  a `key_type != 'byollm'` guard so a provider key's last-4 never shows up
  in the key list). One row per account matches the single
  `accountCredential` the dispatch selector (`SK-LLM-020`) consumes.
- **Consequence in code:** Migration `0016_api_keys_byollm.sql` extends the
  `key_type` CHECK to include `byollm` (a self-contained table rebuild —
  SQLite can't alter a CHECK in place, and `api_keys` has no FKs/triggers)
  and adds `scope`/`provider`/`model`. `apps/api/src/byollm-account.ts` is
  the only place a stored key is sealed/opened
  (`storeByollmCredential`/`loadByollmCredential`/`byollmStatus`/
  `clearByollmCredential`), reusing the header lane's supported-provider
  set so the two BYOLLM lanes never diverge. `resolveAskRouter`
  (`ask/byollm.ts`) gains an `accountCredential` arg and `/v1/ask` loads +
  decrypts it (signed-in, header-key-absent only), fail-loud on an
  unopenable blob. `Idempotency-Key` (`GLOBAL-005`) is satisfied by
  construction: set replaces in place and its response carries no volatile
  field, clear is terminal. Span attribute
  `llm.byollm_source ∈ {header, account}` distinguishes the lanes.
- **Alternatives rejected:**
  - **A separate `byollm_credentials` table** — cleaner in isolation, but
    contradicts the `api_keys` storage pinned across SK-PREMIUM-008,
    GLOBAL-026, GLOBAL-031, and api-keys/FEATURE.md; reusing `key_hash` for
    the blob avoids the deviation at no real cost.
  - **A synthetic `key_hash` sentinel (e.g. `byollm:<tenant>`)** — collides
    with the full `UNIQUE(key_hash)` on revoke-then-re-add; the sealed
    envelope is already unique and meaningful, so it is the natural value.
  - **Multiple stored keys per account** — SK-PREMIUM-008 allows "one or
    more"; v1 stores one active credential because the selector dispatches
    exactly one. Multi-key (a default + per-provider alternates) is a clean
    later addition (drop the partial-unique predicate, add `is_default`),
    deferred until a surface asks for it.
