# SK-APIKEYS-004 — MCP keys are scoped per-host AND per-device; agents do not share credentials

- **Decision:** Each MCP integration mints its own key of the form `sk_mcp_<host>_<device>_…` carrying `{user_id, mcp_host, device_id, created_at, last_used_at}` claims. Two MCP hosts on the same machine — or the same host on two machines — get two separate keys. There is no "MCP key" that floats across hosts.
- **Core value:** Bullet-proof, Seamless auth, Effortless UX
- **Why:** Per-host keys make revocation precise: "stop letting Cursor on this laptop talk to nlqdb" is one click instead of "rotate everywhere and re-onboard every host." It also keeps the audit log meaningful — every tool call has a `(user_id, mcp_host, device_id)` tuple, so the dashboard can show "Cursor on macbook-air ran 14 queries today."
- **Consequence in code:** `nlq mcp install` (per `docs/architecture.md §3.4`) mints via `POST /v1/keys` with `{type: "sk_mcp", host, device}` and writes the result straight to the host's config file (never displayed). DBs created via MCP are tagged with `(mcp_host, device_id)` and default to visible only under that tuple; promote-to-account is one click.
- **Alternatives rejected:** One MCP key per user — revocation blast radius is every host; bad UX for the "I need to revoke just my work laptop" case. Key per host (no device) — same key on two machines means one machine being compromised takes the host down everywhere.
- **Source:** docs/architecture.md §3.4, §4.1
