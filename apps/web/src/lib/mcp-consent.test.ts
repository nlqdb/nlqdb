import { describe, expect, test } from "bun:test";
import {
  buildBridgeRedirect,
  decodeFlowPayload,
  deriveMcpHost,
  genDeviceId,
  validateCallback,
} from "./mcp-consent.ts";

// SK-MCP-013 — the consent page is the user-facing half of the OAuth
// bridge; these guard the security-sensitive pure logic (callback
// allowlist, envelope decode) that the `.astro` page can't easily test.

// A flow envelope matching `apps/mcp/src/crypto.ts`'s `signBlob`:
// `base64url(JSON).<sig>`. The sig is opaque to us (no secret) — we only
// decode the payload, so any trailing `.<sig>` works for the test.
function makeFlow(payload: unknown): string {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${b64}.fakesignaturebytes`;
}

describe("decodeFlowPayload", () => {
  test("decodes the real Cursor envelope shape", () => {
    const flow = makeFlow({
      rt: "code",
      ci: "1VoEOuC_9mN4OyYj",
      ru: "cursor://anysphere.cursor-mcp/oauth/callback",
      sc: ["mcp"],
      st: "opaque-state",
      cc: "XAWoQAcqOEjmFehCpE0PvY4gkFbpzrKWtKah3F7OdKk",
      cm: "S256",
    });
    const payload = decodeFlowPayload(flow);
    expect(payload).not.toBeNull();
    expect(payload?.ci).toBe("1VoEOuC_9mN4OyYj");
    expect(payload?.ru).toBe("cursor://anysphere.cursor-mcp/oauth/callback");
    expect(payload?.st).toBe("opaque-state");
    expect(payload?.cc).toBe("XAWoQAcqOEjmFehCpE0PvY4gkFbpzrKWtKah3F7OdKk");
    expect(payload?.cm).toBe("S256");
  });

  test("defaults scope to [] and rt to 'code' when absent", () => {
    const payload = decodeFlowPayload(makeFlow({ ci: "c", ru: "https://x/cb", st: "s" }));
    expect(payload?.sc).toEqual([]);
    expect(payload?.rt).toBe("code");
    expect(payload?.cc).toBeUndefined();
  });

  test("rejects payloads missing required fields", () => {
    expect(decodeFlowPayload(makeFlow({ ci: "c", ru: "https://x/cb" }))).toBeNull();
    expect(decodeFlowPayload(makeFlow({ st: "s" }))).toBeNull();
  });

  test("rejects non-base64url / non-JSON garbage", () => {
    expect(decodeFlowPayload("not-base64url!!!.sig")).toBeNull();
    expect(decodeFlowPayload("")).toBeNull();
  });
});

describe("validateCallback", () => {
  const ORIGIN = "https://mcp.nlqdb.com";

  test("accepts the exact bridge callback on the trusted origin", () => {
    const ok = validateCallback("https://mcp.nlqdb.com/oauth/mcp-bridge-callback", ORIGIN);
    expect(ok).toBe("https://mcp.nlqdb.com/oauth/mcp-bridge-callback");
  });

  test("rejects a foreign origin (code-exfiltration attempt)", () => {
    expect(validateCallback("https://evil.com/oauth/mcp-bridge-callback", ORIGIN)).toBeNull();
    expect(
      validateCallback("https://mcp.nlqdb.com.evil.com/oauth/mcp-bridge-callback", ORIGIN),
    ).toBeNull();
  });

  test("rejects the wrong path on the right origin", () => {
    expect(validateCallback("https://mcp.nlqdb.com/oauth/steal", ORIGIN)).toBeNull();
  });

  test("rejects a non-URL", () => {
    expect(validateCallback("/oauth/mcp-bridge-callback", ORIGIN)).toBeNull();
    expect(validateCallback("", ORIGIN)).toBeNull();
  });

  test("canonicalizes — strips any tag-along query/fragment", () => {
    expect(
      validateCallback("https://mcp.nlqdb.com/oauth/mcp-bridge-callback?x=1#frag", ORIGIN),
    ).toBe("https://mcp.nlqdb.com/oauth/mcp-bridge-callback");
  });

  test("honors a preview MCP origin override", () => {
    const ok = validateCallback(
      "https://x-nlqdb-mcp.workers.dev/oauth/mcp-bridge-callback",
      "https://x-nlqdb-mcp.workers.dev",
    );
    expect(ok).toBe("https://x-nlqdb-mcp.workers.dev/oauth/mcp-bridge-callback");
  });
});

describe("deriveMcpHost", () => {
  test("slugifies the client name like the API's normaliseSlug", () => {
    expect(deriveMcpHost("Cursor")).toBe("cursor");
    expect(deriveMcpHost("Claude Desktop")).toBe("claude-desktop");
    expect(deriveMcpHost("  VS Code  ")).toBe("vs-code");
  });

  test("falls back to 'mcp' for an empty slug", () => {
    expect(deriveMcpHost("")).toBe("mcp");
    expect(deriveMcpHost("!!!")).toBe("mcp");
  });

  test("caps the slug at the SK-APIKEYS-004 32-char bound", () => {
    expect(deriveMcpHost("a".repeat(80)).length).toBe(32);
  });
});

describe("genDeviceId", () => {
  test("tags the device as a per-grant oauth slug", () => {
    expect(genDeviceId(() => "abcdef")).toBe("oauth-abcdef");
  });
});

describe("buildBridgeRedirect", () => {
  test("appends code + flow to the validated callback", () => {
    const url = new URL(
      buildBridgeRedirect(
        "https://mcp.nlqdb.com/oauth/mcp-bridge-callback",
        "deadbeef",
        "payload.sig",
      ),
    );
    expect(url.origin).toBe("https://mcp.nlqdb.com");
    expect(url.pathname).toBe("/oauth/mcp-bridge-callback");
    expect(url.searchParams.get("code")).toBe("deadbeef");
    expect(url.searchParams.get("flow")).toBe("payload.sig");
  });
});
