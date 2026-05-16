# SK-MCP-012 — Single `mcp` scope

- **Decision:** The OAuth provider advertises one scope, `mcp`. Read-only vs full-access is already encoded in the bound key type (`pk_live_` is read-only + origin-pinned per `SK-APIKEYS-003`; `sk_mcp_` is full-access per `SK-MCP-004`). Per-tool scopes (`mcp:query`, `mcp:list`, `mcp:describe`) would duplicate the key-type gate.
- **Core value:** Simple, Bullet-proof
- **Why:** Two layers of enforcement (scope + key type) means two places to forget. Hosts and reviewers learn one scope name. Tool-level capability is enforced at `apps/api/`'s validator (`sql-validate-ddl.ts` + the principal kind gate), not at the OAuth layer.
- **Consequence in code:** `apps/mcp/src/index.ts`'s `OAuthProvider` carries `scopesSupported: ["mcp"]`. The metadata endpoint surfaces the same. New tool-level scopes require a new `SK-MCP-NNN` justifying why the key-type gate is insufficient.
- **Alternatives rejected:**
  - Per-tool scopes (`mcp:query`, `mcp:list`, `mcp:describe`) — duplicates the key-type gate; hosts and users have two places to misconfigure.
  - No scope at all — OAuth 2.1 metadata requires at least one in `scopes_supported`; declaring zero is malformed.
