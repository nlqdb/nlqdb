// Unit tests for `loadValidSupabaseGrant` — the query-time token path. Uses the
// real `sealSecret` to prepare a token_blob, injects `fetch` for the refresh,
// and a d1 stub that serves the SELECT + records the UPDATE.

import { describe, expect, it, vi } from "vitest";
import { openSecret, sealSecret } from "../../secret-envelope.ts";
import type { SupabaseGrantSecret } from "../connect-supabase-mgmt.ts";
import { loadValidSupabaseGrant } from "./grant-store.ts";

const KEK = "test-kek-0123456789abcdef0123456789abcdef";
const DB_ID = "db_proj_a1b2c3";

async function sealToken(secret: SupabaseGrantSecret): Promise<string> {
  return sealSecret(JSON.stringify(secret), { kek: KEK, context: `dboauth:${DB_ID}` });
}

// d1 stub: SELECT returns the seeded grant row; UPDATE captures the new blob.
function stubD1(row: { token_blob: string; provider_project: string | null } | null) {
  const updated: { blob?: string } = {};
  const prepare = vi.fn((sql: string) => {
    if (sql.startsWith("SELECT")) {
      return { bind: () => ({ first: async () => row }) };
    }
    // UPDATE db_oauth_grants SET token_blob = ? WHERE db_id = ?
    return {
      bind: (blob: string) => ({
        run: async () => {
          updated.blob = blob;
          return { success: true };
        },
      }),
    };
  });
  return { d1: { prepare } as unknown as D1Database, updated };
}

function fakeRefreshFetch(body: unknown) {
  const calls: number[] = [];
  const impl = (async () => {
    calls.push(1);
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const CLIENT = { clientId: "cid", clientSecret: "csecret" };

describe("loadValidSupabaseGrant", () => {
  it("returns the stored token unchanged when it is not near expiry", async () => {
    const blob = await sealToken({ accessToken: "at", refreshToken: "rt", expiresAt: 10_000 });
    const { d1, updated } = stubD1({ token_blob: blob, provider_project: "projref" });
    const { impl, calls } = fakeRefreshFetch({});

    const grant = await loadValidSupabaseGrant(
      { d1, kek: KEK, client: CLIENT, fetchImpl: impl, now: () => 1000 },
      DB_ID,
    );

    expect(grant).toEqual({ accessToken: "at", projectRef: "projref" });
    expect(calls).toHaveLength(0); // no refresh
    expect(updated.blob).toBeUndefined(); // no persist
  });

  it("refreshes, reseals, and persists when the token is expired", async () => {
    const blob = await sealToken({ accessToken: "old", refreshToken: "rt_old", expiresAt: 1000 });
    const { d1, updated } = stubD1({ token_blob: blob, provider_project: "projref" });
    const { impl, calls } = fakeRefreshFetch({
      access_token: "new_at",
      refresh_token: "new_rt",
      expires_in: 3600,
    });

    const grant = await loadValidSupabaseGrant(
      { d1, kek: KEK, client: CLIENT, fetchImpl: impl, now: () => 2000 },
      DB_ID,
    );

    expect(grant).toEqual({ accessToken: "new_at", projectRef: "projref" });
    expect(calls).toHaveLength(1); // refreshed
    // The persisted blob opens back to the refreshed token set.
    expect(updated.blob).toBeDefined();
    const reopened = JSON.parse(
      await openSecret(updated.blob!, { kek: KEK, context: `dboauth:${DB_ID}` }),
    ) as SupabaseGrantSecret;
    expect(reopened).toEqual({ accessToken: "new_at", refreshToken: "new_rt", expiresAt: 5600 });
  });

  it("throws when there is no grant row for the db", async () => {
    const { d1 } = stubD1(null);
    await expect(loadValidSupabaseGrant({ d1, kek: KEK, client: CLIENT }, DB_ID)).rejects.toThrow(
      /no supabase oauth grant/,
    );
  });
});
