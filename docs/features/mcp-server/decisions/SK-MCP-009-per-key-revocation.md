# SK-MCP-009 — Per-key rate-limit bucket; revocation propagates ≤ 1 s

- **Decision:** Every `sk_mcp_*` key is its own rate-limit bucket — `SK-MCP-004` already embeds `(mcp_host, device_id)`, so hosts have independent budgets. Revocation marks `revoked_at` in D1; hosted-MCP isolates keep a 1 s `Map<keyHash, { revoked }>` cache gating every tool call. Local-stdio resolves auth against the API on every call (no cache).
- **Core value:** Bullet-proof, Honest latency, Free
- **Why:** Tool calls are low-RPS (humans driving an agent), so per-call auth is affordable. 1 s absorbs burst-validation without breaching `GLOBAL-018`'s "instant" — it's the human-perceptible bound and the practical KV/D1 propagation floor.
- **Consequence in code:** `api-keys.ts` adds `revoked_at`; `lookupSkMcpKey()` filters `WHERE revoked_at IS NULL`. Hosted Worker wraps the lookup in `IsolateCache<KeyHash, …>` with `ttlMs: 1000`. Rate-limit middleware keys buckets as `rl:${keyHash}` — no `sk_mcp_*` vs `sk_live_*` special-casing.
- **Alternatives rejected:**
  - Shared per-user bucket across hosts — noisy host burns sibling budgets; no per-host revocation recourse.
  - 5 s TTL — too loose; pushes past the human-perceptible bound.
  - Push-based broadcast — fan-out cost on free tier; 1 s pull cache reaches the same SLO with one D1 read per miss.
