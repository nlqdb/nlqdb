# Manual test — BYO Postgres connect → introspect → ask (non-Neon)

Verifies `SK-DBCONN-002`: `POST /v1/db/connect` for a **non-Neon** BYO Postgres
(Supabase / RDS / self-hosted) succeeds instead of returning
`introspection_failed`. No live Postgres exists in the unit env, so this is a
one-time manual walk against a real read-only database. Run it once after any
change to `packages/db/src/postgres-byo.ts` or the two BYO-Postgres call sites
(`apps/api/src/db-connect/build-deps.ts`, `apps/api/src/ask/build-deps.ts`).

## Why a manual test

The postgres.js driver opens a real Postgres TCP socket over the Workers
`connect()` API; that transport only exists in the Workers runtime (`workerd`),
not the Node/Vitest unit env. The unit tests inject a postgres.js-shaped stub
(`packages/db/test/postgres-byo.test.ts`), so this walk is the only check that
the **real** socket + TLS handshake works end to end against a managed host.

## Supabase specifics (read before picking a connection URL)

- **Use the Supavisor pooler host, not the direct host.** The direct host
  `db.<ref>.supabase.co` is **IPv6-only**; use the pooler
  `aws-0-<region>.pooler.supabase.com`, which has an IPv4 address.
- **Ports:** `6543` = transaction mode, `5432` = session mode. Either works
  here. `SK-DBCONN-002` sets `prepare: false`, which is what the
  **transaction-mode** pooler requires (it rejects server-side prepared
  statements), so port `6543` is the stricter, preferred target for the walk.
- **Username carries the project ref on the pooler:**
  `postgres.<project-ref>`. The pooler URL Supabase shows in the dashboard
  (Project → Connect → "Transaction pooler") already has the right shape:

  ```
  postgres://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
  ```

- **Read-only:** create a role with `SELECT`-only grants (or use a read replica)
  so the walk cannot mutate anything.

## Steps

Against a deployed API (canary or a `wrangler dev` with `BYO_SECRET_KEK` set and
`nodejs_compat` on — both `wrangler.toml` and `wrangler.canary.toml` already
set the flag). Sign in first; connect is account-only (`connect_requires_account`).

1. **Connect** — expect `201` with a `schema_text` preview + a `pk_live_` key:

   ```bash
   curl -sS https://<api-host>/v1/db/connect \
     -H "authorization: Bearer <session-or-sk-key>" \
     -H "content-type: application/json" \
     -H "idempotency-key: $(uuidgen)" \
     -d '{"engine":"postgres","connection_url":"postgres://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:6543/postgres","name":"supa-test"}'
   ```

   - Pass: `201`, body has `dbId`, `schemaPreview` listing your real tables as
     `CREATE TABLE` cards, and `pkLive`.
   - Fail (the bug this fixes): `502 introspection_failed`. If you still see it,
     confirm the host is the **pooler** (IPv4) — a direct IPv6-only host can be
     unreachable from the runtime.

2. **Ask** — question the connected DB in English:

   ```bash
   curl -sS https://<api-host>/v1/ask \
     -H "authorization: Bearer <pkLive-from-step-1>" \
     -H "content-type: application/json" \
     -d '{"dbId":"<dbId>","goal":"how many rows are in <one-of-your-tables>?"}'
   ```

   - Pass: `200` with `rows` + a `trace.sql` that ran against your Postgres.
   - The `db.query` span shows `db.system=postgresql`; the connect step emits
     `db.introspect`.

3. **Egress guard (negative)** — a private/loopback host must be rejected at
   connect (`400`), never dialled:

   ```bash
   curl -sS -o /dev/null -w '%{http_code}\n' https://<api-host>/v1/db/connect \
     -H "authorization: Bearer <session-key>" -H "content-type: application/json" \
     -d '{"engine":"postgres","connection_url":"postgres://u:p@127.0.0.1:5432/x"}'
   # expect 400
   ```

4. **Cleanup** — delete the test DB (`DELETE /v1/db/<dbId>`) so the sealed blob
   and row don't linger.

## What good looks like

Connect returns `201` with a real schema preview for a **Supabase pooler** URL,
`/v1/ask` returns rows, and a loopback host is rejected `400`. Before
`SK-DBCONN-002` step 1 returned `502 introspection_failed` for every non-Neon
host, because the Neon HTTP driver could only speak to Neon.
