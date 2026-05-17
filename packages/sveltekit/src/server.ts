// SvelteKit `+page.server.ts` / `+layout.server.ts` helpers. The
// shape mirrors `load()` so SSR responses ride SvelteKit's payload
// and the client doesn't refetch on hydration.

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
      // SvelteKit's `+error.svelte` shows `error.message` directly —
      // GLOBAL-012 says that's one sentence with the next action.
      const e = new Error(err.message);
      (e as Error & { cause?: unknown }).cause = err;
      throw e;
    }
    throw err;
  }
}
