// Integration coverage for the account-stored BYOLLM credential store
// (`src/byollm-account.ts`, SK-PREMIUM-012). Runs against Miniflare's real
// D1 (migrations applied per `apply-migrations.ts`) and the real workerd
// Web Crypto, so the seal → store → load → open round-trip exercises the
// GLOBAL-031 envelope exactly as production does. The plaintext key must
// never survive into the row (`api_keys` `scope = "byollm"`) or the
// display status, and must never leak into the bearer-key list.

import { env } from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";
import { listKeysByTenant, revokeKeyById } from "../src/api-keys.ts";
import {
  byollmStatus,
  clearByollmCredential,
  loadByollmCredential,
  storeByollmCredential,
} from "../src/byollm-account.ts";

const KEK = { BYO_SECRET_KEK: "test-kek-this-is-a-high-entropy-string-aaaa" };
const KEY = "sk-ant-api03-abcdef.ghi:jkl"; // colon inside, as a real key has

// Each test uses its own tenant id so they don't collide on the
// one-row-per-account index; this also clears between runs.
afterEach(async () => {
  await env.DB.prepare("DELETE FROM api_keys WHERE key_type = 'byollm'").run();
});

describe("storeByollmCredential", () => {
  it("seals the key, stores it, and never persists the plaintext", async () => {
    const res = await storeByollmCredential(env.DB, KEK, "t1", {
      provider: "anthropic",
      model: "claude-4-5-sonnet",
      apiKey: KEY,
    });
    expect(res).toEqual({
      ok: true,
      provider: "anthropic",
      model: "claude-4-5-sonnet",
      last4: ":jkl",
    });

    const row = await env.DB.prepare(
      "SELECT provider, key_hash, last_4, scope FROM api_keys WHERE tenant_id = 't1' AND key_type = 'byollm'",
    ).first<{ provider: string; key_hash: string; last_4: string; scope: string }>();
    expect(row?.provider).toBe("anthropic");
    expect(row?.scope).toBe("byollm");
    expect(row?.key_hash.startsWith("nbe1.")).toBe(true); // sealed envelope in key_hash
    expect(row?.key_hash).not.toContain(KEY); // never plaintext
    expect(row?.last_4).toBe(":jkl");
  });

  it("never surfaces the BYOLLM row in the bearer-key list", async () => {
    await storeByollmCredential(env.DB, KEK, "t1b", {
      provider: "openai",
      model: "gpt-5.2",
      apiKey: KEY,
    });
    const keys = await listKeysByTenant(env.DB, "t1b");
    expect(keys).toEqual([]); // managed via /v1/keys/byollm, not the key list
  });

  it("can't be revoked through the bearer-key revoke surface (defense-in-depth)", async () => {
    await storeByollmCredential(env.DB, KEK, "t1c", {
      provider: "openai",
      model: "gpt-5.2",
      apiKey: KEY,
    });
    const id = (
      await env.DB.prepare(
        "SELECT id FROM api_keys WHERE tenant_id = 't1c' AND key_type = 'byollm'",
      ).first<{ id: string }>()
    )?.id;
    expect(id).toBeTruthy();
    // `revokeKeyById` filters `key_type != 'byollm'`, so it can't touch the row.
    expect(await revokeKeyById(env.DB, "t1c", id as string)).toBe("not_found");
    expect(await loadByollmCredential(env.DB, KEK, "t1c")).not.toBeNull();
  });

  it("rejects a blank provider with the required-fields message", async () => {
    const res = await storeByollmCredential(env.DB, KEK, "t1d", {
      provider: "  ",
      model: "gpt-5.2",
      apiKey: KEY,
    });
    expect(res.ok).toBe(false);
    if (!res.ok && res.reason === "invalid") expect(res.message).toContain("are all required");
  });

  it("lower-cases the provider slug and round-trips the exact key on load", async () => {
    await storeByollmCredential(env.DB, KEK, "t2", {
      provider: " OpenAI ",
      model: "gpt-5.2",
      apiKey: KEY,
    });
    const loaded = await loadByollmCredential(env.DB, KEK, "t2");
    expect(loaded).toEqual({ upstream: "openai", model: "gpt-5.2", apiKey: KEY });
  });

  it("upserts — a second store replaces the first (one credential per account)", async () => {
    await storeByollmCredential(env.DB, KEK, "t3", {
      provider: "openai",
      model: "gpt-5.2",
      apiKey: "sk-1111",
    });
    await storeByollmCredential(env.DB, KEK, "t3", {
      provider: "anthropic",
      model: "claude-4-5-sonnet",
      apiKey: "sk-2222",
    });
    const loaded = await loadByollmCredential(env.DB, KEK, "t3");
    expect(loaded).toEqual({
      upstream: "anthropic",
      model: "claude-4-5-sonnet",
      apiKey: "sk-2222",
    });
    const count = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM api_keys WHERE tenant_id = 't3' AND key_type = 'byollm'",
    ).first<{ n: number }>();
    expect(count?.n).toBe(1);
  });

  it("rejects an unsupported provider with a one-sentence message (GLOBAL-012)", async () => {
    const res = await storeByollmCredential(env.DB, KEK, "t4", {
      provider: "openrouter",
      model: "qwen",
      apiKey: KEY,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("invalid");
      if (res.reason === "invalid")
        expect(res.message).toContain("openai, anthropic, google-ai-studio");
    }
  });

  it("rejects a blank model or key", async () => {
    expect(
      (
        await storeByollmCredential(env.DB, KEK, "t5", {
          provider: "openai",
          model: "",
          apiKey: KEY,
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await storeByollmCredential(env.DB, KEK, "t5", {
          provider: "openai",
          model: "gpt-5.2",
          apiKey: "  ",
        })
      ).ok,
    ).toBe(false);
  });

  it("reports kek_unconfigured (→ 503) when no KEK is set", async () => {
    const res = await storeByollmCredential(env.DB, {}, "t6", {
      provider: "openai",
      model: "gpt-5.2",
      apiKey: KEY,
    });
    expect(res).toEqual({ ok: false, reason: "kek_unconfigured" });
  });
});

describe("byollmStatus", () => {
  it("returns null status when nothing is stored", async () => {
    expect(await byollmStatus(env.DB, KEK, "absent")).toEqual({ ok: true, status: null });
  });

  it("returns provider/model/last4 but never the key", async () => {
    await storeByollmCredential(env.DB, KEK, "t7", {
      provider: "openai",
      model: "gpt-5.2",
      apiKey: KEY,
    });
    const res = await byollmStatus(env.DB, KEK, "t7");
    expect(res.ok).toBe(true);
    if (res.ok && res.status) {
      expect(res.status.provider).toBe("openai");
      expect(res.status.model).toBe("gpt-5.2");
      expect(res.status.last4).toBe(":jkl");
      expect(JSON.stringify(res.status)).not.toContain(KEY);
    }
  });

  it("reports kek_unconfigured when no KEK is set", async () => {
    expect(await byollmStatus(env.DB, {}, "t7")).toEqual({ ok: false, reason: "kek_unconfigured" });
  });
});

describe("loadByollmCredential", () => {
  it("returns null when nothing is stored", async () => {
    expect(await loadByollmCredential(env.DB, KEK, "none")).toBeNull();
  });

  it("returns null (no lane) when the KEK is unset — nothing could have been sealed", async () => {
    expect(await loadByollmCredential(env.DB, {}, "t8")).toBeNull();
  });

  it("fails loud when the stored blob can't be unsealed (wrong KEK)", async () => {
    await storeByollmCredential(env.DB, KEK, "t9", {
      provider: "openai",
      model: "gpt-5.2",
      apiKey: KEY,
    });
    await expect(
      loadByollmCredential(
        env.DB,
        { BYO_SECRET_KEK: "a-different-kek-bbbbbbbbbbbbbbbbbbbbbbbb" },
        "t9",
      ),
    ).rejects.toThrow();
  });
});

describe("clearByollmCredential", () => {
  it("hard-deletes and reports cleared, then absent on a re-clear (idempotent)", async () => {
    await storeByollmCredential(env.DB, KEK, "t10", {
      provider: "openai",
      model: "gpt-5.2",
      apiKey: KEY,
    });
    expect(await clearByollmCredential(env.DB, "t10")).toEqual({ cleared: true });
    expect(await clearByollmCredential(env.DB, "t10")).toEqual({ cleared: false });
    expect(await loadByollmCredential(env.DB, KEK, "t10")).toBeNull();
  });

  it("lets a cleared tenant re-store without a UNIQUE collision", async () => {
    await storeByollmCredential(env.DB, KEK, "t11", {
      provider: "openai",
      model: "gpt-5.2",
      apiKey: "sk-old",
    });
    await clearByollmCredential(env.DB, "t11");
    const res = await storeByollmCredential(env.DB, KEK, "t11", {
      provider: "anthropic",
      model: "claude-4-5-sonnet",
      apiKey: "sk-new",
    });
    expect(res.ok).toBe(true);
    expect(await loadByollmCredential(env.DB, KEK, "t11")).toEqual({
      upstream: "anthropic",
      model: "claude-4-5-sonnet",
      apiKey: "sk-new",
    });
  });
});
