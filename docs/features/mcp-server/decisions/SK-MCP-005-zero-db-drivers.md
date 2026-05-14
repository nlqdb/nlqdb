# SK-MCP-005 — Zero DB drivers in `@nlqdb/mcp`'s lockfile (CI-enforced)

- **Decision:** The local-stdio transport (`@nlqdb/mcp` on npm) holds no DB credentials and has no DB-driver dependencies in its lockfile. CI fails any PR that adds `pg` / `postgres` / `redis` / `mysql` / `mongodb` / equivalents to the package's transitive tree.
- **Core value:** Bullet-proof, Free
- **Why:** The MCP server is a thin adapter over the HTTP API — every request goes to `api.nlqdb.com`. A DB driver in the local package is a footgun: it could shortcut to a real DB, leak a connection string, or invite "support DB X locally" feature creep. Banning them at the lockfile level is the only defense that survives well-intentioned PRs.
- **Consequence in code:** `packages/mcp/package.json` carries no DB drivers. CI (`.github/workflows/`) greps the lockfile against a deny-list and fails on a hit. Postgres credentials never leave Cloudflare in either transport.
- **Alternatives rejected:**
  - Trust reviewers to catch it — drivers slip in transitively (a polyfill, a logger that depends on `pg-types`, etc.); a CI check is the only durable defense.
  - Allow drivers but block their use at runtime — runtime guards drift; the lockfile is the source of truth.
