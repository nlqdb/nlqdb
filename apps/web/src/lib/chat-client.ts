// Browser-side @nlqdb/sdk wrapper for the product chat surface.
//
// Post-Worksheet-1, the chat surface (`/app/*`) is served same-origin
// with the API on `app.nlqdb.com`, so the host-only session cookie
// rides automatically and `baseUrl` defaults to `""` (relative URLs
// resolve against the current origin). Per GLOBAL-001 every HTTP call
// goes through @nlqdb/sdk; this helper is the one place that
// materializes a `withCredentials: true` client so islands don't each
// hard-code `import.meta.env.PUBLIC_API_BASE`.

import { createClient, type NlqClient } from "@nlqdb/sdk";

let cached: NlqClient | null = null;

export function getChatClient(apiBase?: string): NlqClient {
  if (cached) return cached;
  const baseUrl = apiBase ?? readApiBase();
  cached = createClient({ baseUrl, withCredentials: true });
  return cached;
}

function readApiBase(): string {
  // Empty string = same origin. Build-time `PUBLIC_API_BASE` only
  // applies when an alternate API host is wanted (none today).
  const fromEnv =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env["PUBLIC_API_BASE"] as string | undefined)
      : undefined;
  return fromEnv ?? "";
}
