// Account-stored BYOLLM credential — the persistence half of
// SK-LLM-016 step 2 (account-stored lane). The dispatch precedence and the
// provider/router primitives live in `@nlqdb/llm`
// (`selectDispatchLane`/`buildByollmRouter`); the per-request header lane
// lives in `ask/byollm.ts`. This module is the only place a stored
// credential is sealed (`sealSecret`), read back (`openSecret`), or
// cleared, so the GLOBAL-031 envelope contract (context `byollm:<tenant>`)
// is applied in exactly one tested place.
//
// Storage is `api_keys` with `scope = "byollm"` (SK-PREMIUM-008,
// SK-PREMIUM-012, api-keys/FEATURE.md). A BYOLLM row is a *decryptable*
// secret, so it stores the sealed envelope in `key_hash` (a reversible blob
// in lieu of the one-way HMAC the minted keys use) — bearer lookups all
// filter `key_type`, so a BYOLLM row never matches one. One active row per
// account (partial UNIQUE index): set hard-deletes the prior row first
// (atomic `batch`) so re-adding never collides and clearing removes the
// blob — the instant revocation GLOBAL-018 wants.
//
// Storing is decrypt-capable, so it needs the KEK; when `BYO_SECRET_KEK`
// is unset every entry point reports `kek_unconfigured` and the caller
// surfaces 503 (operator-config gap, not a 4xx) — the same posture
// `ask/byollm.ts` takes for an unset AI Gateway.

import type { ByollmCredential } from "@nlqdb/llm";
import { SUPPORTED_BYOLLM_PROVIDERS } from "./ask/byollm.ts";
import { kekFromEnv, openSecret, sealSecret } from "./secret-envelope.ts";

const SUPPORTED = new Set<string>(SUPPORTED_BYOLLM_PROVIDERS);

// GCM additional-authenticated-data tag binding a sealed blob to its owner
// (GLOBAL-031): a row lifted into another tenant's id fails to open.
function contextFor(tenantId: string): string {
  return `byollm:${tenantId}`;
}

// Validated set/replace input. Provider must be one of the AI Gateway
// compat slugs the header lane also accepts, so the two BYOLLM lanes never
// diverge on what "supported" means.
export type StoreByollmInput = { provider: string; model: string; apiKey: string };

export type StoreByollmResult =
  | { ok: true; provider: string; model: string; last4: string }
  // Shape problems are the caller's fault → 4xx with this one-sentence
  // message (GLOBAL-012). `kek_unconfigured` is the platform's fault → 503.
  | { ok: false; reason: "invalid"; message: string }
  | { ok: false; reason: "kek_unconfigured" };

// Display view for `GET /v1/keys/byollm` — never carries the key or the
// sealed blob, only what a dashboard renders ("anthropic · claude… · …a1b2").
export type ByollmStatus = {
  provider: string;
  model: string;
  last4: string;
  updatedAt: number;
};

// What `GET` returns when nothing is stored — distinct from an error so the
// surface renders an empty "add your key" state, not a failure.
export type LoadStatusResult =
  | { ok: true; status: ByollmStatus | null }
  | { ok: false; reason: "kek_unconfigured" };

type Env = { BYO_SECRET_KEK?: string };

// Seal and store the credential, replacing any existing one (one active row
// per account). Validation (provider/model/key non-empty, provider
// supported) is here rather than the route so every caller — the HTTP
// endpoint and any future surface — shares one contract.
export async function storeByollmCredential(
  d1: D1Database,
  env: Env,
  tenantId: string,
  input: StoreByollmInput,
): Promise<StoreByollmResult> {
  const provider = input.provider.trim().toLowerCase();
  const model = input.model.trim();
  const apiKey = input.apiKey.trim();
  if (provider === "" || model === "" || apiKey === "") {
    return { ok: false, reason: "invalid", message: "provider, model, and key are all required." };
  }
  if (!SUPPORTED.has(provider)) {
    return {
      ok: false,
      reason: "invalid",
      message: `BYOLLM provider "${provider}" is not supported; use one of ${SUPPORTED_BYOLLM_PROVIDERS.join(", ")}.`,
    };
  }

  const kek = kekFromEnv(env);
  if (!kek) return { ok: false, reason: "kek_unconfigured" };

  const envelope = await sealSecret(apiKey, { kek, context: contextFor(tenantId) });
  const last4 = apiKey.slice(-4);
  // Replace-in-place atomically: delete any prior BYOLLM row, then insert
  // the new one. A batch is one D1 transaction, so a reader never sees zero
  // rows mid-swap and the partial UNIQUE index never trips.
  await d1.batch([
    d1.prepare("DELETE FROM api_keys WHERE tenant_id = ? AND key_type = 'byollm'").bind(tenantId),
    d1
      .prepare(
        "INSERT INTO api_keys (id, tenant_id, key_type, key_hash, last_4, scope, provider, model) " +
          "VALUES (?, ?, 'byollm', ?, ?, 'byollm', ?, ?)",
      )
      .bind(crypto.randomUUID(), tenantId, envelope, last4, provider, model),
  ]);
  return { ok: true, provider, model, last4 };
}

// Read the display status (no decrypt — never touches the sealed blob, so
// it works even if the KEK rotated). `kek_unconfigured` here means the
// platform can't serve BYOLLM at all, which the surface should reflect.
export async function byollmStatus(
  d1: D1Database,
  env: Env,
  tenantId: string,
): Promise<LoadStatusResult> {
  if (!kekFromEnv(env)) return { ok: false, reason: "kek_unconfigured" };
  const row = await d1
    .prepare(
      "SELECT provider, model, last_4, created_at FROM api_keys " +
        "WHERE tenant_id = ? AND key_type = 'byollm' AND revoked_at IS NULL",
    )
    .bind(tenantId)
    .first<{ provider: string; model: string; last_4: string; created_at: number }>();
  if (!row) return { ok: true, status: null };
  return {
    ok: true,
    status: {
      provider: row.provider,
      model: row.model,
      last4: row.last_4,
      updatedAt: row.created_at,
    },
  };
}

// Resolve the stored credential into the dispatch shape, decrypting the
// sealed envelope held in `key_hash`. Returns `null` when nothing is stored
// (the dispatch falls through to premium/free). Fails loud (GLOBAL-012) on
// a decrypt failure — a stored-but-unopenable key is a server fault (KEK
// rotated / tampered row), and silently dropping to the free chain is
// exactly the dark pattern SK-PREMIUM-008 point 6 forbids. The plaintext
// key never enters a span or log.
export async function loadByollmCredential(
  d1: D1Database,
  env: Env,
  tenantId: string,
): Promise<ByollmCredential | null> {
  const kek = kekFromEnv(env);
  if (!kek) return null; // No KEK ⇒ nothing could have been sealed ⇒ no lane.
  const row = await d1
    .prepare(
      "SELECT provider, model, key_hash FROM api_keys " +
        "WHERE tenant_id = ? AND key_type = 'byollm' AND revoked_at IS NULL",
    )
    .bind(tenantId)
    .first<{ provider: string; model: string; key_hash: string }>();
  if (!row) return null;
  const apiKey = await openSecret(row.key_hash, { kek, context: contextFor(tenantId) });
  return { upstream: row.provider, model: row.model, apiKey };
}

// Hard-delete the stored credential (the sealed blob is removed, the
// instant revocation GLOBAL-018 wants). Idempotent: returns whether a row
// was removed so the surface can say "cleared" vs "nothing to clear"
// without a second read. No KEK needed — DELETE doesn't touch the blob.
export async function clearByollmCredential(
  d1: D1Database,
  tenantId: string,
): Promise<{ cleared: boolean }> {
  const res = await d1
    .prepare("DELETE FROM api_keys WHERE tenant_id = ? AND key_type = 'byollm'")
    .bind(tenantId)
    .run();
  return { cleared: (res.meta.changes ?? 0) > 0 };
}
