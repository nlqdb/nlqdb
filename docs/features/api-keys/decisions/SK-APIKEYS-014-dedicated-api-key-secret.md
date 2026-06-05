# SK-APIKEYS-014 — Dedicated `API_KEY_SECRET` for key hashing, with `BETTER_AUTH_SECRET` fallback

- **Decision:** API-key hashing uses a dedicated `API_KEY_SECRET` instead of
  reusing `BETTER_AUTH_SECRET` (the open question parked in
  [`SK-APIKEYS-008`](SK-APIKEYS-008-hmac-sha256-storage.md)). A single resolver,
  `apiKeyHmacSecret(env) = env.API_KEY_SECRET || env.BETTER_AUTH_SECRET`, is the
  one place the choice is made; mint, lookup, and the [`SK-MCP-014`](../../mcp-server/decisions/SK-MCP-014-do-revalidation-cache.md)
  status-probe hash all route through it. The secret is **optional**: when
  unset the resolver falls back to `BETTER_AUTH_SECRET`, so dev / test / any
  un-migrated deploy keep SK-APIKEYS-008's exact behaviour. Migration is
  zero-rehash — the operator seeds `API_KEY_SECRET` to the **current**
  `BETTER_AUTH_SECRET` value (`.envrc` + the mirror scripts, never a raw
  `wrangler secret put`), after which the two bindings rotate independently.
- **Core value:** Bullet-proof, Simple, Free
- **Why:** Reusing one HMAC secret for both session signing and key hashing
  couples two unrelated rotation lifecycles: rotating `BETTER_AUTH_SECRET` to
  invalidate sessions would silently invalidate every minted API key, and
  vice-versa. Independent secrets let each rotate on its own incident clock.
  The fallback keeps the change a no-op until the operator opts in — there is
  no flag day and no window where keys stop verifying, satisfying
  [`GLOBAL-033`](../../../decisions/GLOBAL-033-resolution-defaults.md)'s
  security-trade-off default (fail safe, bound the blast radius). Seeding the
  new secret to the old value means the migration re-hashes nothing.
- **Consequence in code:** `apiKeyHmacSecret()` lives in
  `apps/api/src/api-keys.ts` (the only file that hashes keys); call sites in
  `apps/api/src/index.ts` (`POST /v1/keys`, principal resolver, the
  `/v1/oauth/mcp-callback` mint + bearer-hash) and
  `apps/api/src/db-create/build-deps.ts` (`pk_live_` mint) pass its result
  instead of `c.env.BETTER_AUTH_SECRET`. `API_KEY_SECRET?` is added to
  `apps/api/src/env.d.ts`, the `api` subset of `scripts/mirror-secrets-workers.sh`,
  the `scripts/mirror-secrets-gha.sh` mirror list, and `.env.example`. `apps/mcp`
  is unchanged: it never re-hashes — the API computes the hash once at mint and
  passes it through as `props.bearerHash`. A PR that hashes an API key with a
  secret other than `apiKeyHmacSecret(env)` fails review.
- **Alternatives rejected:**
  - **Hard switch to `API_KEY_SECRET` (no fallback)** — a deploy where the
    secret is unset would hash with `undefined`, breaking every key; a deploy
    where it differs from the value keys were minted under breaks them too. The
    fallback removes both flag-day failure modes.
  - **Keep reusing `BETTER_AUTH_SECRET` forever** — leaves the two rotation
    lifecycles coupled, the exact risk SK-APIKEYS-008 flagged for Phase 2.
  - **Generate a fresh, unrelated `API_KEY_SECRET` value at migration** —
    invalidates every already-minted key. Seeding to the current
    `BETTER_AUTH_SECRET` value achieves independence with zero re-hash; a fresh
    value can be rotated in later, deliberately, once that's the intent.

Resolves the "Dedicated `API_KEY_SECRET`" open question in
[`FEATURE.md`](../FEATURE.md) and the Phase-2 note in
[`SK-APIKEYS-008`](SK-APIKEYS-008-hmac-sha256-storage.md). The HMAC-SHA256
algorithm and no-plaintext posture from SK-APIKEYS-008 / SK-APIKEYS-002 are
unchanged — only which secret keys the HMAC.
