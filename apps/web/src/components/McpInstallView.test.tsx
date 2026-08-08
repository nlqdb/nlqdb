// SK-WEB-016 — regression guard for the anon "Sign in (free)" nudge.
// The `/app` chat-window popover is signed-in-only (its page guard bounces
// anon visitors), so it passes `signedIn` to suppress the nudge; the
// anonymous marketing venues leave it on. A signed-in user must never see
// a "sign in" prompt in the MCP install dialog.

import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import McpInstallView from "./McpInstallView";

const SIGN_IN_NUDGE = "Sign in (free) to inline your live key";

describe("McpInstallView sign-in nudge", () => {
  it("shows the anon nudge on marketing venues (placeholder key, not signed in)", () => {
    const html = renderToStaticMarkup(<McpInstallView />);
    expect(html).toContain(SIGN_IN_NUDGE);
  });

  it("suppresses the nudge for a signed-in user even with the placeholder key", () => {
    const html = renderToStaticMarkup(<McpInstallView signedIn />);
    expect(html).not.toContain(SIGN_IN_NUDGE);
  });

  it("suppresses the nudge when a real key is inlined", () => {
    const html = renderToStaticMarkup(<McpInstallView apiKey="pk_live_realkey123" />);
    expect(html).not.toContain(SIGN_IN_NUDGE);
  });
});
