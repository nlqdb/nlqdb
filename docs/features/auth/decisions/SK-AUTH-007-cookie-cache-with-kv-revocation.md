# SK-AUTH-007 — Cookie cache + KV revocation-set check land together; never separately

- **Decision:** Better Auth's `session.cookieCache` (which caches the verified session in the cookie itself to skip the DB read) is enabled paired with a KV revocation-set check on every session read. The pair lands in the same PR; cookie cache without the revocation hook is rejected at review.
- **Core value:** Bullet-proof, Fast, Honest latency
- **Why:** `cookieCache` alone drops `nlqdb.auth.verify` from ~30 ms p99 (D1-bound) to ~6 ms p99 (HMAC + KV) — but it would also defeat `GLOBAL-018` because the cached cookie would survive revocation until expiry. Adding the KV check on every read keeps the latency win and the revocation guarantee.
- **Consequence in code:** A test asserts that revoking a session via the dashboard returns 401 within ≤2 s on the next call from any surface. The `useSession` hook on web, the bearer-verifier on the API, and the device-token verifier in CLI all share the same `verifySessionWithRevocation` helper.
- **Alternatives rejected:** Cookie cache only — `GLOBAL-018` violated. KV check only (no cookie cache) — leaves perf on the table; auth verify dominates the cache-hit budget per `docs/performance.md §2.1`.
- **Source:** docs/architecture.md §4.3, §4.5; docs/performance.md §4 Slice 6 (CI assertion)
