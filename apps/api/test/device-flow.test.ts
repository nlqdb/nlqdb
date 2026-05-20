// Unit tests for `auth/device-flow.ts` (SK-AUTH-004 / SK-CLI-006).
//
// Exercises the pure-function pieces against an in-memory KV stub —
// the HTTP wrappers in `index.ts` are covered by the api integration
// suite once the rest of the env is wired.

import { describe, expect, it } from "vitest";
import {
  approveDevice,
  DEVICE_CODE_TTL_SECONDS,
  initDeviceFlow,
  normaliseUserCode,
  pollDeviceToken,
} from "../src/auth/device-flow.ts";

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

function makeDeps(now = 1000) {
  const { kv, store } = makeKv();
  return {
    kv,
    store,
    randomHex: () => "deadbeef".repeat(6), // 48-char device code body
    randomUserCode: () => "ABCD-WXYZ",
    now: () => now,
    webOrigin: "https://app.example",
  };
}

describe("normaliseUserCode", () => {
  it("strips dashes and uppercases", () => {
    expect(normaliseUserCode("abcd-1234")).toBe("ABCD1234");
    expect(normaliseUserCode("ABCD1234")).toBe("ABCD1234");
    expect(normaliseUserCode("a-b-c-d")).toBe("ABCD");
  });
});

describe("initDeviceFlow", () => {
  it("stashes both keys with the same TTL and returns a verification URL", async () => {
    const deps = makeDeps();
    const out = await initDeviceFlow(deps);
    expect(out.device_code).toMatch(/^dev_/);
    expect(out.user_code).toBe("ABCD-WXYZ");
    expect(out.verification_uri).toBe("https://app.example/cli");
    expect(out.verification_uri_complete).toBe("https://app.example/cli?code=ABCD-WXYZ");
    expect(out.expires_in).toBe(DEVICE_CODE_TTL_SECONDS);
    expect(out.interval).toBeGreaterThan(0);
    // Both keys exist.
    expect(deps.store.has(`device-flow-device:${out.device_code}`)).toBe(true);
    expect(deps.store.has("device-flow-user:ABCDWXYZ")).toBe(true);
  });
});

describe("approveDevice", () => {
  it("flips a pending entry to approved and stashes the bearer", async () => {
    const deps = makeDeps();
    const init = await initDeviceFlow(deps);
    const result = await approveDevice("abcd-wxyz", "user_42", async () => "sk_live_xyz", deps);
    expect(result).toEqual({ ok: true });
    const raw = deps.store.get(`device-flow-device:${init.device_code}`)?.value;
    expect(raw).toBeDefined();
    const record = JSON.parse(raw as string);
    expect(record.status).toBe("approved");
    expect(record.user_id).toBe("user_42");
    expect(record.bearer).toBe("sk_live_xyz");
  });

  it("rejects an unknown user_code without minting", async () => {
    const deps = makeDeps();
    let mintCalls = 0;
    const result = await approveDevice(
      "UNKNOWN1",
      "user_42",
      async () => {
        mintCalls++;
        return "sk_live_xyz";
      },
      deps,
    );
    expect(result.ok).toBe(false);
    expect(mintCalls).toBe(0);
    if (!result.ok) {
      expect(result.error).toBe("invalid_user_code");
      expect(result.status).toBe(404);
    }
  });

  it("rejects a double-approve without minting a second key", async () => {
    const deps = makeDeps();
    await initDeviceFlow(deps);
    let mintCalls = 0;
    const mintFn = async () => {
      mintCalls++;
      return `sk_live_${mintCalls}`;
    };
    await approveDevice("ABCD-WXYZ", "user_42", mintFn, deps);
    const second = await approveDevice("ABCD-WXYZ", "user_42", mintFn, deps);
    expect(mintCalls).toBe(1);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error).toBe("already_approved");
      expect(second.status).toBe(410);
    }
  });
});

describe("pollDeviceToken", () => {
  it("returns authorization_pending while pending", async () => {
    const deps = makeDeps();
    const init = await initDeviceFlow(deps);
    const out = await pollDeviceToken(init.device_code, deps);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error).toBe("authorization_pending");
      expect(out.status).toBe(400);
    }
  });

  it("returns the bearer once approved, then deletes the entries", async () => {
    const deps = makeDeps();
    const init = await initDeviceFlow(deps);
    await approveDevice("ABCD-WXYZ", "user_42", async () => "sk_live_xyz", deps);
    const first = await pollDeviceToken(init.device_code, deps);
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.bearer).toBe("sk_live_xyz");
    // Delete-on-read: a replay misses.
    const second = await pollDeviceToken(init.device_code, deps);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe("expired_token");
    // User-code reverse lookup is gone too.
    expect(deps.store.has("device-flow-user:ABCDWXYZ")).toBe(false);
  });

  it("returns expired_token when the device_code is unknown", async () => {
    const deps = makeDeps();
    const out = await pollDeviceToken("dev_missing", deps);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error).toBe("expired_token");
      expect(out.status).toBe(404);
    }
  });
});
