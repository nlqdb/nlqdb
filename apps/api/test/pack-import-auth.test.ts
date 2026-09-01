// `/v1/packs/imports/:id` advance / retry / DELETE — the account-scoped auth
// boundary (SK-PIVOT-010 amended 2026-08-09).
//
// The shared pack-import runner's mutating legs provision an `agent_memory_v1`
// DB and write memory, so — exactly like their siblings `POST /v1/databases
// {preset}` and `/v1/memory/remember` — they accept any account-scoped
// principal (a cookie session or an `sk_live_`/`sk_mcp_` key) and reject the
// account-less ones (`anon`, `pk_live`). Widening these legs from session-only
// is what lets a headless pilot / agent drive the hosted runner over the
// SDK/API — the EK-05 runner-reuse gap (SK-EKP-003).
//
// The full advance happy path reaches Neon (provision + write), which this
// in-process test can't run; as in `databases-create.test.ts`, admission is
// proven post-auth by a resolvable key reaching `import_not_found` (404) on a
// missing draft rather than being turned away at the gate (401/403). The
// cross-tenant DELETE seeds a claimed draft (no `db_id`, so the drop touches no
// Neon) directly in D1 and drives the real ownership check.

import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { apiKeyHmacSecret, mintSkLiveKey } from "../src/api-keys.ts";
import { type ImportDraft, makeD1DraftStore } from "../src/pack-runner/draft-store.ts";

const JSON_HEADERS = { "content-type": "application/json" };

async function bodyCode(res: Response): Promise<string | undefined> {
  const body = (await res.json()) as { error?: { code?: string } };
  return body.error?.code;
}

function seedDraft(id: string, tenantId: string | null): ImportDraft {
  return {
    id,
    tenantId,
    packId: "language-tutor",
    phase: "inspecting",
    source: { kind: "interview-session", ref: "session-x", pin: null, meta: {} },
    dbId: null,
    saveCursor: 0,
    scan: null,
    records: null,
    verification: null,
    error: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe("POST /v1/packs/imports/:id/advance — account-scoped auth boundary", () => {
  it("returns 401 without any credential", async () => {
    const res = await SELF.fetch("https://example.com/v1/packs/imports/pk_missing/advance", {
      method: "POST",
      headers: JSON_HEADERS,
    });
    expect(res.status).toBe(401);
  });

  it("rejects an anon bearer with 403 account_required (anon has no tenant)", async () => {
    const res = await SELF.fetch("https://example.com/v1/packs/imports/pk_missing/advance", {
      method: "POST",
      headers: { ...JSON_HEADERS, authorization: "Bearer anon_abcdef0123456789" },
    });
    expect(res.status).toBe(403);
    expect(await bodyCode(res)).toBe("account_required");
  });

  it("admits a resolvable sk_live key past the gate (404 import_not_found, not 401/403)", async () => {
    const { plaintext } = await mintSkLiveKey(env.DB, apiKeyHmacSecret(env), "user_pk_adv", null);
    const res = await SELF.fetch("https://example.com/v1/packs/imports/pk_missing/advance", {
      method: "POST",
      headers: { ...JSON_HEADERS, authorization: `Bearer ${plaintext}` },
    });
    expect(res.status).toBe(404);
    expect(await bodyCode(res)).toBe("import_not_found");
  });
});

describe("POST /v1/packs/imports/:id/retry — shares the advance handler + gate", () => {
  it("admits a resolvable sk_live key past the gate (404 import_not_found)", async () => {
    const { plaintext } = await mintSkLiveKey(env.DB, apiKeyHmacSecret(env), "user_pk_retry", null);
    const res = await SELF.fetch("https://example.com/v1/packs/imports/pk_missing/retry", {
      method: "POST",
      headers: { ...JSON_HEADERS, authorization: `Bearer ${plaintext}` },
    });
    expect(res.status).toBe(404);
    expect(await bodyCode(res)).toBe("import_not_found");
  });
});

describe("DELETE /v1/packs/imports/:id — account-scoped auth + ownership", () => {
  it("returns 401 without any credential", async () => {
    const res = await SELF.fetch("https://example.com/v1/packs/imports/pk_missing", {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });

  it("rejects an anon bearer with 403 account_required", async () => {
    const res = await SELF.fetch("https://example.com/v1/packs/imports/pk_missing", {
      method: "DELETE",
      headers: { authorization: "Bearer anon_abcdef0123456789" },
    });
    expect(res.status).toBe(403);
    expect(await bodyCode(res)).toBe("account_required");
  });

  it("an sk_live key deletes its own draft (204) but not another tenant's (404)", async () => {
    const store = makeD1DraftStore(env.DB);
    const secret = apiKeyHmacSecret(env);
    const owner = await mintSkLiveKey(env.DB, secret, "tenant_pk_owner", null);
    const stranger = await mintSkLiveKey(env.DB, secret, "tenant_pk_stranger", null);

    await store.create(seedDraft("pk_owned", "tenant_pk_owner"));

    // Cross-tenant: the stranger's key resolves, but the draft isn't theirs —
    // a 404 with no existence leak, and the draft survives.
    const denied = await SELF.fetch("https://example.com/v1/packs/imports/pk_owned", {
      method: "DELETE",
      headers: { authorization: `Bearer ${stranger.plaintext}` },
    });
    expect(denied.status).toBe(404);
    expect(await store.get("pk_owned")).not.toBeNull();

    // The owner's key deletes it (no `db_id`, so no Neon drop) → 204, gone.
    const ok = await SELF.fetch("https://example.com/v1/packs/imports/pk_owned", {
      method: "DELETE",
      headers: { authorization: `Bearer ${owner.plaintext}` },
    });
    expect(ok.status).toBe(204);
    expect(await store.get("pk_owned")).toBeNull();
  });
});
