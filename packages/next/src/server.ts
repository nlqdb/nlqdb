// `server-only` fails the build if this module is imported from a Client Component.

import "server-only";
import { type AskRequest, createClient, type NlqClient, NlqdbApiError } from "@nlqdb/sdk";

export type NlqdbServerOptions = {
  apiKey?: string;
  baseUrl?: string;
};

const ENV_KEY = "NLQDB_API_KEY";

export function nlqdbServer(opts: NlqdbServerOptions = {}): NlqClient {
  const apiKey = opts.apiKey ?? process.env[ENV_KEY];
  if (!apiKey) {
    throw new Error(
      `@nlqdb/next: ${ENV_KEY} is not set. Set it in .env.local (server-only) or pass apiKey to nlqdbServer().`,
    );
  }
  return createClient({ apiKey, baseUrl: opts.baseUrl });
}

// Lazy single client — defers the env-var read until first request reaches the route.
export function createAskRoute(opts: NlqdbServerOptions = {}) {
  let client: NlqClient | null = null;
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
    client ??= nlqdbServer(opts);
    try {
      const out = await client.ask(body, { signal: req.signal });
      return Response.json(out);
    } catch (err) {
      if (err instanceof NlqdbApiError) {
        // Emit the canonical API envelope unchanged (GLOBAL-002 parity) — no
        // `err.message` rewrite. `err.body` already carries `status`; if it
        // carries a `message`, it passes through. The SDK's debug-text
        // `err.message` stays out of the wire shape.
        return Response.json(
          { error: { status: err.code, ...(err.body ?? {}) } },
          { status: err.httpStatus || 500 },
        );
      }
      throw err;
    }
  };
}
