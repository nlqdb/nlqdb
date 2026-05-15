// Prefix-shape gate — fast-rejects malformed bearers. Auth-of-record
// (revocation, scope, origin) is `apps/api/` per `SK-MCP-005`.

// `pk_live_` is read-only (`SK-APIKEYS-003`); `sk_live_` / `sk_mcp_`
// unlock the full tool surface (`SK-MCP-004`).
const KEY_PREFIXES = ["sk_live_", "sk_mcp_", "pk_live_"] as const;

export type BearerGate = { ok: string } | { err: Response };

export function requireBearer(req: Request): BearerGate {
  const bearer = extractBearer(req);
  if (!bearer) {
    return {
      err: authRequired(
        "missing_bearer",
        "Missing Authorization: Bearer header.",
        "Mint a key at https://app.nlqdb.com/keys and configure it on this connector.",
      ),
    };
  }
  if (!KEY_PREFIXES.some((p) => bearer.startsWith(p))) {
    return {
      err: authRequired(
        "bearer_prefix_unrecognised",
        "Bearer doesn't match a known nlqdb key prefix.",
        "Use a sk_live_, sk_mcp_, or pk_live_ key from https://app.nlqdb.com/keys.",
      ),
    };
  }
  return { ok: bearer };
}

function extractBearer(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(\S+)$/i.exec(auth);
  return m?.[1] ?? null;
}

// `SK-MCP-006` envelope — host LLM renders `action` as the next step.
function authRequired(code: string, message: string, action: string): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32001, message, data: { code, action } },
      id: null,
    }),
    {
      status: 401,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "www-authenticate": 'Bearer realm="nlqdb-mcp"',
      },
    },
  );
}
