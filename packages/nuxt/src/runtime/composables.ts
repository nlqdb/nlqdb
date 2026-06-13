// Duck-typed — keeps our typecheck pass free of Nuxt's ambient globals.
//
// GLOBAL-001: the wire layer is `@nlqdb/sdk`, never a hand-rolled `fetch`.
// We wrap `client.ask()` in Nuxt's `useAsyncData` so the result still rides
// the SSR payload (no double-fetch on hydrate) while inheriting the SDK's
// retry (SK-SDK-008), auto Idempotency-Key (SK-SDK-006), and normalized
// `NlqdbApiError` envelope (SK-SDK-002).

import { type AskResponse, createClient, type NlqClient } from "@nlqdb/sdk";

declare const useAsyncData:
  | (<T>(
      key: string,
      handler: () => Promise<T>,
    ) => Promise<{ data: { value: T | null }; error: { value: unknown } }>)
  | undefined;
declare const useRuntimeConfig:
  | (() => {
      public: { nlqdb?: { apiBaseUrl?: string; publishableKey?: string } };
    })
  | undefined;

export type UseNlqOptions = {
  /** Override the publishable key from runtimeConfig.public.nlqdb. */
  apiKey?: string;
  /** Override the API base URL from runtimeConfig.public.nlqdb. */
  baseUrl?: string;
  /** Optional database id; omit to use the goal-first auto-create path. */
  dbId?: string;
};

const DEFAULT_BASE_URL = "https://app.nlqdb.com";

// One SDK client per baseUrl+key. `createClient` is cheap, but caching keeps
// a single wire layer (and its idempotency-key reuse on retry) per endpoint.
// baseUrl can't contain a space and the key is alphanumeric, so a space is an
// unambiguous separator.
const clients = new Map<string, NlqClient>();
function clientFor(baseUrl: string, apiKey: string): NlqClient {
  const cacheKey = `${baseUrl} ${apiKey}`;
  let client = clients.get(cacheKey);
  if (!client) {
    client = createClient({ apiKey, baseUrl });
    clients.set(cacheKey, client);
  }
  return client;
}

export async function useNlq(goal: string, opts: UseNlqOptions = {}) {
  if (typeof useAsyncData !== "function" || typeof useRuntimeConfig !== "function") {
    throw new Error("@nlqdb/nuxt: useNlq() must be called inside a Nuxt page or component.");
  }
  const cfg = useRuntimeConfig().public.nlqdb ?? {};
  const apiKey = opts.apiKey ?? cfg.publishableKey;
  const baseUrl = (opts.baseUrl ?? cfg.apiBaseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  if (!apiKey) {
    throw new Error(
      "@nlqdb/nuxt: no publishable key. Set nuxt.config.ts nlqdb.publishableKey or pass apiKey.",
    );
  }
  const client = clientFor(baseUrl, apiKey);
  const key = `nlqdb:${baseUrl}:${opts.dbId ?? ""}:${goal}`;
  // `useAsyncData` dedupes on `key` and serializes the result into the SSR
  // payload; the handler throws `NlqdbApiError`, which Nuxt surfaces as
  // `error.value`, so callers keep the same `{ data, error }` shape.
  return useAsyncData<AskResponse>(key, () =>
    client.ask({ goal, ...(opts.dbId ? { dbId: opts.dbId } : {}) }),
  );
}
