// Duck-typed so the file typechecks without Nuxt's ambient globals
// at our typecheck pass.

declare const useFetch:
  | (<T>(
      url: string,
      opts?: Record<string, unknown>,
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

export async function useNlq(goal: string, opts: UseNlqOptions = {}) {
  if (typeof useFetch !== "function" || typeof useRuntimeConfig !== "function") {
    throw new Error("@nlqdb/nuxt: useNlq() must be called inside a Nuxt page or component.");
  }
  const cfg = useRuntimeConfig().public.nlqdb ?? {};
  const apiKey = opts.apiKey ?? cfg.publishableKey;
  const baseUrl = opts.baseUrl ?? cfg.apiBaseUrl ?? DEFAULT_BASE_URL;
  if (!apiKey) {
    throw new Error(
      "@nlqdb/nuxt: no publishable key. Set nuxt.config.ts nlqdb.publishableKey or pass apiKey.",
    );
  }
  return useFetch(`${baseUrl}/v1/ask`, {
    method: "POST",
    body: { goal, ...(opts.dbId ? { dbId: opts.dbId } : {}) },
    headers: { authorization: `Bearer ${apiKey}` },
  });
}
