# SK-MCP-004 — Per-host scoped keys: `sk_mcp_<host>_<device>_…`

- **Decision:** Each MCP install mints a distinct key of the form `sk_mcp_<host>_<device>_…` carrying `{ user_id, mcp_host, device_id, created_at, last_used_at }` claims. Agents do **not** share credentials across hosts. The dashboard lists each with its host, device, and last-used timestamp.
- **Core value:** Bullet-proof, Seamless auth
- **Why:** A leaked or compromised MCP key on one host (an exfiltrating extension, a misbehaving fork) should not blast across all hosts. Per-host keys give a one-click revocation surface (`GLOBAL-018`) that removes Cursor without removing Claude Desktop. They also make the audit log answer "which host did that query come from?" without inference.
- **Consequence in code:** `apps/api/src/routes/keys/` mints `sk_mcp_*` with the (`mcp_host`, `device_id`) claims. DBs created via MCP are tagged with `(mcp_host, device_id)` and default to visible only under that tuple; promote-to-account is one click. Dashboard / `nlq keys list` displays keys grouped by host + device.
- **Alternatives rejected:**
  - One key shared across hosts — single revocation surface, blast radius too wide.
  - Keys scoped per-(host, project) — over-fragmentation; agents move between projects within a host all day.
