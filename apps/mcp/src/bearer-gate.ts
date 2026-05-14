// Bearer auth gate for the hosted MCP Worker. Fast-rejects bearers
// missing or shape-wrong before the request reaches MCP dispatch.
// Auth-of-record stays in `apps/api/` per `SK-MCP-005`; this gate
// only checks the prefix shape so the upstream API enforces
// revocation, scope, and origin.

// `pk_live_` works for `nlqdb_query` only (read-only + origin-pinned
// per `SK-APIKEYS-003`); `sk_live_` and `sk_mcp_` unlock the full
// surface including `nlqdb_list_databases` and `nlqdb_describe`
// (`SK-MCP-004`).
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

// `SK-MCP-006` envelope: `{ code, message, action }` inside a JSON-RPC
// error body so MCP-spec clients render the next-step instruction
// instead of a generic "tool unavailable".
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
