// JSON-RPC error envelope. Bare HTTP statuses render as
// "tool unavailable" in MCP hosts; this surfaces a structured message.

export function jsonRpcError(opts: {
  status: number;
  code: number;
  message: string;
  data?: Record<string, unknown>;
  headers?: Record<string, string>;
}): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: opts.code, message: opts.message, ...(opts.data && { data: opts.data }) },
      id: null,
    }),
    {
      status: opts.status,
      headers: { "content-type": "application/json; charset=utf-8", ...opts.headers },
    },
  );
}
