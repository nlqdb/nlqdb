// `POST /v1/db/connect` — auth gate + the persisted-row contract.
//
// Two layers:
//   - SELF.fetch proves the principal gate: unauth → 401; a wrong-kind
//     bearer (anon / pk_live / sk_mcp) → 403 connect_requires_account.
//     The route's full happy path needs a reachable BYO host + KEK, so
//     the 201 INSERT contract is exercised against `connectByoDb`
//     directly with the real test D1 + stubbed engine query factories
//     (no network) — the assertion we care about is the row shape, not
//     the HTTP plumbing.
//   - The row-shape test confirms a BYO row lands with
//     `connection_secret_ref = '__byo_blob__'`, a non-null sealed
//     `connection_blob`, and NO plaintext URL anywhere on the row.

import { env, SELF } from "cloudflare:test";
import type { ClickhouseQueryFn } from "@nlqdb/db";
import { describe, expect, it } from "vitest";
import { connectByoDb } from "../src/db-connect/connect.ts";
import { BYO_SECRET_REF_SENTINEL } from "../src/db-connect/constants.ts";

const CONN_URL = "https://user:supersecret@ch.example.com:8443/?database=analytics";

describe("POST /v1/db/connect — principal gate", () => {
  it("returns 401 without any credential", async () => {
    const res = await SELF.fetch("https://example.com/v1/db/connect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ engine: "clickhouse", connection_url: CONN_URL }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects an anon bearer with 403 connect_requires_account", async () => {
    const res = await SELF.fetch("https://example.com/v1/db/connect", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer anon_abcdef0123456789",
      },
      body: JSON.stringify({ engine: "clickhouse", connection_url: CONN_URL }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: { status?: string } };
    expect(body.error?.status).toBe("connect_requires_account");
  });

  it("rejects a pk_live bearer (db-scoped, not an account)", async () => {
    const res = await SELF.fetch("https://example.com/v1/db/connect", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer pk_live_doesnotexist",
      },
      body: JSON.stringify({ engine: "clickhouse", connection_url: CONN_URL }),
    });
    // No session, unknown pk_live ⇒ unauthorized at the middleware (401).
    // A resolved-but-db-scoped pk_live would 403; either way it never
    // reaches the connect orchestrator.
    expect([401, 403]).toContain(res.status);
  });
});

describe("POST /v1/db/connect — CORS preflight", () => {
  it("advertises the verb + idempotency-key on /v1/db/*", async () => {
    const res = await SELF.fetch("https://example.com/v1/db/connect", {
      method: "OPTIONS",
      headers: {
        origin: "https://app.nlqdb.com",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type,idempotency-key",
      },
    });
    expect(res.status).toBeLessThan(300);
    const allowHeaders = res.headers.get("access-control-allow-headers") ?? "";
    expect(allowHeaders.toLowerCase()).toContain("idempotency-key");
  });
});

describe("connectByoDb — persisted BYO row (real test D1)", () => {
  it("writes the sentinel ref + sealed blob, never the plaintext URL", async () => {
    const tenantId = "user_byo_row_test";
    // Empty-schema CH introspection — the renderer still yields a
    // non-empty preview; we're asserting the row, not the schema.
    const chQuery: ClickhouseQueryFn = async () => ({ rows: [] });

    const result = await connectByoDb(
      {
        resolve: async () => ["93.184.216.34"],
        kek: "test-kek-this-is-a-high-entropy-string-aaaa",
        d1: env.DB,
        randomSuffix: () => "row001",
        buildClickhouseQuery: () => chQuery,
        buildPostgresQuery: () => async () => ({ rows: [], rowCount: 0 }),
      },
      { engine: "clickhouse", connectionUrl: CONN_URL, tenantId },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = await env.DB.prepare(
      "SELECT id, tenant_id, engine, connection_secret_ref, connection_blob, schema_hash, schema_text FROM databases WHERE id = ?",
    )
      .bind(result.dbId)
      .first<{
        id: string;
        tenant_id: string;
        engine: string;
        connection_secret_ref: string;
        connection_blob: string | null;
        schema_hash: string | null;
        schema_text: string | null;
      }>();

    expect(row).not.toBeNull();
    expect(row?.tenant_id).toBe(tenantId);
    expect(row?.engine).toBe("clickhouse");
    expect(row?.connection_secret_ref).toBe(BYO_SECRET_REF_SENTINEL);
    expect(row?.connection_blob).toBeTruthy();
    // No plaintext URL / password persisted anywhere on the row.
    const serialized = JSON.stringify(row);
    expect(serialized).not.toContain("supersecret");
    expect(serialized).not.toContain("ch.example.com");
  });
});
