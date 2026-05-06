// `withCredentials: true` SDK client for the product chat surface
// (`GLOBAL-001`).

import { createClient, type NlqClient } from "@nlqdb/sdk";

let cached: NlqClient | null = null;

export function getChatClient(apiBase?: string): NlqClient {
  if (cached) return cached;
  const baseUrl = apiBase ?? readApiBase();
  cached = createClient({ baseUrl, withCredentials: true });
  return cached;
}

function readApiBase(): string {
  const fromEnv =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env["PUBLIC_API_BASE"] as string | undefined)
      : undefined;
  return fromEnv ?? "";
}
