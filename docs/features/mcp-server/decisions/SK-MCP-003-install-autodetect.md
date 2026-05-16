# SK-MCP-003 — `nlq mcp install` no-arg auto-detects hosts; explicit `<host>` is power-user override

- **Decision:** The default `nlq mcp install` (no arg) scans known host configs for Claude Desktop, Cursor, Zed, Windsurf, VS Code, and Continue, and prints what it found. One host → silent install. Multiple → numbered prompt (or `--all`). None → prints install links and exits. Explicit forms (`nlq mcp install <host>`, `--dry-run`, `--all`) are the escape hatches.
- **Core value:** Effortless UX, Seamless auth, Goal-first
- **Why:** Asking the user to name their MCP host is friction we can remove — every host stores its config in a known location. Detection-first ("what you have, set up") matches the on-ramp inversion principle. The explicit override exists for users who want to bypass detection (CI, custom builds, hosts not yet supported).
- **Consequence in code:** `cli/src/mcp/install.ts` ships per-host detectors that read each host's config path and return a `{detected, configPath, hotReloads}` tuple. Detection is transparent — the CLI prints what it's about to touch (`docs/architecture.md §3.4`). The `--dry-run` flag is mandatory parity with explicit / no-arg modes.
- **Alternatives rejected:**
  - Always require `<host>` — every install adds a "what's my host called?" question.
  - Detect *and* always confirm — adds a click for the 60% of users with one host.
