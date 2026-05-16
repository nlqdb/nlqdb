# SK-MCP-008 — Per-host detector is one file behind `HostDetector { name, configPath, installed, hotReloadable, patch }`

- **Decision:** Each host is a module implementing `HostDetector { name; configPath(home, platform); installed(); hotReloadable; patch(config, entry) }`. New hosts = one file in `cli/internal/mcp/hosts/<host>.go` + one registry entry. Initial six: Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json` macOS, `%APPDATA%\Claude\…` Windows, `~/.config/Claude/…` Linux), Cursor (`~/.cursor/mcp.json`), Windsurf (`~/.codeium/windsurf/mcp_config.json`), Zed (`~/.config/zed/settings.json` under `context_servers`), VS Code Continue (`~/.continue/config.json`), Cline (`~/.cline/mcp_settings.json`). Inserted entry shape: `{ "nlqdb": { "command": "npx", "args": ["@nlqdb/mcp"], "env": { "NLQDB_API_KEY": "sk_mcp_…" } } }` — host-specific JSON nesting (Zed `context_servers`, Cursor/Claude `mcpServers`, VS Code Continue `servers`) lives inside `patch()`.
- **Core value:** Effortless UX, Simple
- **Why:** Only the path, JSON shape, and hot-reload behaviour vary per host. Centralising those three facts behind one interface — and routing every install through the registry, not a host-name switch — keeps the list growing without re-architecting.
- **Consequence in code:** `cli/internal/mcp/registry.go` lists detectors in detection order. PRs that branch on host name outside `hosts/<host>.go` fail review. The `patch()` function is the only place that knows host-specific JSON nesting.
- **Alternatives rejected:**
  - Switch statement in `install.go` — every new host edits the same hot file; merge-conflict magnet.
  - Declarative manifest per host — can't express host-specific JSON-patch logic.
  - Detect by binary presence — misleading on Linux; the config file is the canonical "host is installed" signal anyway.
