// `import "server-only"` fails the build if this module is imported
// from a Client Component — keeps `sk_live_*` on the server boundary
// by construction.

import "server-only";
import { type AskRequest, createClient, type NlqClient, NlqdbApiError } from "@nlqdb/sdk";

export type NlqdbServerOptions = {
  apiKey?: string;
  baseUrl?: string;
};

const ENV_KEY = "NLQDB_API_KEY";

// Throws on missing key — surfacing a misconfiguration at boot is
// better than 401s in production.
export function nlqdbServer(opts: NlqdbServerOptions = {}): NlqClient {
  const apiKey = opts.apiKey ?? process.env[ENV_KEY];
  if (!apiKey) {
    throw new Error(
      `@nlqdb/next: ${ENV_KEY} is not set. Set it in .env.local (server-only) or pass apiKey to nlqdbServer().`,
    );
  }
  return createClient({ apiKey, baseUrl: opts.baseUrl });
}

// Forwards `Idempotency-Key` if the caller supplied one; otherwise
// the SDK auto-mints per SK-SDK-006.
export function createAskRoute(opts: NlqdbServerOptions = {}) {
  return async function POST(req: Request): Promise<Response> {
    let body: AskRequest;
    try {
      body = (await req.json()) as AskRequest;
    } catch {
      return Response.json(
        { error: { status: "invalid_json", message: "request body is not valid JSON" } },
        { status: 400 },
      );
    }
    const idempotencyKey = req.headers.get("idempotency-key") ?? undefined;
    const client = nlqdbServer(opts);
    try {
      const out = await client.ask(body, { signal: req.signal });
      const headers: HeadersInit = idempotencyKey ? { "idempotency-key": idempotencyKey } : {};
      return Response.json(out, { headers });
    } catch (err) {
      if (err instanceof NlqdbApiError) {
        return Response.json(
          { error: { status: err.code, message: err.message, ...(err.body ?? {}) } },
          { status: err.httpStatus || 500 },
        );
      }
      throw err;
    }
  };
}
