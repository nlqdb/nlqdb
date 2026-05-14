# SK-MCP-011 — Dynamic client registration (RFC 7591) via `/register`

- **Decision:** `apps/mcp/`'s `OAuthProvider` exposes `clientRegistrationEndpoint: '/register'` so any MCP host self-registers at runtime — paste the URL, the host hits `/register`, gets a `client_id`/`client_secret`, walks the OAuth dance. Registration is rate-limited to prevent abuse (mirroring `apps/api/`'s rate-limit middleware once 3c lands). The `OAuthProvider`'s client registry is the source of truth for the CORS allow-list (`cors-allowlist.ts` reads registered `redirect_uri` origins).
- **Core value:** Effortless UX, Free, Bullet-proof
- **Why:** Hardcoding allowed clients would mean every new MCP host needs a PR. RFC 7591 is the standard MCP hosts already implement (Claude Desktop, Cursor, Zed). The registry doubles as the CORS allow-list — adding a host is one operation, not two.
- **Consequence in code:** `apps/mcp/src/index.ts`'s `OAuthProvider` config carries `clientRegistrationEndpoint: '/register'`. `apps/mcp/src/cors-allowlist.ts`'s `resolveAllowedOrigin` walks `OAUTH_PROVIDER.listClients()` and accepts any origin matching a registered `redirect_uri` origin. PRs that hardcode client_ids inside `apps/mcp/` fail review.
- **Alternatives rejected:**
  - Static client allow-list — every new host requires a PR; defeats the "paste a URL" promise.
  - Disable DCR, require manual provisioning — same problem, worse UX.
  - Mint clients via `apps/api/`'s session-gated endpoint — adds a hop for no security gain; `OAuthProvider`'s built-in DCR is the standard surface.
