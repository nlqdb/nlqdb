// Cross-Worker bridge for the hosted MCP OAuth flow (`SK-MCP-013`).
// `POST /v1/oauth/mcp-callback` (session-gated) mints a one-shot code
// + the bound `sk_mcp_*` plaintext, both stashed in KV with a 60 s TTL.
// `POST /v1/oauth/mcp-callback/redeem` (code-gated) returns them once;
// delete-on-read makes the code single-use.

import type { Context } from "hono";
import type { Session } from "./middleware.ts";

export const BRIDGE_CODE_TTL_SECONDS = 60;
const BRIDGE_CODE_PREFIX = "mcp-oauth-bridge:";
const IDEMP_KEY_PREFIX = "mcp-oauth-bridge-idemp:";
const CODE_HEX_BYTES = 16;
const CODE_HEX_LENGTH = CODE_HEX_BYTES * 2;

// Match `POST /v1/keys` bounds so the minted `sk_mcp_*` stays valid per `SK-APIKEYS-004`.
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
  bearer: string;
  bearer_hash: string;
};

export type BridgeMintResult = { code: string; expires_in: number };

export type BridgeDeps = {
  kv: KVNamespace;
  randomHex: (bytes: number) => string;
  mintKey: (
    userId: string,
    mcpHost: string,
    deviceId: string,
  ) => Promise<{ plaintext: string; hash: string }>;
};

type ParseResult =
  | { ok: true; body: BridgeRequestBody }
  | { ok: false; status: 400; error: string };

export function parseBridgeBody(raw: unknown): ParseResult {
  if (!raw || typeof raw !== "object") return fail("invalid_json");
  const b = raw as Record<string, unknown>;
  const clientId = trimmedString(b["client_id"]);
  const redirectUri = trimmedString(b["redirect_uri"]);
  const state = typeof b["state"] === "string" ? b["state"] : "";
  const mcpHost = trimmedString(b["mcp_host"]);
  const deviceId = trimmedString(b["device_id"]);

  if (!clientId || clientId.length > CLIENT_ID_MAX) return fail("invalid_client_id");
  if (!redirectUri || redirectUri.length > REDIRECT_URI_MAX) return fail("invalid_redirect_uri");
  if (!state || state.length > OAUTH_STATE_MAX) return fail("invalid_state");
  if (!mcpHost || mcpHost.length > MCP_HOST_MAX) return fail("invalid_mcp_host");
  if (!deviceId || deviceId.length > DEVICE_ID_MAX) return fail("invalid_device_id");
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

function fail(error: string): ParseResult {
  return { ok: false, status: 400, error };
}

function trimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

// Honors `Idempotency-Key` per `GLOBAL-005`: replay returns the
// already-minted code so the consent screen survives network retries
// without re-minting a fresh `sk_mcp_*`.
export async function mintBridgeCode(
  userId: string,
  body: BridgeRequestBody,
  idempotencyKey: string | null,
  deps: BridgeDeps,
): Promise<BridgeMintResult> {
  const idempKey = idempotencyKey ? `${IDEMP_KEY_PREFIX}${userId}:${idempotencyKey}` : null;
  if (idempKey) {
    const previousCode = await deps.kv.get(idempKey);
    if (previousCode) return { code: previousCode, expires_in: BRIDGE_CODE_TTL_SECONDS };
  }
  const stored = await mintStoredCode(userId, body, deps);
  const code = deps.randomHex(CODE_HEX_BYTES);
  await deps.kv.put(`${BRIDGE_CODE_PREFIX}${code}`, JSON.stringify(stored), {
    expirationTtl: BRIDGE_CODE_TTL_SECONDS,
  });
  if (idempKey) {
    await deps.kv.put(idempKey, code, { expirationTtl: BRIDGE_CODE_TTL_SECONDS });
  }
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
    bearer: minted.plaintext,
    bearer_hash: minted.hash,
  };
}

// Single-use: delete-on-read so a replay misses. KV TTL enforces expiry.
export async function redeemBridgeCode(
  code: string,
  kv: KVNamespace,
): Promise<BridgeStoredCode | null> {
  const raw = await kv.get(`${BRIDGE_CODE_PREFIX}${code}`);
  if (!raw) return null;
  await kv.delete(`${BRIDGE_CODE_PREFIX}${code}`);
  try {
    return JSON.parse(raw) as BridgeStoredCode;
  } catch {
    return null;
  }
}

export function defaultRandomHex(byteCount: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteCount));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// biome-ignore lint/suspicious/noExplicitAny: route Context type varies per call site
type RouteContext = Context<any>;

export type McpCallbackHandlerOpts = {
  kv: (c: RouteContext) => KVNamespace;
  mintKey: (
    c: RouteContext,
    userId: string,
    mcpHost: string,
    deviceId: string,
  ) => Promise<{ plaintext: string; hash: string }>;
  setOutcome?: (c: RouteContext, outcome: string) => void;
};

export async function handleMcpCallback(
  c: RouteContext,
  session: Session,
  opts: McpCallbackHandlerOpts,
): Promise<Response> {
  const body = await readJsonBody(c, opts.setOutcome);
  if ("error" in body) return body.response;
  const parsed = parseBridgeBody(body.value);
  if (!parsed.ok) {
    opts.setOutcome?.(c, parsed.error);
    return c.json({ error: parsed.error }, parsed.status);
  }
  const idempotencyKey = c.req.header("idempotency-key") ?? null;
  const result = await mintBridgeCode(session.user.id, parsed.body, idempotencyKey, {
    kv: opts.kv(c),
    randomHex: defaultRandomHex,
    mintKey: (userId, mcpHost, deviceId) => opts.mintKey(c, userId, mcpHost, deviceId),
  });
  opts.setOutcome?.(c, "ok");
  return c.json(result);
}

export type RedeemHandlerOpts = {
  kv: (c: RouteContext) => KVNamespace;
  setOutcome?: (c: RouteContext, outcome: string) => void;
};

export async function handleMcpCallbackRedeem(
  c: RouteContext,
  opts: RedeemHandlerOpts,
): Promise<Response> {
  const body = await readJsonBody(c, opts.setOutcome);
  if ("error" in body) return body.response;
  const code = (body.value as { code?: unknown }).code;
  if (typeof code !== "string" || code.length !== CODE_HEX_LENGTH || !/^[0-9a-f]+$/.test(code)) {
    opts.setOutcome?.(c, "invalid_code");
    return c.json({ error: "invalid_code" }, 400);
  }
  const stored = await redeemBridgeCode(code, opts.kv(c));
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

type JsonBodyResult = { value: unknown } | { error: "invalid_json"; response: Response };

async function readJsonBody(
  c: RouteContext,
  setOutcome?: (c: RouteContext, outcome: string) => void,
): Promise<JsonBodyResult> {
  try {
    const value = await c.req.json();
    if (!value || typeof value !== "object") {
      setOutcome?.(c, "invalid_json");
      return { error: "invalid_json", response: c.json({ error: "invalid_json" }, 400) };
    }
    return { value };
  } catch {
    setOutcome?.(c, "invalid_json");
    return { error: "invalid_json", response: c.json({ error: "invalid_json" }, 400) };
  }
}
