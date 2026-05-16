# SK-MCP-009 — Per-key rate-limit bucket; revocation propagates ≤ 1 s

- **Decision:** Every `sk_*` key is its own rate-limit bucket. `SK-MCP-004` already embeds `(mcp_host, device_id)` in the `sk_mcp_*` shape, so MCP hosts have independent budgets via this same mechanism; `sk_live_*` benefits identically. Revocation marks `revoked_at` in D1; hosted-MCP `McpAgent` Durable Objects keep a 1 s `lastRevalidatedAt` stamp gating every tool call. Local-stdio resolves auth against the API on every call (no cache).
- **Core value:** Bullet-proof, Honest latency, Free
- **Why:** Tool calls are low-RPS (humans driving an agent), so per-call auth is affordable. 1 s absorbs burst-validation without breaching `GLOBAL-018`'s "instant" — it's the human-perceptible bound and the practical KV/D1 propagation floor.
- **Consequence in code:** `api-keys.ts` carries `revoked_at`; `lookupSkKey()` filters `WHERE revoked_at IS NULL`. `apps/api/src/principal.ts::rateLimitBucketKey` keys all `sk_*` principals by `rl:${api_keys.id}` (single namespace — no `sk_mcp_*` vs `sk_live_*` special-casing); user / anon / pk_live continue to key by `principal.id`. The MCP `McpAgent` DO (`apps/mcp/src/mcp-agent.ts`) caches `(bearer, bearerHash, …)` props and re-probes `/v1/keys/:hash/status` every `REVALIDATE_TTL_MS = 1000`. The rate-limit table column is `bucket_key` (migration 0014, renamed from `user_id`).
- **Alternatives rejected:**
  - Shared per-user bucket across hosts — noisy host burns sibling budgets; no per-host revocation recourse.
  - 5 s TTL — too loose; pushes past the human-perceptible bound.
  - Push-based broadcast — fan-out cost on free tier; 1 s pull cache reaches the same SLO with one D1 read per miss.
  - Different prefixes per sk-type (`sk_live:` / `sk_mcp:`) — the decision is uniform treatment of `sk_*`; one `rl:` namespace + `api_keys.id` is unique across both rows.
