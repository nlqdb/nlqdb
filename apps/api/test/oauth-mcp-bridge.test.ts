// Unit tests for `oauth-mcp-bridge.ts` — slice 3b of `SK-MCP-010`.
//
// The bridge is the cross-Worker seam between `apps/api/` and
// `apps/mcp/`. These tests exercise the pure-function pieces against
// an in-memory KV stub so we don't need Miniflare; the HTTP-handler
// wrappers in `index.ts` are covered by the api integration suite
// once `@neondatabase/serverless` is reachable.

import { describe, expect, it, vi } from "vitest";
import {
  BRIDGE_CODE_TTL_SECONDS,
  type BridgeStoredCode,
  mintBridgeCode,
  parseBridgeBody,
  redeemBridgeCode,
} from "../src/oauth-mcp-bridge.ts";

function makeKv() {
  const store = new Map<string, { value: string; expiresAt: number }>();
  // biome-ignore lint/suspicious/noExplicitAny: KV stub
  const kv: any = {
    get: async (key: string) => {
      const row = store.get(key);
      if (!row) return null;
      if (row.expiresAt < Date.now()) {
        store.delete(key);
        return null;
      }
      return row.value;
    },
    put: async (key: string, value: string, opts?: { expirationTtl?: number }) => {
      const ttl = (opts?.expirationTtl ?? 3600) * 1000;
      store.set(key, { value, expiresAt: Date.now() + ttl });
    },
    delete: async (key: string) => {
      store.delete(key);
    },
  };
  return { kv: kv as KVNamespace, store };
}

describe("parseBridgeBody", () => {
  const valid = {
    client_id: "client_xyz",
    redirect_uri: "https://host.example/cb",
    state: "csrf-123",
    mcp_host: "cursor",
    device_id: "macbook-air",
  };

  it("accepts a well-formed body", () => {
    const out = parseBridgeBody(valid);
    expect(out.ok).toBe(true);
  });

  it("rejects null / non-object", () => {
    expect(parseBridgeBody(null).ok).toBe(false);
    expect(parseBridgeBody("string").ok).toBe(false);
  });

  it("rejects missing client_id", () => {
    const out = parseBridgeBody({ ...valid, client_id: "" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe("invalid_client_id");
  });

  it("rejects missing OAuth state (CSRF defense)", () => {
    const out = parseBridgeBody({ ...valid, state: "" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe("invalid_state");
  });

  it("rejects overlong mcp_host (>32 chars)", () => {
    const out = parseBridgeBody({ ...valid, mcp_host: "x".repeat(33) });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe("invalid_mcp_host");
  });

  it("rejects overlong device_id (>64 chars)", () => {
    const out = parseBridgeBody({ ...valid, device_id: "x".repeat(65) });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe("invalid_device_id");
  });
});

describe("mintBridgeCode + redeemBridgeCode", () => {
  const body = {
    client_id: "client_xyz",
    redirect_uri: "https://host.example/cb",
    state: "csrf-123",
    mcp_host: "cursor",
    device_id: "macbook-air",
  };

  it("mints a 32-char hex code and stashes the bound bearer in KV", async () => {
    const { kv, store } = makeKv();
    const mint = vi.fn(async () => ({
      plaintext: "sk_mcp_cursor_macbook_abc",
      hash: "h".repeat(64),
    }));
    const result = await mintBridgeCode("user_42", body, null, {
      kv,
      randomHex: () => "deadbeef".repeat(4), // 32 chars
      mintKey: mint,
    });
    expect(result.code.length).toBe(32);
    expect(result.expires_in).toBe(BRIDGE_CODE_TTL_SECONDS);
    expect(mint).toHaveBeenCalledWith("user_42", "cursor", "macbook-air");
    // The KV entry must carry the plaintext + hash so the redemption
    // handler can return them to `apps/mcp/`.
    const raw = store.get(`mcp-oauth-bridge:${result.code}`)?.value;
    const stored = JSON.parse(raw ?? "{}") as BridgeStoredCode;
    expect(stored.user_id).toBe("user_42");
    expect(stored.bearer).toBe("sk_mcp_cursor_macbook_abc");
    expect(stored.bearer_hash).toBe("h".repeat(64));
    expect(stored.state).toBe("csrf-123");
  });

  it("returns the same code on Idempotency-Key replay (SK-IDEMP-002)", async () => {
    const { kv } = makeKv();
    let mintCount = 0;
    const deps = {
      kv,
      randomHex: () => `code${mintCount++}`.padEnd(32, "0"),
      mintKey: async () => ({ plaintext: "sk_mcp_x", hash: "h".repeat(64) }),
    };
    const first = await mintBridgeCode("user_42", body, "idem-key-1", deps);
    const second = await mintBridgeCode("user_42", body, "idem-key-1", deps);
    expect(second.code).toBe(first.code);
  });

  it("different idempotency keys produce different codes", async () => {
    const { kv } = makeKv();
    let mintCount = 0;
    const deps = {
      kv,
      randomHex: () => `code${mintCount++}`.padEnd(32, "0"),
      mintKey: async () => ({ plaintext: "sk_mcp_x", hash: "h".repeat(64) }),
    };
    const a = await mintBridgeCode("user_42", body, "idem-a", deps);
    const b = await mintBridgeCode("user_42", body, "idem-b", deps);
    expect(a.code).not.toBe(b.code);
  });

  it("redeem is one-shot — second redemption returns null", async () => {
    const { kv } = makeKv();
    const result = await mintBridgeCode("user_42", body, null, {
      kv,
      randomHex: () => "f".repeat(32),
      mintKey: async () => ({ plaintext: "sk_mcp_x", hash: "h".repeat(64) }),
    });
    const first = await redeemBridgeCode(result.code, kv);
    expect(first?.bearer).toBe("sk_mcp_x");
    const second = await redeemBridgeCode(result.code, kv);
    expect(second).toBeNull();
  });

  it("redeem returns null for an unknown code", async () => {
    const { kv } = makeKv();
    const out = await redeemBridgeCode("nonexistent_code", kv);
    expect(out).toBeNull();
  });

  it("redeem returns null for a KV-expired code", async () => {
    const { kv, store } = makeKv();
    const result = await mintBridgeCode("user_42", body, null, {
      kv,
      randomHex: () => "f".repeat(32),
      mintKey: async () => ({ plaintext: "sk_mcp_x", hash: "h".repeat(64) }),
    });
    // Simulate KV TTL expiry by zeroing the entry's expiresAt.
    for (const [key, val] of store.entries()) {
      if (key.startsWith("mcp-oauth-bridge:")) store.set(key, { ...val, expiresAt: 0 });
    }
    const out = await redeemBridgeCode(result.code, kv);
    expect(out).toBeNull();
  });
});
