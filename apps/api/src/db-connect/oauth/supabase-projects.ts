// List a user's Supabase projects — the picker source for the connect flow.
// `GET /v1/projects` with the OAuth access token. Returns the fields the picker
// needs (ref + display name + region).

import { SupabaseOAuthError } from "./supabase-oauth.ts";

const SUPABASE_API_BASE = "https://api.supabase.com";

export type SupabaseProject = { ref: string; name: string; region: string };

export async function listSupabaseProjects(
  accessToken: string,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<SupabaseProject[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const res = await fetchImpl(`${SUPABASE_API_BASE}/v1/projects`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new SupabaseOAuthError(
      `Supabase could not list your projects (HTTP ${res.status}); start the connect again.`,
      res.status,
    );
  }
  const json = (await res.json()) as Array<{
    id?: string;
    ref?: string;
    name?: string;
    region?: string;
  }>;
  return (Array.isArray(json) ? json : [])
    .map((p) => ({
      ref: p.ref ?? p.id ?? "",
      name: p.name ?? p.ref ?? p.id ?? "project",
      region: p.region ?? "",
    }))
    .filter((p) => p.ref !== "");
}
