// Cross-Worker bridge for the hosted MCP OAuth flow (SK-MCP-013) and
// the DO revalidation probe (SK-MCP-014).
//
// Two endpoints:
//
// `POST /v1/oauth/mcp-callback` (session-gated):
//   `apps/mcp/`'s `defaultHandler` redirects the user-agent to
//   `app.nlqdb.com/oauth/mcp-authorize` (a page hosted by `apps/web`).
//   That page rides the Better Auth cookie. When the user clicks
//   "Approve", the page POSTs here:
//     1. Authenticated via `requireSession` (cookie).
//     2. Validate the OAuth context fields (`client_id`,
//        `redirect_uri`, `state`).
//     3. Mint a one-shot code (16-byte hex) + the bound `sk_mcp_*`
//        plaintext, stash both in KV with a 60 s TTL.
//     4. Return the code to the web page. The page redirects the
//        browser to `mcp.nlqdb.com/oauth/mcp-bridge-callback?code=…`.
//
// `POST /v1/oauth/mcp-callback/redeem` (code-gated):
//   Called Worker-to-Worker by `apps/mcp/`'s bridge callback. The
//   one-shot code itself is the auth proof (128-bit random, 60 s
//   TTL, one-shot delete-on-read). Returns the bound `sk_mcp_*`
//   plaintext + claims so `apps/mcp/` can hand them to
//   `OAuthProvider.completeAuthorization` as the grant's `props`.
//
// `Idempotency-Key` (GLOBAL-005) — required on the mint mutation.
// Replay returns the same code from KV; the dedup key is the
// request header. The code is one-shot at redemption — re-redeeming
// the same code is rejected by `redeemBridgeCode`.

import type { Context } from "hono";
import type { Session } from "./middleware.ts";

export const BRIDGE_CODE_TTL_SECONDS = 60;
const BRIDGE_CODE_PREFIX = "mcp-oauth-bridge:";
const IDEMP_KEY_PREFIX = "mcp-oauth-bridge-idemp:";
const IDEMP_TTL_SECONDS = BRIDGE_CODE_TTL_SECONDS;

// Same bounds as `POST /v1/keys` so the resulting `sk_mcp_*` key stays
// shaped per `SK-APIKEYS-004` / `mintSkMcpKey`.
const MCP_HOST_MAX = 32;
const DEVICE_ID_MAX = 64;
const CLIENT_ID_MAX = 64;
const REDIRECT_URI_MAX = 512;
const OAUTH_STATE_MAX = 256;

export type BridgeRequestBody = {
  client_id: string;
  redirect_uri: string;
  state: string;
  mcp_host: string;
  device_id: string;
};

export type BridgeStoredCode = {
  user_id: string;
  mcp_host: string;
  device_id: string;
  client_id: string;
  redirect_uri: string;
  state: string;
  expires_at: number;
  // Plaintext `sk_mcp_<host>_<device>_*` minted at the same time as
  // the code. Lives in KV only for the 60 s TTL — the HMAC hash is
  // already in D1 (`api_keys.key_hash`); the plaintext is destroyed
  // when the redemption fires (`delete-on-read`) or when KV expires
  // the row, whichever is first.
  bearer: string;
  // HMAC-SHA256 hex of `bearer` for the DO revalidation probe path
  // (`SK-MCP-014`). The DO never holds the plaintext alone — it
  // always pairs the bearer with this hash so probe paths don't
  // re-HMAC every 1 s.
  bearer_hash: string;
};

export type BridgeMintResult = { code: string; expires_in: number };

export type BridgeDeps = {
  kv: KVNamespace;
  randomHex: (bytes: number) => string;
  now: () => number;
  mintKey: (
    userId: string,
    mcpHost: string,
    deviceId: string,
  ) => Promise<{ plaintext: string; hash: string }>;
};

// Validates and parses the incoming JSON body. Returns an `Err` shape
// the route handler can return verbatim.
export function parseBridgeBody(
  raw: unknown,
): { ok: true; body: BridgeRequestBody } | { ok: false; status: 400; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, status: 400, error: "invalid_json" };
  }
  const b = raw as Record<string, unknown>;
  const clientId = typeof b["client_id"] === "string" ? b["client_id"].trim() : "";
  const redirectUri = typeof b["redirect_uri"] === "string" ? b["redirect_uri"].trim() : "";
  const state = typeof b["state"] === "string" ? b["state"] : "";
  const mcpHost = typeof b["mcp_host"] === "string" ? b["mcp_host"].trim() : "";
  const deviceId = typeof b["device_id"] === "string" ? b["device_id"].trim() : "";

  if (!clientId || clientId.length > CLIENT_ID_MAX) {
    return { ok: false, status: 400, error: "invalid_client_id" };
  }
  if (!redirectUri || redirectUri.length > REDIRECT_URI_MAX) {
    return { ok: false, status: 400, error: "invalid_redirect_uri" };
  }
  // `state` is opaque to us — we round-trip it back to the OAuth
  // client. Empty is a CSRF defense bypass and gets rejected.
  if (!state || state.length > OAUTH_STATE_MAX) {
    return { ok: false, status: 400, error: "invalid_state" };
  }
  if (!mcpHost || mcpHost.length > MCP_HOST_MAX) {
    return { ok: false, status: 400, error: "invalid_mcp_host" };
  }
  if (!deviceId || deviceId.length > DEVICE_ID_MAX) {
    return { ok: false, status: 400, error: "invalid_device_id" };
  }
  return {
    ok: true,
    body: {
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      mcp_host: mcpHost,
      device_id: deviceId,
    },
  };
}

// Mints + persists the one-shot code AND the `sk_mcp_*` plaintext it
// gates. Honors `Idempotency-Key` by keying on
// `(user_id, idempotency_key)` per `SK-IDEMP-002`. On replay, returns
// the same code — the underlying KV value (including the bearer
// plaintext) is still live for the original TTL, so the consent screen
// can survive a network retry without re-minting a fresh key.
export async function mintBridgeCode(
  userId: string,
  body: BridgeRequestBody,
  idempotencyKey: string | null,
  deps: BridgeDeps,
): Promise<BridgeMintResult> {
  if (idempotencyKey) {
    const idempKey = `${IDEMP_KEY_PREFIX}${userId}:${idempotencyKey}`;
    const previousCode = await deps.kv.get(idempKey);
    if (previousCode) {
      return { code: previousCode, expires_in: BRIDGE_CODE_TTL_SECONDS };
    }
    const stored = await mintStoredCode(userId, body, deps);
    const code = deps.randomHex(16);
    await deps.kv.put(`${BRIDGE_CODE_PREFIX}${code}`, JSON.stringify(stored), {
      expirationTtl: BRIDGE_CODE_TTL_SECONDS,
    });
    await deps.kv.put(idempKey, code, { expirationTtl: IDEMP_TTL_SECONDS });
    return { code, expires_in: BRIDGE_CODE_TTL_SECONDS };
  }
  const stored = await mintStoredCode(userId, body, deps);
  const code = deps.randomHex(16);
  await deps.kv.put(`${BRIDGE_CODE_PREFIX}${code}`, JSON.stringify(stored), {
    expirationTtl: BRIDGE_CODE_TTL_SECONDS,
  });
  return { code, expires_in: BRIDGE_CODE_TTL_SECONDS };
}

async function mintStoredCode(
  userId: string,
  body: BridgeRequestBody,
  deps: BridgeDeps,
): Promise<BridgeStoredCode> {
  const minted = await deps.mintKey(userId, body.mcp_host, body.device_id);
  return {
    user_id: userId,
    mcp_host: body.mcp_host,
    device_id: body.device_id,
    client_id: body.client_id,
    redirect_uri: body.redirect_uri,
    state: body.state,
    expires_at: deps.now() + BRIDGE_CODE_TTL_SECONDS,
    bearer: minted.plaintext,
    bearer_hash: minted.hash,
  };
}

// One-shot redemption. Deletes on read so a second redemption of the
// same code fails. Returns null on miss or expiry.
export async function redeemBridgeCode(
  code: string,
  kv: KVNamespace,
  now: number,
): Promise<BridgeStoredCode | null> {
  const raw = await kv.get(`${BRIDGE_CODE_PREFIX}${code}`);
  if (!raw) return null;
  let parsed: BridgeStoredCode;
  try {
    parsed = JSON.parse(raw) as BridgeStoredCode;
  } catch {
    return null;
  }
  // Best-effort delete — the TTL is 60 s, so a partial cleanup just
  // means the next retry hits the same delete; both are no-ops.
  await kv.delete(`${BRIDGE_CODE_PREFIX}${code}`);
  if (parsed.expires_at < now) return null;
  return parsed;
}

// Hex-encoded random bytes — separate so callers can inject a
// deterministic generator under test.
export function defaultRandomHex(byteCount: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteCount));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Inputs to the callback handler. The caller (the route in
// `apps/api/src/index.ts`) walks through `requireSession` first, then
// drops into this function with its already-resolved `session`. We
// take the Hono `Context` and `Session` directly rather than build a
// factory of `MiddlewareHandler<...>` so the surrounding route's
// Hono generics (`Bindings`, the full `Variables` union) don't have
// to flow through a narrower handler type.
export type McpCallbackHandlerOpts = {
  // biome-ignore lint/suspicious/noExplicitAny: handlers operate on the route's untyped Context
  kv: (c: Context<any>) => KVNamespace;
  mintKey: (
    // biome-ignore lint/suspicious/noExplicitAny: see kv comment
    c: Context<any>,
    userId: string,
    mcpHost: string,
    deviceId: string,
  ) => Promise<{ plaintext: string; hash: string }>;
  // biome-ignore lint/suspicious/noExplicitAny: see kv comment
  setOutcome?: (c: Context<any>, outcome: string) => void;
};

export async function handleMcpCallback(
  // biome-ignore lint/suspicious/noExplicitAny: see McpCallbackHandlerOpts.kv comment
  c: Context<any>,
  session: Session,
  opts: McpCallbackHandlerOpts,
): Promise<Response> {
  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    opts.setOutcome?.(c, "invalid_json");
    return c.json({ error: "invalid_json" }, 400);
  }
  const parsed = parseBridgeBody(rawBody);
  if (!parsed.ok) {
    opts.setOutcome?.(c, parsed.error);
    return c.json({ error: parsed.error }, parsed.status);
  }
  const idempotencyKey = c.req.header("idempotency-key") ?? null;
  const result = await mintBridgeCode(session.user.id, parsed.body, idempotencyKey, {
    kv: opts.kv(c),
    randomHex: defaultRandomHex,
    now: () => Math.floor(Date.now() / 1000),
    mintKey: (userId, mcpHost, deviceId) => opts.mintKey(c, userId, mcpHost, deviceId),
  });
  opts.setOutcome?.(c, "ok");
  return c.json(result);
}

// Code-gated redemption handler. The one-shot code is itself the
// auth proof — 128-bit random, 60 s TTL, delete-on-read. We never
// expose this endpoint cookie-gated because the caller is
// `apps/mcp/`, a sibling Worker without the user's session.
export type RedeemHandlerOpts = {
  // biome-ignore lint/suspicious/noExplicitAny: handlers operate on the route's untyped Context
  kv: (c: Context<any>) => KVNamespace;
  // biome-ignore lint/suspicious/noExplicitAny: see kv comment
  setOutcome?: (c: Context<any>, outcome: string) => void;
};

export async function handleMcpCallbackRedeem(
  // biome-ignore lint/suspicious/noExplicitAny: see RedeemHandlerOpts.kv comment
  c: Context<any>,
  opts: RedeemHandlerOpts,
): Promise<Response> {
  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    opts.setOutcome?.(c, "invalid_json");
    return c.json({ error: "invalid_json" }, 400);
  }
  if (!rawBody || typeof rawBody !== "object") {
    opts.setOutcome?.(c, "invalid_json");
    return c.json({ error: "invalid_json" }, 400);
  }
  const code = (rawBody as { code?: unknown }).code;
  if (typeof code !== "string" || code.length !== 32 || !/^[0-9a-f]+$/.test(code)) {
    opts.setOutcome?.(c, "invalid_code");
    return c.json({ error: "invalid_code" }, 400);
  }
  const stored = await redeemBridgeCode(code, opts.kv(c), Math.floor(Date.now() / 1000));
  if (!stored) {
    opts.setOutcome?.(c, "not_found");
    return c.json({ error: "not_found" }, 404);
  }
  opts.setOutcome?.(c, "ok");
  return c.json({
    user_id: stored.user_id,
    mcp_host: stored.mcp_host,
    device_id: stored.device_id,
    client_id: stored.client_id,
    redirect_uri: stored.redirect_uri,
    state: stored.state,
    bearer: stored.bearer,
    bearer_hash: stored.bearer_hash,
  });
}
