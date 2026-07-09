# GLOBAL-031 — One at-rest envelope for every bring-your-own secret

- **Decision:** Every bring-your-own secret nlqdb stores — BYOLLM
  provider keys (`api_keys.scope = "byollm"`, `SK-PREMIUM-008`) and BYO
  Postgres / ClickHouse connection URLs (the per-db D1 blob,
  `architecture.md §3.6.7`, `SK-DB-011`, `SK-MULTIENG-005`) — is sealed
  by the single shared AES-256-GCM envelope in
  `apps/api/src/secret-envelope.ts` behind one Workers-held KEK
  (`BYO_SECRET_KEK`). No feature rolls its own at-rest scheme. Each seal
  binds an owner `context` as GCM additional-authenticated-data
  (`byollm:<userId>`, `dbconn:<dbId>`) so a blob cannot be replayed onto
  another owner's row, uses a fresh random 96-bit IV per seal, and never
  logs the KEK or the plaintext. Absent KEK fails loud as an
  operator-config 503 (`GLOBAL-012`), never a silent skip.
- **Core value:** Bullet-proof, Free, Effortless UX
- **Why:** BYO secrets are the highest-value data we hold — a leaked
  provider key or production DSN is a direct loss to the user. Two
  workstreams (BYOLLM and BYO Postgres/ClickHouse) need the identical
  primitive; letting each invent its own envelope is how nonce-reuse,
  missing AAD binding, or an unauthenticated mode slips into one of them.
  One audited module, one KEK, one format means one place to review and
  rotate. Per-user Workers Secrets don't scale (the secret count is
  capped); one KEK plus a per-row blob does.
- **Consequence in code:** `sealSecret` / `openSecret` /
  `kekFromEnv` in `apps/api/src/secret-envelope.ts` are the only at-rest
  encrypt/decrypt path for BYO secrets; the AES key is HKDF-SHA256–derived
  from the KEK so the operator sets any high-entropy string. The envelope
  is a versioned compact string (`nbe1.<base64url(iv ‖ ciphertext+tag)>`)
  for a D1 TEXT column. New BYO-secret callers import this module rather
  than touching `crypto.subtle` directly.
- **KEK rotation — Decided (web-checked against GCP KMS / AWS KMS
  envelope-rotation guidance, 2026-07-09):** the KEK version travels *in*
  the envelope string, not a D1 column. A rotation bumps the format prefix
  to `nbe2.<v>.<payload>` where `<v>` is the KEK version; existing `nbe1.`
  blobs read as version `1`. Version-in-blob (like the IV) means no schema
  migration and stale rows stay prefix-filterable
  (`WHERE …_blob LIKE 'nbe2.1.%'`) without decrypting — a `key_version`
  column would only earn its keep if the sweep had to find stale rows
  blind, which it doesn't. During a rotation the env carries the active
  KEK (`BYO_SECRET_KEK` + `BYO_SECRET_KEK_VERSION`) and the retiring one
  (`BYO_SECRET_KEK_PREV` + `_PREV_VERSION`); `openSecret` selects by the
  envelope's version tag (fail-loud per `GLOBAL-012` if it matches
  neither), `sealSecret` always uses the active version, and HKDF `info`
  folds in the KEK version so a bump can't cross-derive. Re-wrap is
  decrypt-then-reseal (no stored DEK — the content key is HKDF-derived, so
  the tiny secret itself is re-sealed): writes migrate lazily under the
  active version, one operator sweep re-seals rows still on the old prefix,
  then the prev KEK is dropped. Implementation ships when a rotation is
  first scheduled (`GLOBAL-033` — not built on spec); the sweep + setting
  the new KEK need prod key material (runbook + `blocked-by-human.md`).
- **Alternatives rejected:**
  - **A scheme per feature** — divergence risk on the most sensitive
    data; doubles the crypto-review surface.
  - **Per-user Workers Secrets** — the Workers Secret count is capped;
    doesn't scale to one secret per user/db.
  - **No AAD binding** — leaves a confused-deputy / blob-swap gap where a
    row's ciphertext could be lifted onto another owner.
  - **Storing plaintext + relying on D1 at-rest encryption alone** — a
    single read of the database row would expose every BYO secret.
