// Query-time credential path for a Supabase mgmt-connected DB (`SK-DBCONN-003`).
// Opens the sealed OAuth token for a `db_id`, refreshes it if it is at/near
// expiry (reseals + persists the new token), and hands back a valid access
// token + project ref for the Management-API transport. The refresh keeps the
// token on the hot path working without the user re-authorizing.

import { openSecret, sealSecret } from "../../secret-envelope.ts";
import type { SupabaseGrantSecret } from "../connect-supabase-mgmt.ts";
import { refreshTokens, type SupabaseOAuthClient } from "./supabase-oauth.ts";

// Refresh when the access token has under this many seconds left, so an
// in-flight query never races the expiry.
const REFRESH_MARGIN_SEC = 60;

export type GrantStoreDeps = {
  d1: D1Database;
  kek: string;
  client: SupabaseOAuthClient;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

export type ValidGrant = { accessToken: string; projectRef: string };

export async function loadValidSupabaseGrant(
  deps: GrantStoreDeps,
  dbId: string,
): Promise<ValidGrant> {
  const row = await deps.d1
    .prepare(
      "SELECT token_blob, provider_project FROM db_oauth_grants WHERE db_id = ? AND provider = 'supabase'",
    )
    .bind(dbId)
    .first<{ token_blob: string; provider_project: string | null }>();
  if (!row) throw new Error(`no supabase oauth grant for db_id=${dbId}`);
  if (!row.provider_project) throw new Error(`supabase grant for db_id=${dbId} has no project ref`);
  const projectRef = row.provider_project;

  const secret = JSON.parse(
    await openSecret(row.token_blob, { kek: deps.kek, context: `dboauth:${dbId}` }),
  ) as SupabaseGrantSecret;

  const now = (deps.now ?? (() => Math.floor(Date.now() / 1000)))();
  if (secret.expiresAt - now > REFRESH_MARGIN_SEC) {
    return { accessToken: secret.accessToken, projectRef };
  }

  // Expired (or about to): refresh, reseal, persist. Last-write-wins on the
  // blob is acceptable at current concurrency (one connect owner); a rotating
  // refresh-token race under heavy concurrency is tracked as an open question.
  const fresh = await refreshTokens(deps.client, secret.refreshToken, {
    fetchImpl: deps.fetchImpl,
    now: deps.now,
  });
  const newBlob = await sealSecret(JSON.stringify(fresh), {
    kek: deps.kek,
    context: `dboauth:${dbId}`,
  });
  await deps.d1
    .prepare("UPDATE db_oauth_grants SET token_blob = ? WHERE db_id = ?")
    .bind(newBlob, dbId)
    .run();

  return { accessToken: fresh.accessToken, projectRef };
}
