// SK-WEB-016 — Shared MCP-host install descriptors.
//
// Single source of truth for the deep-link URI + fallback JSON configs
// rendered by both `McpInstall.astro` (SSR) and `CreateForm.tsx`
// (post-create React island). When the research outputs change (a host
// adds a deep-link scheme, etc.) edit this file — both venues update
// together.
//
// Hosts:
//   - Cursor:      deep-link `cursor://anysphere.cursor-deeplink/mcp/install`.
//   - VS Code:     deep-link `vscode:mcp/install?<url-encoded JSON>`.
//   - Claude Code: command `claude mcp add --transport http …`.
//   - Codex:       command (edit `~/.codex/config.toml` `[mcp_servers.nlqdb]`).
//   - Claude:      fallback-only (Custom Connectors via Settings).
//   - Windsurf:    fallback-only (no payload-accepting scheme).
//   - Zed:         fallback-only (no scheme shipped as of Jun 2026).
//
// Research outputs (canonical — re-run before mutating a host's syntax):
//   - VS Code deep-link: `vscode:mcp/install?${encodeURIComponent(JSON.stringify(obj))}`
//     (URL-encoded, NOT base64; no named query param). Remote HTTP shape:
//     `{ "name": "nlqdb", "type": "http", "url": "https://mcp.nlqdb.com/mcp" }`.
//     https://code.visualstudio.com/api/extension-guides/ai/mcp
//     https://code.visualstudio.com/docs/agent-customization/mcp-servers
//   - Claude Code (CLI) remote HTTP: `claude mcp add --transport http nlqdb <url>`.
//     https://code.claude.com/docs/en/mcp
//   - Codex (OpenAI CLI): `codex mcp add` is STDIO-only — remote HTTP servers
//     are NOT addable via the CLI, only via `~/.codex/config.toml`
//     `[mcp_servers.nlqdb]` with `url = "<url>"`. We ship the TOML block, not a
//     (non-existent) `codex mcp add --url` command.
//     https://developers.openai.com/codex/mcp
//     https://developers.openai.com/codex/config-reference

export type McpHostId = "claude" | "cursor" | "windsurf" | "zed" | "vscode" | "claude-code" | "codex";

export interface McpHostEntry {
  id: McpHostId;
  name: string;
  /**
   * `deep-link` → an `<a href>` the OS hands to the host's URI handler.
   * `command`   → a copy-able shell command / config edit (CLI hosts).
   * `fallback-only` → a copy-able JSON config block.
   */
  status: "deep-link" | "command" | "fallback-only";
  /** Resolved deep-link URI (only when `status === "deep-link"`). */
  href?: string;
  /** Copy-able shell command (only when `status === "command"`). */
  command?: string;
  /** Full paste-ready config block (when `status` is `command` or `fallback-only`). */
  config?: string;
  /** One sentence pointing the user at where to run/paste it. */
  pasteHint?: string;
  /** Documented minimum host version, when known. */
  versionHint?: string;
}

export const PLACEHOLDER_KEY = "pk_live_REPLACE_ME";

/**
 * The hosted MCP endpoint every install config points at. The server
 * serves the MCP protocol at `/mcp`, NOT at root (see
 * `apps/mcp/src/index.ts` — `apiRoute: "/mcp"` /
 * `NlqdbMcpAgent.serve("/mcp")`). A config pointing at the bare domain
 * 404s on the first POST and then fails the SSE fallback. This is the
 * one place the URL is defined; every venue imports it. The path is
 * pinned by `mcp-install.test.ts` against the server's route so the two
 * can't drift again.
 */
export const MCP_ENDPOINT_URL = "https://mcp.nlqdb.com/mcp";

/**
 * The route the hosted MCP server serves the protocol on
 * (`apps/mcp/src/index.ts`). Pinned here so the contract test can assert
 * the shipped URL's path matches it without a cross-workspace import.
 */
export const MCP_SERVER_ROUTE = "/mcp";

/**
 * One promoted CTA per row — Claude wins by default (the first-party
 * hosted MCP target). Every other host renders as a ghost.
 */
export const PROMOTED_HOST: McpHostId = "claude";

/**
 * Base64 the way both Node/Bun (SSR) and the browser (React) agree on.
 * The Astro venue runs on the build worker (`Buffer` available) but the
 * React venue runs in the browser (`btoa` available). We feature-detect
 * so callers don't have to.
 */
function toBase64(s: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(s, "utf8").toString("base64");
  // btoa wants Latin-1; the inner payload is ASCII JSON so this is safe.
  return btoa(s);
}

/**
 * Build the Cursor deep-link. The `config` query parameter is
 * `base64(JSON.stringify(innerEntry))` — the INNER value of an
 * `mcpServers` entry, NOT the wrapped `{mcpServers:{…}}` object
 * (per cursor.com/docs/context/mcp/install-links). For a remote URL
 * server the inner shape is `{url: "https://…"}`. URL-encode the
 * base64 because `=` padding is reserved in query components.
 */
export function buildCursorHref(mcpUrl: string): string {
  const inner = JSON.stringify({ url: mcpUrl });
  const b64 = toBase64(inner);
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=nlqdb&config=${encodeURIComponent(b64)}`;
}

/**
 * Build the VS Code deep-link. The scheme is
 * `vscode:mcp/install?<encodeURIComponent(JSON.stringify(obj))>` — the config
 * is the WHOLE query (no named param) and URL-encoded, NOT base64 (verified
 * against code.visualstudio.com/api/extension-guides/ai/mcp). For a remote
 * server the shape is `{name, type:"http", url}`.
 */
export function buildVscodeHref(mcpUrl: string): string {
  const obj = JSON.stringify({ name: "nlqdb", type: "http", url: mcpUrl });
  return `vscode:mcp/install?${encodeURIComponent(obj)}`;
}

/**
 * Full paste-ready config docs. The shapes are host-specific:
 *   - Claude:   `mcpServers` wrapper, `url` field.
 *   - Windsurf: `mcpServers` wrapper, `serverUrl` field.
 *   - Zed:      `context_servers` wrapper, `url` field.
 *
 * All hosts connect to the FULL endpoint URL — callers must pass
 * `mcpUrl` with the protocol path included (the server serves the
 * MCP protocol at `/mcp`, not at root; see `apps/mcp/src/index.ts`).
 */
export function buildClaudeConfig(mcpUrl: string): string {
  return JSON.stringify({ mcpServers: { nlqdb: { url: mcpUrl } } }, null, 2);
}

export function buildWindsurfConfig(mcpUrl: string): string {
  return JSON.stringify({ mcpServers: { nlqdb: { serverUrl: mcpUrl } } }, null, 2);
}

export function buildZedConfig(mcpUrl: string): string {
  return JSON.stringify({ context_servers: { nlqdb: { url: mcpUrl } } }, null, 2);
}

/** Claude Code (CLI) — add a remote streamable-HTTP server in one command. */
export function buildClaudeCodeCommand(mcpUrl: string): string {
  return `claude mcp add --transport http nlqdb ${mcpUrl}`;
}

/**
 * Codex (OpenAI CLI) — remote HTTP servers are NOT addable via `codex mcp add`
 * (STDIO-only), so the install path is editing `~/.codex/config.toml`. We ship
 * the TOML table for the user to paste.
 */
export function buildCodexConfig(mcpUrl: string): string {
  return `[mcp_servers.nlqdb]\nurl = "${mcpUrl}"`;
}

export function buildMcpHosts(mcpUrl: string): readonly McpHostEntry[] {
  return [
    // Deep-link hosts (the OS hands the click to the host's URI handler).
    {
      id: "cursor",
      name: "Cursor",
      status: "deep-link",
      href: buildCursorHref(mcpUrl),
      versionHint: "Cursor (current stable, 2026+)",
    },
    {
      id: "vscode",
      name: "VS Code",
      status: "deep-link",
      href: buildVscodeHref(mcpUrl),
      versionHint: "VS Code 1.101+ (Agent Mode / MCP install link)",
    },
    // Command hosts (copy a shell command / config edit into a terminal).
    {
      id: "claude-code",
      name: "Claude Code",
      status: "command",
      command: buildClaudeCodeCommand(mcpUrl),
      pasteHint: "Run in your terminal.",
      versionHint: "Claude Code CLI (claude mcp add, 2025+)",
    },
    {
      id: "codex",
      name: "Codex",
      status: "command",
      // codex mcp add is STDIO-only — remote HTTP installs via config.toml.
      config: buildCodexConfig(mcpUrl),
      pasteHint: "Add to ~/.codex/config.toml.",
      versionHint: "Codex CLI (config.toml [mcp_servers], 2025+)",
    },
    // Fallback-only hosts (copy a paste-ready JSON config block).
    {
      id: "claude",
      name: "Claude",
      status: "fallback-only",
      config: buildClaudeConfig(mcpUrl),
      pasteHint: "Settings → Connectors → Add custom connector — paste the URL.",
      versionHint: "Claude Desktop (Custom Connectors, 2025+)",
    },
    {
      id: "windsurf",
      name: "Windsurf",
      status: "fallback-only",
      config: buildWindsurfConfig(mcpUrl),
      pasteHint: "Cascade → MCPs → Configure, or ~/.codeium/windsurf/mcp_config.json.",
      versionHint: "Windsurf (team MCP access enabled)",
    },
    {
      id: "zed",
      name: "Zed",
      status: "fallback-only",
      config: buildZedConfig(mcpUrl),
      pasteHint: "Agent Panel → Add Custom Server, or ~/.config/zed/settings.json.",
      versionHint: "Zed (any current build — no deep-link yet)",
    },
  ];
}
