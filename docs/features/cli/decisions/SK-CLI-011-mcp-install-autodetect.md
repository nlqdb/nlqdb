# SK-CLI-011 — `nlq mcp install` auto-detects hosts; explicit `<host>` is the override

- **Decision:** `nlq mcp install` (no arg) scans known host configs for Claude Desktop, Cursor, Zed, Windsurf, VS Code, Continue. One host found → silent install. Multiple → numbered prompt (or `--all`). None → prints install links. Explicit `nlq mcp install <host>` targets the named host even if not detected. The CLI mints `sk_mcp_<host>_<device>_…` keys via `POST /v1/keys` and writes them straight into the host's config (never displayed). Self-check via `nlqdb_list_databases()` confirms wiring.
- **Core value:** Seamless auth, Effortless UX, Goal-first
- **Why:** MCP setup today across hosts is a JSON-config minigame; auto-detect collapses it to one command. Per-host keys (`sk_mcp_<host>_<device>_…`) keep credentials siloed — see `docs/features/api-keys/FEATURE.md` for the rotation/revocation surface. Never displaying the key prevents copy-into-screenshot leaks; the self-check catches partial wires before the user notices.
- **Consequence in code:** Each host has a detector + writer in `cli/internal/mcphosts/`. Hot-reloading hosts (Cursor / Zed / Windsurf) pick up the change in seconds; Claude Desktop gets a restart prompt. Adding a new host = new file in `mcphosts/`, no changes elsewhere. CI test: each host's writer round-trips a config file without touching unrelated keys.
- **Alternatives rejected:**
  - Print JSON for the user to paste — high error rate; defeats the seamless-auth value.
  - One key shared across all hosts — single revocation kills every host; per-host keys are surgical.
