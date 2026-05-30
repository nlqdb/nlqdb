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
  than touching `crypto.subtle` directly. KEK rotation (re-seal under a
  new KEK version) remains an open question tracked in the affected
  features.
- **Alternatives rejected:**
  - **A scheme per feature** — divergence risk on the most sensitive
    data; doubles the crypto-review surface.
  - **Per-user Workers Secrets** — the Workers Secret count is capped;
    doesn't scale to one secret per user/db.
  - **No AAD binding** — leaves a confused-deputy / blob-swap gap where a
    row's ciphertext could be lifted onto another owner.
  - **Storing plaintext + relying on D1 at-rest encryption alone** — a
    single read of the database row would expose every BYO secret.
