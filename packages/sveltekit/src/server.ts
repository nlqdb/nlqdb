import { type AskRequest, type AskResponse, createClient, NlqdbApiError } from "@nlqdb/sdk";

export type NlqdbLoadOptions = {
  /** Server-side `sk_live_*` (NEVER pass a browser key here). */
  apiKey?: string;
  /** Override the API base URL. */
  baseUrl?: string;
  /** SvelteKit's `event.fetch` — use it so cookies forward correctly. */
  fetch?: typeof globalThis.fetch;
};

const ENV_KEY = "NLQDB_API_KEY";

export async function nlqdbLoad(
  req: AskRequest,
  opts: NlqdbLoadOptions = {},
): Promise<AskResponse> {
  const apiKey = opts.apiKey ?? process.env[ENV_KEY];
  if (!apiKey) {
    throw new Error(
      `@nlqdb/sveltekit: ${ENV_KEY} is not set. Configure it server-side or pass apiKey.`,
    );
  }
  const client = createClient({
    apiKey,
    baseUrl: opts.baseUrl,
    fetch: opts.fetch,
  });
  try {
    return await client.ask(req);
  } catch (err) {
    if (err instanceof NlqdbApiError) {
      // Plain `Error` so `+error.svelte` renders one sentence per GLOBAL-012; cause keeps the envelope.
      const e = new Error(err.message);
      (e as Error & { cause?: unknown }).cause = err;
      throw e;
    }
    throw err;
  }
}
