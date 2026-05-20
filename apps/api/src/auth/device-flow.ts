// Device-flow login per SK-AUTH-004 + SK-CLI-006. RFC 8628 OAuth 2.0
// Device Authorization Grant with `verification_uri_complete` so the
// CLI hands the browser a one-click approve URL.
//
// Wire:
//   POST /v1/auth/device          → mint device_code + user_code
//   POST /v1/auth/device/approve  → session-gated approve (mints sk_live_)
//   POST /v1/auth/device/token    → poll; returns sk_live_ once approved
//
// V1 issues an `sk_live_` (long-lived, revocable via /app/keys) rather
// than refresh+access JWTs. The full-rotation token model in SK-CLI-006
// is deferred until the JWT-issuer infrastructure lands; the sk_live_
// path leverages SK-APIKEYS-007 (the only existing key-mint pathway)
// and the CLI's existing `SlotRefreshToken` keychain slot — the slot
// name is sticky for backwards compatibility.

export const DEVICE_CODE_TTL_SECONDS = 10 * 60;
export const DEVICE_CODE_POLL_INTERVAL_SECONDS = 2;
const DEVICE_CODE_PREFIX = "device-flow-device:";
const USER_CODE_PREFIX = "device-flow-user:";

// 8 chars from a Crockford-style alphabet (no 0/1/I/L/O/U) keeps the
// fallback typed-code path readable even on low-DPI displays.
const USER_CODE_ALPHABET = "23456789BCDFGHJKMNPQRSTVWXYZ";
const USER_CODE_LENGTH = 8;
const DEVICE_CODE_HEX_BYTES = 24;

export type DeviceFlowRecord = {
  user_code: string;
  status: "pending" | "approved";
  created_at: number;
  // Populated on approve.
  user_id?: string;
  bearer?: string;
};

export type DeviceInitResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
};

export type DeviceFlowDeps = {
  kv: KVNamespace;
  randomHex: (bytes: number) => string;
  randomUserCode: () => string;
  now: () => number;
  webOrigin: string;
};

export function defaultRandomHex(byteCount: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteCount));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function defaultRandomUserCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(USER_CODE_LENGTH));
  let out = "";
  for (const b of bytes) out += USER_CODE_ALPHABET[b % USER_CODE_ALPHABET.length];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

// Strip the cosmetic dash + uppercase so `abcd-1234`, `ABCD1234`, and
// `ABCD-1234` all match the same KV row.
export function normaliseUserCode(raw: string): string {
  return raw.replace(/-/g, "").toUpperCase();
}

export async function initDeviceFlow(deps: DeviceFlowDeps): Promise<DeviceInitResponse> {
  const deviceCode = `dev_${deps.randomHex(DEVICE_CODE_HEX_BYTES)}`;
  const userCode = deps.randomUserCode();
  const record: DeviceFlowRecord = {
    user_code: normaliseUserCode(userCode),
    status: "pending",
    created_at: deps.now(),
  };
  await deps.kv.put(`${DEVICE_CODE_PREFIX}${deviceCode}`, JSON.stringify(record), {
    expirationTtl: DEVICE_CODE_TTL_SECONDS,
  });
  await deps.kv.put(`${USER_CODE_PREFIX}${record.user_code}`, deviceCode, {
    expirationTtl: DEVICE_CODE_TTL_SECONDS,
  });
  const verificationUri = `${deps.webOrigin}/cli`;
  const verificationUriComplete = `${verificationUri}?code=${encodeURIComponent(userCode)}`;
  return {
    device_code: deviceCode,
    user_code: userCode,
    verification_uri: verificationUri,
    verification_uri_complete: verificationUriComplete,
    expires_in: DEVICE_CODE_TTL_SECONDS,
    interval: DEVICE_CODE_POLL_INTERVAL_SECONDS,
  };
}

export type ApproveOutcome =
  | { ok: true }
  | { ok: false; status: 404 | 410; error: "invalid_user_code" | "already_approved" };

// The mint callback fires only after the user_code is validated and
// before-approval — guarantees that a double-click / already-approved
// path never spends a fresh `sk_live_`.
export async function approveDevice(
  userCode: string,
  userId: string,
  mint: () => Promise<string>,
  deps: Pick<DeviceFlowDeps, "kv" | "now">,
): Promise<ApproveOutcome> {
  const key = normaliseUserCode(userCode);
  const deviceCode = await deps.kv.get(`${USER_CODE_PREFIX}${key}`);
  if (!deviceCode) return { ok: false, status: 404, error: "invalid_user_code" };
  const raw = await deps.kv.get(`${DEVICE_CODE_PREFIX}${deviceCode}`);
  if (!raw) return { ok: false, status: 404, error: "invalid_user_code" };
  let record: DeviceFlowRecord;
  try {
    record = JSON.parse(raw) as DeviceFlowRecord;
  } catch {
    return { ok: false, status: 404, error: "invalid_user_code" };
  }
  if (record.status === "approved") return { ok: false, status: 410, error: "already_approved" };
  const bearer = await mint();
  const updated: DeviceFlowRecord = {
    ...record,
    status: "approved",
    user_id: userId,
    bearer,
  };
  // Recompute TTL so the polling window from approval matches the
  // original TTL minus elapsed pending-time — the CLI has at most the
  // remainder to redeem before the entry GCs.
  const elapsed = deps.now() - record.created_at;
  const remaining = Math.max(30, DEVICE_CODE_TTL_SECONDS - elapsed);
  await deps.kv.put(`${DEVICE_CODE_PREFIX}${deviceCode}`, JSON.stringify(updated), {
    expirationTtl: remaining,
  });
  return { ok: true };
}

export type TokenOutcome =
  | { ok: true; bearer: string }
  | { ok: false; status: 400 | 404; error: "authorization_pending" | "expired_token" };

// Delete-on-read once approved so a leaked device_code can't be
// replayed after the legitimate CLI has consumed it.
export async function pollDeviceToken(
  deviceCode: string,
  deps: Pick<DeviceFlowDeps, "kv">,
): Promise<TokenOutcome> {
  const raw = await deps.kv.get(`${DEVICE_CODE_PREFIX}${deviceCode}`);
  if (!raw) return { ok: false, status: 404, error: "expired_token" };
  let record: DeviceFlowRecord;
  try {
    record = JSON.parse(raw) as DeviceFlowRecord;
  } catch {
    return { ok: false, status: 404, error: "expired_token" };
  }
  if (record.status !== "approved" || !record.bearer) {
    return { ok: false, status: 400, error: "authorization_pending" };
  }
  await deps.kv.delete(`${DEVICE_CODE_PREFIX}${deviceCode}`);
  await deps.kv.delete(`${USER_CODE_PREFIX}${record.user_code}`);
  return { ok: true, bearer: record.bearer };
}
