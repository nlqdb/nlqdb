# SK-DB-012 — BYO connection URL: validate at the wire boundary, store sealed, display redacted

Parent feature: [`db-adapter/FEATURE.md`](../FEATURE.md). Builds on
[`SK-DB-011`](./SK-DB-011-byo-postgres-promoted.md) (BYO Postgres promoted;
the `/v1/db/connect` shape) and
[`architecture.md §3.6.7`](../../../architecture.md#367-byo-postgres-phase-4-decided-shape).
Seal/open primitive: [`apps/api/src/secret-envelope.ts`](../../../../apps/api/src/secret-envelope.ts)
([`GLOBAL-031`](../../../decisions/GLOBAL-031-byo-secret-envelope.md)).

- **Decision:** A user-supplied Postgres `connection_url` is handled by one
  pure module, `packages/db/src/connection-url.ts`, before it touches the
  driver or the at-rest seal. `parseConnectionUrl(raw)` validates the shape
  (scheme ∈ `postgres:` / `postgresql:`, a non-empty host, exactly one path
  segment as the database name) and fails loud with a one-sentence next
  action ([`GLOBAL-012`](../../../decisions/GLOBAL-012-one-sentence-errors.md))
  on anything a driver could not use — an absent port / user, query params,
  and IPv6 hosts all stay valid. It returns a `redacted` display form,
  `postgres://user@host:port/database`, with the **password and the entire
  query string removed** (libpq URIs may carry `password=` / `sslpassword=`
  / `sslkey=` in the query). That redacted form is the only representation
  permitted on a span, log line, CLI prompt, or SDK response envelope; the
  full original URL is sealed verbatim by `secret-envelope.ts` (context
  `dbconn:<dbId>`) so TLS / `sslmode` params still apply at connect time.
  `redactConnectionUrl(raw)` is the log/error-path convenience: it returns
  the redacted form, or a fixed `<unparseable connection URL>` sentinel that
  never echoes the raw input, so an unparseable value still embedding a
  secret can't leak.
- **Core value:** Bullet-proof, Simple, Open source
- **Why:** `SK-DB-011` / §3.6.7 commit to "per-db AES-GCM blob" storage and
  to the CLI / chat / SDK echoing the connection, but a credential string is
  exactly the value that must never reach a log or a span — the same posture
  `secret-envelope.ts` and `ask/byollm.ts` already hold ("never log the
  plaintext"). Doing the redaction ad hoc per surface is how a password ends
  up in a trace on one of five surfaces; one tested primitive makes the safe
  form the only easy form. Validating at the wire boundary turns an opaque
  driver connect error into a clear 400 the user can act on. The module is
  zero-dependency (WHATWG `URL` only) so it adds no weight to the Workers
  free-tier bundle ([`GLOBAL-013`](../../../decisions/GLOBAL-013-free-tier-bundle-budget.md)),
  and it lives in `packages/db/` because that package is the canonical owner
  of Postgres ([`GLOBAL-021`](../../../decisions/GLOBAL-021-external-system-ownership.md)) —
  not re-implemented inside the route handler. It ships ahead of its callers
  on purpose, exactly as `secret-envelope.ts` did: a pure primitive lands and
  is tested in isolation, then `apps/api/src/db-create/connect.ts` (the
  handler `SK-DB-011` names) and the four surfaces consume it. It is an
  internal primitive, not a new public capability, so it carries no
  [`GLOBAL-003`](../../../decisions/GLOBAL-003-all-surfaces-one-pr.md)
  surface-parity obligation of its own; that obligation lands with the
  `/v1/db/connect` verb in `SK-DB-011`.
- **Consequence in code:** `packages/db/src/connection-url.ts` exports
  `parseConnectionUrl` / `redactConnectionUrl` / `UNPARSEABLE_CONNECTION_URL`
  and the `ParsedConnectionUrl` / `ParseConnectionUrlResult` types, all
  re-exported from `@nlqdb/db`. `connect.ts` calls `parseConnectionUrl` first
  (returning the `GLOBAL-012` message as the 400 body on failure), seals the
  raw URL, and persists `redacted` alongside the blob for the connection
  pill. Tests in `packages/db/test/connection-url.test.ts` assert the
  password and query string never appear in `redacted`, that rejection
  messages never echo a secret, and the accept/reject matrix above. BYO
  ClickHouse uses an HTTP(S) URL, not a libpq URI, so it gets its own
  parallel parser in `multi-engine-adapter` (mirroring the parallel-adapter
  pattern in `SK-DB-002`), not a generalisation of this one.
- **Alternatives rejected:**
  - **Pass the raw URL straight to the driver and let it validate.** The
    driver's error is opaque ("connection failed") and arrives after a
    network round trip; a wire-boundary 400 is faster and actionable.
  - **Redact in the route handler / each surface.** Five copies of the
    redaction rule drift; the password leaks the first time one copy forgets
    the query string. One owned primitive (`GLOBAL-021`) is the fix.
  - **Keep the query string in the redacted form (it has `sslmode`).** It can
    also have `password=`; dropping the whole query string is the only
    leak-proof rule. `sslmode` still applies — it rides the sealed blob.
  - **Generalise one parser across Postgres + ClickHouse now.** The two URL
    shapes differ (libpq URI vs HTTP endpoint); a premature union would be
    less clear than two small parsers. `SK-DB-002`'s parallel-adapter pattern
    applies.
- **Source:** canonical here · `SK-DB-011` (the `/v1/db/connect` shape) ·
  `architecture.md §3.6.7` (per-db blob + connection echo) · `GLOBAL-031`
  (the seal) · `GLOBAL-021` (Postgres owned by `packages/db/`) ·
  `apps/api/src/secret-envelope.ts` (the pure-primitive-ahead-of-callers
  precedent).
