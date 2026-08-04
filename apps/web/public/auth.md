# auth.md — how an agent authenticates with nlqdb

nlqdb gives an AI agent a real SQL database it can query — and use as
persistent memory — in plain English. There are two ways to authenticate,
both free. There is no agent self-registration endpoint: a human signs in
once (magic link, GitHub, or Google — no passwords ever exist), and
everything after that is automatable.

## Path 1 — Hosted MCP server (OAuth 2.0, one browser consent)

Connect your MCP host to the hosted server:

```
https://mcp.nlqdb.com/mcp
```

The server implements OAuth 2.0 authorization-code with PKCE and dynamic
client registration (RFC 7591) — your MCP client registers itself; no
pre-provisioned client ID is needed. Discovery metadata is live at:

- `https://mcp.nlqdb.com/.well-known/oauth-authorization-server` (RFC 8414)
- `https://mcp.nlqdb.com/.well-known/oauth-protected-resource` (RFC 9728)

The first tool call opens a browser consent page once; the host stores the
token. Scope is `mcp` (query, list, describe, read/write memory).

## Path 2 — Headless (API key, no browser)

For unattended agents — CI, containers, anything with nobody at a browser —
run the same tools locally over stdio, authenticated by an `sk_mcp_` key in
the host config's env:

```bash
claude mcp add --env NLQDB_API_KEY=sk_mcp_REPLACE_ME --transport stdio nlqdb -- npx -y @nlqdb/mcp
```

Mint the key at [app.nlqdb.com/app/keys](https://app.nlqdb.com/app/keys)
(needs one signed-in session). `sk_mcp_` is least-privilege by design:
it can ask, list, describe, and read/write memory, but cannot connect
external databases or manage keys — and it is revocable per host without
signing out anything else.

## Raw HTTP API

The same keys authenticate the HTTP API at `https://app.nlqdb.com/v1/*`
via `Authorization: Bearer <key>`. API catalog:
[/.well-known/api-catalog](/.well-known/api-catalog).

## More

- Setup guide: <https://docs.nlqdb.com/agent-memory/>
- MCP install options per host: <https://nlqdb.com/agents/>
- Droppable skills: [/.well-known/agent-skills/index.json](/.well-known/agent-skills/index.json)
