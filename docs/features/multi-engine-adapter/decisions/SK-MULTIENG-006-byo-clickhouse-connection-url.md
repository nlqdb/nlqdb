# SK-MULTIENG-006 — BYO ClickHouse connection URL: validate at the wire boundary, store sealed, display redacted (HTTP interface)

Parent feature: [`multi-engine-adapter/FEATURE.md`](../FEATURE.md). Builds on
[`SK-MULTIENG-005`](./SK-MULTIENG-005-byo-clickhouse-promoted.md) (BYO
ClickHouse promoted; the `/v1/db/connect` shape, native-HTTP transport).
The deliberate ClickHouse parallel of
[`SK-DB-012`](../../db-adapter/decisions/SK-DB-012-byo-connection-url-handling.md),
which forecast this slice ("BYO ClickHouse uses an HTTP(S) URL, not a libpq
URI, so it gets its own parallel parser"). Seal/open primitive:
[`apps/api/src/secret-envelope.ts`](../../../../apps/api/src/secret-envelope.ts)
([`GLOBAL-031`](../../../decisions/GLOBAL-031-byo-secret-envelope.md)).

- **Decision:** A user-supplied ClickHouse `connection_url` is handled by one
  pure module, `packages/db/src/clickhouse-connection-url.ts`, before it
  touches `fetch` or the at-rest seal. `parseClickhouseUrl(raw)` validates the
  HTTP-interface shape (scheme ∈ `http:` / `https:`, a non-empty single host)
  and fails loud with a one-sentence next action
  ([`GLOBAL-012`](../../../decisions/GLOBAL-012-one-sentence-errors.md)) on
  anything `fetch` could not use. Two ClickHouse-specific shapes pin here,
  both following the HTTP interface (the only transport Workers can reach per
  `SK-MULTIENG-005`):
  - **The ClickHouse client DSN schemes are rejected with a pointer, not
    silently dropped.** `clickhouse://` / `clickhousedb://` / `clickhouses://`
    / `clickhouse+http://` / `tcp://` are driver / SQLAlchemy connection
    schemes, not the plain HTTP-interface URL nlqdb `fetch`es (and
    `clickhouse://` may even mean native TCP on port 9000 in
    `clickhouse-driver`) — so the rejection names the scheme and points at the
    HTTP endpoint (`http://` :8123 / `https://` :8443) without asserting a
    transport that depends on which library produced the URL, turning a common
    mis-paste into an actionable error rather than an opaque connect failure.
  - **The database comes from the `?database=` query param, not the path.**
    The ClickHouse HTTP interface reads the target database from `?database=`
    (and defaults it to `default`), ignoring any path segment — so the parser
    resolves `database` from the query, defaulting to `"default"`, and never
    reads a path segment as the database the way the libpq parser does. A
    **database-bearing path with no `?database=`** (a clickhouse-connect /
    SQLAlchemy DSN paste like `…/mydb`) is **rejected** rather than adopted:
    the adapter connects via the sealed *original* URL, where ClickHouse
    ignores the path and queries `default`, so adopting `mydb` would make
    introspection and execution silently disagree. A path *with* an explicit
    `?database=` is kept as a reverse-proxy prefix (the query param is
    authoritative).

  It returns a `redacted` display form, `https://user@host:port/?database=db`,
  **rebuilt from an allowlist of safe parts only** (scheme, user, host:port,
  database) rather than copied through. That matters more than for Postgres:
  the ClickHouse HTTP interface can carry the password in the userinfo **and**
  in a `?password=` query param, and arbitrary settings ride other query
  params — rebuilding from an allowlist makes a leak structurally impossible
  rather than relying on stripping known-bad keys. That redacted form is the
  only representation permitted on a span, log line, CLI prompt, or SDK
  response envelope; the full original URL is sealed verbatim by
  `secret-envelope.ts` (context `dbconn:<dbId>`, identical to BYO Postgres) so
  any TLS / settings query params still apply at connect time.
  `redactClickhouseUrl(raw)` is the log/error-path convenience: it returns the
  redacted form, or a fixed `<unparseable ClickHouse URL>` sentinel that never
  echoes the raw input. As in `SK-DB-012`, a comma-separated multi-host
  failover list is rejected this slice (WHATWG `URL` keeps the comma in the
  host string, which `fetch` would never accept) — multi-host BYO is a later
  slice.
- **Core value:** Bullet-proof, Simple, Open source
- **Why:** `SK-MULTIENG-005` commits to a per-db AES-GCM blob and to echoing
  the connection back across the CLI / chat / SDK, but a credential string is
  exactly the value that must never reach a log or a span — the same posture
  `secret-envelope.ts` and `ask/byollm.ts` already hold. Doing the redaction ad
  hoc per surface is how a password ends up in a trace on one of five surfaces;
  one tested primitive makes the safe form the only easy form, and the
  allowlist-rebuild approach removes the "did we strip every secret-bearing
  query key?" question entirely. Validating at the wire boundary turns an
  opaque `fetch` connect error into a clear 400 the user can act on. It is a
  **separate** parser from `connection-url.ts`, not a generalisation, exactly
  as `SK-DB-012` called for and as `SK-DB-002`'s parallel-adapter pattern
  prescribes — the two URL grammars (libpq URI with the db in the path vs HTTP
  endpoint with the db in a query param) differ enough that a premature union
  would be less clear than two small parsers. The module is zero-dependency
  (WHATWG `URL` only) so it adds no weight to the Workers free-tier bundle
  ([`GLOBAL-013`](../../../decisions/GLOBAL-013-free-tier-bundle-budget.md)),
  and it lives in `packages/db/` because that package is the canonical owner of
  the ClickHouse engine
  ([`GLOBAL-021`](../../../decisions/GLOBAL-021-external-system-ownership.md)).
  It ships ahead of its callers on purpose, exactly as `secret-envelope.ts` and
  `connection-url.ts` did: a pure primitive lands and is tested in isolation,
  then `apps/api/src/db-create/connect.ts` and
  `apps/api/src/db-create/introspect-clickhouse.ts` (the handlers
  `SK-MULTIENG-005` names) consume it. It is an internal primitive, not a new
  public capability, so it carries no
  [`GLOBAL-003`](../../../decisions/GLOBAL-003-all-surfaces-one-pr.md)
  surface-parity obligation of its own; that obligation lands with the
  `/v1/db/connect` verb in `SK-MULTIENG-005`.
- **Consequence in code:** `packages/db/src/clickhouse-connection-url.ts`
  exports `parseClickhouseUrl` / `redactClickhouseUrl` /
  `UNPARSEABLE_CLICKHOUSE_URL` and the `ParsedClickhouseUrl` /
  `ParseClickhouseUrlResult` types, all re-exported from `@nlqdb/db`. `connect.ts`
  calls `parseClickhouseUrl` first (returning the `GLOBAL-012` message as the
  400 body on failure), seals the raw URL, and persists `redacted` alongside
  the blob for the connection pill; `introspect-clickhouse.ts` uses the parsed
  `database` for the `system.columns` query. Tests in
  `packages/db/test/clickhouse-connection-url.test.ts` assert the password —
  whether in the userinfo or the `?password=` param — and every other query
  param never appear in `redacted`, that rejection messages never echo a
  secret, and the accept/reject matrix above. **Egress safety (SSRF) is
  explicitly out of this primitive's scope** — a pure string parser can't
  prevent a hostname that *resolves* to a private/metadata address (DNS
  rebinding defeats any literal-IP check), so that guard belongs at the
  connect-time `fetch` boundary; tracked as an Open question on the feature.
- **Alternatives rejected:**
  - **Generalise one parser across Postgres + ClickHouse.** Rejected by
    `SK-DB-012` already: the libpq URI (db in path) and the HTTP endpoint (db
    in a query param, native-protocol schemes to reject) differ enough that a
    union would be less clear than two small parsers (`SK-DB-002` pattern).
  - **Strip known secret query keys (`password`, …) and keep the rest.** A
    denylist misses the next secret-bearing key; rebuilding the redacted form
    from an allowlist of safe parts is the only leak-proof rule. The dropped
    settings still apply — they ride the sealed blob.
  - **Adopt a database-bearing path (`…/mydb`) as the target database.** The
    adapter connects via the sealed *original* URL, which ClickHouse's HTTP
    interface evaluates with the path ignored and the database defaulted to
    `default`; adopting `mydb` into the parsed result would make
    `system.columns` introspection (which uses the parsed database) disagree
    with what the queries actually hit. Rejecting loudly is the only honest
    choice for a pure parser that doesn't also rewrite the connect URL.
  - **Pass the raw URL straight to `fetch` and let it fail.** The error is
    opaque and arrives after a network round trip; a wire-boundary 400 is
    faster and actionable, and a `clickhouse://` paste would fail with no hint
    that the HTTP interface is what's wanted.
  - **Add literal private-IP / metadata rejection here for SSRF.** Gives false
    assurance — a public hostname can resolve to a private address — and would
    reject legitimate private-network ClickHouse reachable via a tunnel. SSRF
    egress filtering is a connect-time `fetch` concern with the resolved
    address, not a pure parser's.
- **Source:** canonical here ·
  [`SK-MULTIENG-005`](./SK-MULTIENG-005-byo-clickhouse-promoted.md) (the
  `/v1/db/connect` shape + native-HTTP transport) ·
  [`SK-DB-012`](../../db-adapter/decisions/SK-DB-012-byo-connection-url-handling.md)
  (the Postgres parallel that forecast this parser) · `GLOBAL-031` (the seal) ·
  `GLOBAL-021` (ClickHouse owned by `packages/db/`) · ClickHouse HTTP interface
  docs (`https://clickhouse.com/docs/interfaces/http` — credential and
  `?database=` conventions, web-checked 2026-06).
