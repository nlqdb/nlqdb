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
  // Dotted access only — Vite never inlines `import.meta.env["…"]` bracket access.
  const fromEnv = import.meta.env.PUBLIC_API_BASE as string | undefined;
  return fromEnv ?? "";
}
