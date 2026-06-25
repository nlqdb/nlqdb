// SK-MCP-013 — pure helpers for the hosted-MCP OAuth consent page
// (`/oauth/mcp-authorize`).
//
// `apps/mcp`'s `/authorize` redirects the browser here with a signed
// `flow` envelope, the OAuth `client_name`, and the bridge `callback`.
// The page gates on a Better Auth session, mints a one-shot code via
// `POST /v1/oauth/mcp-callback`, then bounces the browser to the bridge
// callback (`mcp.nlqdb.com/oauth/mcp-bridge-callback?code=…&flow=…`).
// These functions are the testable core (envelope decode, the callback
// allowlist, host/device derivation); the `.astro` page owns the DOM +
// session glue.

export const BRIDGE_CALLBACK_PATH = "/oauth/mcp-bridge-callback";

// The hosted MCP Worker origin the bridge `callback` must live on.
// Overridable at build time for previews / `wrangler dev` where the MCP
// Worker lands on a different host.
export function mcpOrigin(): string {
  const fromEnv =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env["PUBLIC_MCP_ORIGIN"] as string | undefined)
      : undefined;
  return (fromEnv ?? "https://mcp.nlqdb.com").replace(/\/$/, "");
}

export type FlowPayload = {
  /** response_type */ rt: string;
  /** client_id */ ci: string;
  /** redirect_uri */ ru: string;
  /** scope */ sc: string[];
  /** state */ st: string;
  /** code_challenge */ cc?: string;
  /** code_challenge_method */ cm?: string;
};

// Decode the *payload* half of `apps/mcp`'s signed envelope
// (`<base64url(json)>.<hmac>`, see `apps/mcp/src/crypto.ts`). We can't
// verify the HMAC client-side (no secret) and we don't need to — the
// bridge callback re-verifies on `mcp.nlqdb.com` and a tampered blob
// fails there. We read only `ci/ru/st` to fill the mint body; those
// fields are stored with the one-shot code but the grant itself is
// rebuilt from the verified envelope, so a forged value can't escalate.
export function decodeFlowPayload(flow: string): FlowPayload | null {
  const dot = flow.indexOf(".");
  const payload = dot < 0 ? flow : flow.slice(0, dot);
  try {
    const json = new TextDecoder().decode(base64UrlDecode(payload));
    const parsed = JSON.parse(json) as Partial<FlowPayload>;
    if (
      typeof parsed.ci !== "string" ||
      typeof parsed.ru !== "string" ||
      typeof parsed.st !== "string"
    ) {
      return null;
    }
    return {
      rt: typeof parsed.rt === "string" ? parsed.rt : "code",
      ci: parsed.ci,
      ru: parsed.ru,
      sc: Array.isArray(parsed.sc)
        ? parsed.sc.filter((s): s is string => typeof s === "string")
        : [],
      st: parsed.st,
      ...(typeof parsed.cc === "string" ? { cc: parsed.cc } : {}),
      ...(typeof parsed.cm === "string" ? { cm: parsed.cm } : {}),
    };
  } catch {
    return null;
  }
}

// The security boundary. The consent flow sends the one-shot `code` to
// `callback`, and that code redeems (`POST /v1/oauth/mcp-callback/redeem`,
// unauthenticated, the code itself is the proof) to the user's
// `sk_mcp_*` bearer. A `callback` pointing anywhere but the trusted MCP
// origin would hand an attacker account-scoped MCP access, so we accept
// only the exact bridge-callback URL. Returns the validated URL or null.
export function validateCallback(callback: string, origin = mcpOrigin()): string | null {
  let url: URL;
  let expected: URL;
  try {
    url = new URL(callback);
    expected = new URL(BRIDGE_CALLBACK_PATH, origin);
  } catch {
    return null;
  }
  if (url.origin !== expected.origin || url.pathname !== expected.pathname) return null;
  return url.toString();
}

// Derive the `sk_mcp_<host>_…` host slug from the OAuth client's display
// name (`client_name`, e.g. "Cursor" → "cursor"). Mirrors the API's
// `normaliseSlug` (apps/api/src/api-keys.ts) + the SK-APIKEYS-004 32-char
// bound so the minted key stays valid.
const MCP_HOST_MAX = 32;
export function deriveMcpHost(clientName: string): string {
  const slug = clientName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (slug || "mcp").slice(0, MCP_HOST_MAX);
}

// Each OAuth grant mints its own `sk_mcp_<host>_<device>_*`, so the
// device slug only needs to be unique-per-grant and revocable on its own
// row. A browser consent carries no real device name, so tag it
// `oauth-<rand>`.
export function genDeviceId(randomHex: (bytes: number) => string = defaultRandomHex): string {
  return `oauth-${randomHex(3)}`;
}

// Build the bridge-callback redirect: `<callback>?code=…&flow=…`. The
// flow envelope is passed through verbatim (the bridge re-verifies it).
export function buildBridgeRedirect(callback: string, code: string, flow: string): string {
  const url = new URL(callback);
  url.searchParams.set("code", code);
  url.searchParams.set("flow", flow);
  return url.toString();
}

export function defaultRandomHex(byteCount: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteCount));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function base64UrlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(padded + "==".slice(0, (4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
