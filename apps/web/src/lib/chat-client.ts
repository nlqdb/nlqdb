// Browser-side @nlqdb/sdk wrapper for the product chat surface.
//
// Always rides the cross-subdomain session cookie (`__Secure-session`,
// SK-WEB-006) — never a `pk_live_` / `sk_live_`. Per GLOBAL-001 every
// HTTP call goes through @nlqdb/sdk; this helper is the one place
// that materializes a `withCredentials: true` client so islands don't
// each hard-code `import.meta.env.PUBLIC_API_BASE`.

import { createClient, type NlqClient } from "@nlqdb/sdk";

let cached: NlqClient | null = null;

export function getChatClient(apiBase?: string): NlqClient {
  if (cached) return cached;
  const baseUrl = apiBase ?? readApiBase();
  cached = createClient({ baseUrl, withCredentials: true });
  return cached;
}

function readApiBase(): string {
  // Inlined at build time when present; falls back to the canonical
  // production origin so the chat works with `astro preview` too.
  const fromEnv =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env["PUBLIC_API_BASE"] as string | undefined)
      : undefined;
  return fromEnv ?? "https://app.nlqdb.com";
}
