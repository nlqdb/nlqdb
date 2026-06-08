# GLOBAL-035 — One egress guard for every bring-your-own outbound connection

- **Decision:** Every bring-your-own database host nlqdb connects to —
  BYO Postgres (`SK-DB-011`) and BYO ClickHouse (`SK-MULTIENG-005`), plus
  any future BYO engine — passes the single shared egress guard
  `guardEgressHost` in `packages/db/src/egress-guard.ts` before a
  socket / `fetch` is opened against it. No feature rolls its own
  private-range check. A **literal IP** is decided synchronously and
  fail-loud (`GLOBAL-012`): any address in a loopback (`127.0.0.0/8`,
  `::1`), private (`10/8`, `172.16/12`, `192.168/16`, `fc00::/7`),
  link-local (`169.254.0.0/16` — the cloud-metadata endpoint —
  `fe80::/10`), carrier-grade-NAT (`100.64.0.0/10`), this-host
  (`0.0.0.0/8`), or multicast / reserved (`224.0.0.0/3`, `ff00::/8`,
  `fec0::/10`) range is rejected — **including** the IPv6 transition
  forms that embed such a v4 (IPv4-mapped `::ffff:`, IPv4-compatible,
  6to4 `2002::/16`, NAT64 `64:ff9b::/32`) and the decimal / hex / octal
  IPv4 encodings. A **DNS name** can resolve to anything and a pure
  function cannot bound DNS rebinding, so a name returns
  `needsDnsRecheck: true`: the connect-time caller MUST resolve it and
  re-run the same guard on every resolved address. The guard is pure,
  zero-dependency, and lives in `packages/db/` (`GLOBAL-021`).
- **Core value:** Bullet-proof, Free
- **Why:** BYO ClickHouse has the Worker `fetch()` an arbitrary
  user-supplied host directly (no Hyperdrive proxy, unlike the Neon PG
  path), and BYO Postgres connect-time introspection reaches a
  user-supplied host too — so an unguarded host pointed at `127.0.0.1`,
  an RFC-1918 address, or `169.254.169.254` is a Server-Side Request
  Forgery straight into our own network or the cloud-metadata service
  (the Capital One breach class). Two BYO workstreams need the identical
  check; letting each invent its own is how an IPv4-mapped-IPv6 or
  decimal-encoding bypass slips into one of them — exactly the live 2026
  CVE class (Symfony CVE-2026-48736; Discourse, Twenty, openclaw
  advisories). One audited module, folding alternate encodings through
  the same WHATWG `URL` parser the transport uses rather than a
  bypass-prone hand-rolled decoder, is one place to review and harden.
- **Consequence in code:** `guardEgressHost(host): EgressGuardResult` in
  `packages/db/src/egress-guard.ts` is the only private-range classifier
  for BYO connection hosts; `connect.ts` (and any future BYO connect
  path) calls it after `parseConnectionUrl` / `parseClickhouseUrl` (which
  validate URL *shape* only and deliberately do not block a host) and,
  for a `needsDnsRecheck` name, again on each resolved address at
  connect time. That resolve-then-recheck composition ships as the async
  sibling `guardEgressHostResolved(host, resolve)` in the same module: it
  short-circuits a literal IP, and for a name resolves via an injected
  `DnsResolver` (Workers has no `dns` module, so the inject keeps the guard
  pure + zero-dep) then re-guards every returned address, failing **closed**
  (`GLOBAL-012`) on a resolver error, an empty resolve, or any
  private/reserved/non-address result. The production `DnsResolver` is
  `createDohResolver` in `packages/db/src/doh-resolver.ts` — a DNS-over-HTTPS
  lookup (Cloudflare 1.1.1.1 JSON, no auth) that queries A + AAAA in parallel,
  returns only the bare IPs from those answer types (a CNAME chain is flattened
  by the resolver; non-address types are dropped), bounds each leg with an
  `AbortController` timeout, and fails loud on any transport/parse error so the
  guard fails closed. It emits one `dns.resolve` span (`GLOBAL-014`). New
  BYO-engine callers import this module rather than re-listing CIDRs or rolling
  their own resolver. Still open in the two BYO features: the `connect.ts`
  `fetch`-boundary wiring that calls `guardEgressHostResolved` with this
  resolver, and whether a Cloudflare-level egress policy backstops the residual
  TOCTOU window between resolve and connect.
- **Alternatives rejected:**
  - **A check per feature** — divergence risk on a security control;
    doubles the surface where an IP-encoding bypass can land.
  - **A hand-rolled decimal/hex/octal IPv4 decoder** — the OWASP SSRF
    cheat-sheet flags these as the classic bypass; deferring
    canonicalisation to the same `URL` parser `fetch` uses is the only
    way the guard and the transport agree on what a host resolves to.
  - **Blocking inside the URL parser** — `SK-DB-012` / `SK-MULTIENG-006`
    deliberately keep the parser shape-only and side-effect-free; the
    egress decision belongs at the connect boundary, where a resolved IP
    (not just the typed host) can be re-checked.
  - **Relying on a network-level egress policy alone** — not available on
    the Workers free tier (`GLOBAL-013`) and gives no actionable
    `GLOBAL-012` error to the user who pasted an internal host.
