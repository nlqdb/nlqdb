# SK-APIKEYS-001 — Three key types: `pk_live_`, `sk_live_`, `sk_mcp_<host>_<device>_`

- **Decision:** API keys come in exactly three prefix-tagged types. Each is fixed-purpose and not interchangeable: `pk_live_…` (publishable, read-only, per-DB, origin-pinned, used by `<nlq-data>`); `sk_live_…` (secret, server-only, full scope, used by backends and the HTTP API); `sk_mcp_<host>_<device>_…` (like `sk_live_` plus `(mcp_host, device_id)` claims, used by the MCP server).
- **Core value:** Simple, Bullet-proof, Effortless UX
- **Why:** A self-describing prefix tells a reader (human or log line) exactly what the key can do without consulting a database. A leaked browser key (`pk_live_`) cannot mutate; a leaked MCP key carries the host that minted it; an `sk_live_` is unambiguously a backend secret. Three types is the smallest number that distinguishes the three threat models cleanly.
- **Consequence in code:** Validators dispatch on prefix before consulting the DB. `pk_live_` keys reject any mutating call at the edge before the plan runs. The `sk_mcp_…` validator additionally enforces the `(mcp_host, device_id)` claims. New surfaces never get a fourth key type without a `GLOBAL-NNN`-grade decision.
- **Alternatives rejected:** One key type, scope encoded in claims — readers can't tell scope at a glance; log triage harder. Per-surface key types (`sk_web_`, `sk_cli_`, …) — sessions cover those; a key per surface is one more thing to rotate.
- **Source:** docs/architecture.md §4.1
