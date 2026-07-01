// SK-WEB-016 — Shared React MCP-install view. The React mirror of
// `McpInstall.astro` (the Astro component scopes its styles, so a React
// island next to it can't borrow them; we render an equivalent surface
// inline). Both venues source their URI + JSON shapes from
// `lib/mcp-install.ts` so the host descriptors stay in lockstep.
//
// Two React venues import this so they can't drift:
//   - post-create `CreateResultView` (`CreateForm.tsx`) — the wow→action
//     handoff after a successful anon create.
//   - the `/app` chat-window install popover (`McpInstallPopover.tsx`).
//
// Founder request (SK-WEB-016): clicking ANY host reveals that host's
// manual instructions in place, on top of its primary action. One panel
// open at a time keeps the one-motion-moment budget (SK-WEB-015).

import { useState } from "react";
import { emit } from "../lib/logsnag";
import {
  buildMcpHosts,
  MCP_ENDPOINT_URL,
  type McpHostEntry,
  PLACEHOLDER_KEY,
  PROMOTED_HOST,
} from "../lib/mcp-install";

interface McpInstallViewProps {
  /** Hidden the "sign in to inline your key" footnote when a real key is present. */
  apiKey?: string;
  /** Override only for staging/preview environments. */
  mcpUrl?: string;
}

export default function McpInstallView({
  apiKey = PLACEHOLDER_KEY,
  mcpUrl = MCP_ENDPOINT_URL,
}: McpInstallViewProps) {
  const hosts = buildMcpHosts(mcpUrl);
  const isPlaceholder = apiKey === PLACEHOLDER_KEY;
  // One panel open at a time (SK-WEB-015 one-motion-moment budget).
  const [openHostId, setOpenHostId] = useState<McpHostEntry["id"] | null>(null);
  return (
    <section className="mcpinstall-r" aria-label="Install in your agent">
      <p className="mcpinstall-r__eyebrow">Install in your agent.</p>
      <ul className="mcpinstall-r__row">
        {hosts.map((host) => (
          <McpHostCell
            key={host.id}
            host={host}
            open={openHostId === host.id}
            onReveal={() => setOpenHostId(host.id)}
          />
        ))}
      </ul>
      {isPlaceholder ? (
        <p className="mcpinstall-r__placeholder">
          Anonymous — the configs ship with the <code>{PLACEHOLDER_KEY}</code> placeholder.{" "}
          <a className="mcpinstall-r__signin" href="/auth/sign-in?return_to=/app">
            Sign in (free) to inline your live key →
          </a>
        </p>
      ) : null}
    </section>
  );
}

function McpHostCell({
  host,
  open,
  onReveal,
}: {
  host: McpHostEntry;
  open: boolean;
  onReveal: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const promoted = host.id === PROMOTED_HOST;
  const ctaClass = promoted ? "cta mcpinstall-r__btn" : "cta cta--ghost mcpinstall-r__btn";
  // Command hosts copy the command (or the config block, e.g. Codex's TOML).
  const copyText = host.command ?? host.config ?? "";
  const panelId = `mcpinstall-panel-${host.id}`;

  // Manual-fallback panel revealed in place on any host click.
  const panel = open ? (
    <section
      id={panelId}
      className="mcpinstall-r__panel"
      aria-label={`${host.name} manual install`}
    >
      <p className="mcpinstall-r__panel-step">
        {host.status === "deep-link"
          ? `If ${host.name} didn't open, paste this config manually:`
          : (host.pasteHint ?? `Use this in ${host.name}:`)}
      </p>
      <pre className="mcpinstall-r__panel-code">
        <code>{copyText}</code>
      </pre>
    </section>
  ) : null;

  if (host.status === "deep-link" && host.href) {
    return (
      <li className="mcpinstall-r__cell">
        <a
          className={ctaClass}
          href={host.href}
          target="_self"
          title={host.versionHint}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            // The OS handoff still fires (no preventDefault); the reveal is
            // the added behaviour for when the host doesn't open.
            onReveal();
            emit("home.snippet_copied", { surface: `mcp_install_${host.id}` });
          }}
        >
          Add to {host.name}
        </a>
        {panel}
      </li>
    );
  }
  // command + fallback-only — copy-to-clipboard, and reveal the panel.
  async function onCopy() {
    onReveal();
    if (copyText) {
      try {
        await navigator.clipboard.writeText(copyText);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      } catch {
        // Non-secure context / extension lockdown — the revealed panel
        // still shows the text for a manual copy.
      }
    }
    emit("home.snippet_copied", { surface: `mcp_install_${host.id}` });
  }
  const label = host.command ? `Copy ${host.name} command` : `Copy ${host.name} config`;
  return (
    <li className="mcpinstall-r__cell">
      <button
        type="button"
        className={ctaClass}
        title={host.versionHint}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => void onCopy()}
      >
        {copied ? "Copied ✓" : label}
      </button>
      {panel}
    </li>
  );
}
