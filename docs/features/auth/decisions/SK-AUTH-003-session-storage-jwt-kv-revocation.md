# SK-AUTH-003 — Session storage: 1h JWT access tokens + KV revocation set

- **Decision:** Sessions use HMAC-signed JWT access tokens with a 1h TTL. A Cloudflare Workers KV revocation set (keyed by `jti` for sessions, key-hash-prefix for API keys) is consulted on every request. KV-miss is ≤2 ms; revocation propagation is ≤2 s.
- **Core value:** Seamless auth, Bullet-proof, Fast
- **Why:** Pure JWT (no revocation list) makes revocation a lie; pure DB session lookup adds DB hops to every request and competes with the user's own DB on connection budget. KV revocation set is the small-cost bridge — JWT covers the 99.99% case, KV covers the "we just revoked this" case in seconds. Workers KV free tier (100k reads/day) absorbs the load.
- **Consequence in code:** Every authenticating handler does `verifyJwt → kv.get(revocation:<jti>)` before trusting the caller. The "≤2 s revocation" SLA is a contract test (revoke-from-web-then-CLI-401-on-next-call). Session TTL (`access: 1h`, `refresh: 30d sliding for web / 90d rotated for CLI`) is fixed in `packages/auth-internal`.
- **Alternatives rejected:** Long-lived JWTs with no revocation — `GLOBAL-018` violation. DB-only sessions — adds latency and load to every request. Short JWTs with no revocation — still has a window where a stolen token works.
- **Source:** docs/architecture.md §4.1, §4.3
