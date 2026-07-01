// SK-WEB-016 — MCP install affordance on the `/app` chat window (the
// fourth React venue after Door A / post-create; the Astro `<McpInstall>`
// covers the marketing venues). A trigger button in the LeftRail header
// opens a focus-trapped dialog holding the shared `<McpInstallView>` —
// the same host buttons + click→reveal-in-place behaviour as every other
// venue, sourced from `lib/mcp-install.ts` so it can't drift.
//
// Accessibility: the trigger carries `aria-expanded` + `aria-haspopup`;
// the popover is `role="dialog"` `aria-modal`, focus-trapped and
// Escape-to-close (shared `useFocusTrap` from `lib/dialog`, the same hook
// LeftRail's delete dialog uses), click-outside-to-close via a scrim, and
// restores focus to the trigger on close (`useRestoreFocusOnUnmount`).
//
// The hosted MCP (mcp.nlqdb.com) authenticates via OAuth, so the
// placeholder-key default is correct here — the sign-in nudge in the
// shared view still points at inlining a per-DB `pk_live_` for element
// embeds, matching Door A / `/integrations`.

import { useEffect, useRef, useState } from "react";
import { useFocusTrap, useRestoreFocusOnUnmount } from "../../lib/dialog";
import McpInstallView from "../McpInstallView";

export default function McpInstallPopover() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="left-rail__mcp-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        Install MCP
      </button>
      {open ? <McpInstallDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function McpInstallDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useRestoreFocusOnUnmount(() =>
    typeof document === "undefined"
      ? null
      : document.querySelector<HTMLElement>(".left-rail__mcp-trigger"),
  );
  useFocusTrap(dialogRef, { onEscape: onClose });
  // Move focus inside the modal on open (the trigger it covers is no
  // longer reachable) so keyboard + screen-reader users start in-dialog.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <div className="mcp-popover__backdrop">
      {/* Click-outside-to-close scrim as a real <button> (matches the
          Cmd+K palette's `.palette__scrim`) so the dismiss target is a
          proper interactive element, not a static div with a handler. */}
      <button
        type="button"
        className="mcp-popover__scrim"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        className="mcp-popover"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mcp-popover-title"
        ref={dialogRef}
      >
        <header className="mcp-popover__head">
          <h2 className="mcp-popover__title" id="mcp-popover-title">
            Install nlqdb MCP
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="mcp-popover__close"
            aria-label="Close"
            onClick={onClose}
          >
            &times;
          </button>
        </header>
        <p className="mcp-popover__lede">
          Give your agent a database it can talk to. Pick your tool — Cursor and Claude are one
          click.
        </p>
        <McpInstallView />
      </div>
    </div>
  );
}
