// Pure-function tests for the OAuth bridge (`SK-MCP-013`). The signed
// state blob is the CSRF + integrity surface — it round-trips an
// OAuth `AuthRequest` through the consent screen on `app.nlqdb.com`.
// Without HMAC verification an attacker could substitute their own
// `redirectUri` or strip the PKCE challenge mid-flow.
//
// Worker-runtime behavior (handler routing, OAuthProvider integration)
// is exercised in `bearer-gate.test.ts` via the cloudflare vitest pool.

import { describe, expect, it } from "vitest";
import { signBlob, verifyBlob } from "../src/crypto.ts";
import { renderBridgeSuccessHtml } from "../src/oauth-bridge.ts";

const SECRET = "test-secret-do-not-use-in-prod";

describe("oauth-bridge signed state blob", () => {
  it("round-trips a full AuthRequest", async () => {
    const original = {
      rt: "code",
      ci: "client_xyz",
      ru: "https://host.example/callback",
      sc: ["mcp"],
      st: "csrf-token-123",
      cc: "challenge-abc",
      cm: "S256",
    };
    const signed = await signBlob(original, SECRET);
    expect(signed).not.toContain("+");
    expect(signed).not.toContain("/");
    expect(signed).not.toContain("=");
    expect(signed).toContain("."); // payload.signature
    const verified = await verifyBlob<typeof original>(signed, SECRET);
    expect(verified).toEqual(original);
  });

  it("round-trips a minimal AuthRequest (no PKCE)", async () => {
    const minimal = { rt: "code", ci: "c", ru: "https://h", sc: [], st: "" };
    const verified = await verifyBlob<typeof minimal>(await signBlob(minimal, SECRET), SECRET);
    expect(verified).toEqual(minimal);
  });

  it("rejects a tampered payload", async () => {
    const original = { rt: "code", ci: "good", ru: "https://good", sc: ["mcp"], st: "s" };
    const signed = await signBlob(original, SECRET);
    const [, sig] = signed.split(".");
    // Forge a new payload with attacker-controlled redirectUri but
    // keep the original signature.
    const tampered = { rt: "code", ci: "good", ru: "https://evil", sc: ["mcp"], st: "s" };
    const tamperedPayload = btoa(JSON.stringify(tampered))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    await expect(verifyBlob(`${tamperedPayload}.${sig}`, SECRET)).rejects.toThrow();
  });

  it("rejects a signature minted with a different secret", async () => {
    const signed = await signBlob({ a: 1 }, "secret-A");
    await expect(verifyBlob(signed, "secret-B")).rejects.toThrow();
  });

  it("rejects a blob missing the signature segment", async () => {
    await expect(verifyBlob("just-a-payload-no-dot", SECRET)).rejects.toThrow();
  });
});

// The founder-observed onboarding regression (2026-08-18): the browser
// lands on a dead localhost listener with no signal, and the user has
// no idea the flow succeeded server-side. The bridge-callback response
// carries the recovery affordance — clear success copy, the exact
// callback URL, a copy-URL button — so the user can hand the code back
// to the agent manually when the listener is gone.
describe("bridge-callback success page", () => {
  const localhost = "http://localhost:52834/callback?code=abc123&state=xyz";

  it("shows the connected state and identifies the client", () => {
    const html = renderBridgeSuccessHtml({
      redirectTo: localhost,
      hostLabel: "Claude Code",
      isHttp: true,
    });
    expect(html).toContain("You're connected.");
    expect(html).toContain("Claude Code");
  });

  it("auto-redirects to the client's callback (live-listener happy path)", () => {
    const html = renderBridgeSuccessHtml({
      redirectTo: localhost,
      hostLabel: "Claude Code",
      isHttp: true,
    });
    // meta refresh + JS redirect both target the callback URL — a live
    // listener still wins immediately, no user-visible delay. The URL
    // is HTML-escaped in the meta tag (& → &amp;) and `<`/`>`/`&` are
    // unicode-escaped in the JS string literal (defense-in-depth against
    // `</script>` breakout).
    expect(html).toContain(`http-equiv="refresh"`);
    expect(html).toContain("http://localhost:52834/callback?code=abc123&amp;state=xyz");
    expect(html).toMatch(/window\.location\.replace\(/);
    expect(html).toContain("http://localhost:52834/callback?code=abc123\\u0026state=xyz");
  });

  it("exposes the callback URL and a copy button for http(s) targets", () => {
    // Founder-reported flow: listener died, user needed to paste the URL
    // back into the agent. The fallback affordance makes that a one-click
    // action instead of "select the address bar and hope".
    const html = renderBridgeSuccessHtml({
      redirectTo: localhost,
      hostLabel: "Claude Code",
      isHttp: true,
    });
    expect(html).toContain(`id="cb-url"`);
    expect(html).toContain(`id="cb-copy"`);
    expect(html).toContain("Copy URL");
    expect(html).toMatch(/paste\s+it back/);
  });

  it("hides the copy fallback for custom-scheme redirects (cursor://, claudia://)", () => {
    // A `cursor://…` handoff can't be pasted anywhere useful — the OS
    // owns it. Hiding the copy block avoids offering a broken recovery.
    const html = renderBridgeSuccessHtml({
      redirectTo: "cursor://anysphere.cursor-mcp/oauth/callback?code=abc&state=xyz",
      hostLabel: "Cursor",
      isHttp: false,
    });
    expect(html).not.toContain(`id="cb-copy"`);
    expect(html).not.toContain("Copy URL");
    // The auto-redirect still fires — the OS hand-off is the point.
    expect(html).toContain("cursor://anysphere.cursor-mcp/oauth/callback");
  });

  it("escapes HTML in the client label and redirect URL", () => {
    // `hostLabel` comes from the OAuth client name (attacker-controllable
    // per SK-MCP-013) and `redirectTo` is round-tripped through the
    // signed blob — both must never be rendered as markup.
    const html = renderBridgeSuccessHtml({
      redirectTo: "http://localhost:1/cb?x=<script>alert(1)</script>",
      hostLabel: "<img src=x onerror=alert(1)>",
      isHttp: true,
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });
});
