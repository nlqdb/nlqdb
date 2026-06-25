// SK-WEB-016 — Shared MCP-host install descriptors.
//
// Single source of truth for the deep-link URI + fallback JSON configs
// rendered by both `McpInstall.astro` (SSR) and `CreateForm.tsx`
// (post-create React island). When the research outputs change (a host
// adds a deep-link scheme, etc.) edit this file — both venues update
// together.
//
// Hosts:
//   - Claude:   fallback-only (Custom Connectors via Settings).
//   - Cursor:   deep-link `cursor://anysphere.cursor-deeplink/mcp/install`.
//   - Windsurf: fallback-only (no payload-accepting scheme).
//   - Zed:      fallback-only (no scheme shipped as of Jun 2026).

export type McpHostId = "claude" | "cursor" | "windsurf" | "zed";

export interface McpHostEntry {
  id: McpHostId;
  name: string;
  status: "deep-link" | "fallback-only";
  /** Resolved deep-link URI (only when `status === "deep-link"`). */
  href?: string;
  /** Full paste-ready JSON config (only when `status === "fallback-only"`). */
  config?: string;
  /** One sentence pointing the user at where to paste the config. */
  pasteHint?: string;
  /** Documented minimum host version, when known. */
  versionHint?: string;
}

export const PLACEHOLDER_KEY = "pk_live_REPLACE_ME";

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
 * Full paste-ready config docs. The shapes are host-specific:
 *   - Claude:   `mcpServers` wrapper, `url` field.
 *   - Windsurf: `mcpServers` wrapper, `serverUrl` field, `/mcp` suffix.
 *   - Zed:      `context_servers` wrapper, `url` field.
 */
export function buildClaudeConfig(mcpUrl: string): string {
  return JSON.stringify({ mcpServers: { nlqdb: { url: mcpUrl } } }, null, 2);
}

export function buildWindsurfConfig(mcpUrl: string): string {
  return JSON.stringify({ mcpServers: { nlqdb: { serverUrl: `${mcpUrl}/mcp` } } }, null, 2);
}

export function buildZedConfig(mcpUrl: string): string {
  return JSON.stringify({ context_servers: { nlqdb: { url: mcpUrl } } }, null, 2);
}

export function buildMcpHosts(mcpUrl: string): readonly McpHostEntry[] {
  return [
    {
      id: "claude",
      name: "Claude",
      status: "fallback-only",
      config: buildClaudeConfig(mcpUrl),
      pasteHint: "Settings → Connectors → Add custom connector — paste the URL.",
      versionHint: "Claude Desktop (Custom Connectors, 2025+)",
    },
    {
      id: "cursor",
      name: "Cursor",
      status: "deep-link",
      href: buildCursorHref(mcpUrl),
      versionHint: "Cursor (current stable, 2026+)",
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
