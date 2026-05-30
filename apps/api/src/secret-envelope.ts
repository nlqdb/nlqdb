// AES-256-GCM secret-at-rest envelope — the one at-rest scheme every
// bring-your-own secret in nlqdb uses (`GLOBAL-031`). Two callers need
// the exact same primitive and must not diverge:
//
//   - BYOLLM account-stored keys — `api_keys.scope = "byollm"`
//     (`SK-PREMIUM-008`); and
//   - BYO Postgres / BYO ClickHouse connection URLs — the per-db blob in
//     D1 (`architecture.md §3.6.7`, `SK-DB-011`, `SK-MULTIENG-005`).
//
// Both store one short, high-value secret string per row behind a single
// Workers-held KEK (`BYO_SECRET_KEK`). Per-user Workers Secrets don't
// scale (the secret count is capped); one KEK + per-row blob does.
//
// Design (web-checked against NIST SP 800-38D and the Cloudflare Web
// Crypto guidance, 2026-05):
//   - AES-256-GCM (authenticated; tamper shows up as a decrypt failure).
//   - A fresh random 96-bit IV per seal, prepended to the ciphertext. GCM
//     security collapses if an IV repeats under one key, so the IV is
//     never derived or counted — it is `crypto.getRandomValues` every time.
//   - The 256-bit content key is HKDF-SHA256–derived from the KEK so the
//     operator can set `BYO_SECRET_KEK` to any high-entropy string (e.g.
//     `openssl rand -base64 32`) rather than an exact raw key.
//   - `context` is bound as GCM additional-authenticated-data (AAD): it is
//     authenticated, not encrypted, so a blob lifted from one owner's row
//     fails to open under another owner's context. Callers pass a stable
//     owner tag (`byollm:<userId>`, `dbconn:<dbId>`) — never blank.
//
// The KEK and every plaintext are secrets: this module never logs either,
// and the envelope it returns carries neither.

const AES_KEY_BITS = 256;
const IV_BYTES = 12; // 96-bit IV — NIST SP 800-38D's recommended GCM length.

// Versioned tag (`nlqdb byo envelope v1`) so a future format change is a
// new prefix, not an ambiguous re-parse. The envelope is one compact
// string for a D1 TEXT column: `nbe1.<base64url(iv ‖ ciphertext+tag)>`.
const ENVELOPE_PREFIX = "nbe1.";

// HKDF domain-separation labels — fixed and non-secret. The salt is fixed
// (RFC 5869 permits a non-secret salt when the input keying material is
// already high-entropy); `info` pins the derivation to this envelope
// version so the same KEK can safely key other HKDF uses later.
const HKDF_SALT = new TextEncoder().encode("nlqdb:byo-secret-envelope");
const HKDF_INFO = new TextEncoder().encode("nlqdb:byo-secret-envelope:v1");

export type SealOptions = {
  // High-entropy Workers Secret (`BYO_SECRET_KEK`); see `kekFromEnv`.
  kek: string;
  // Owner tag bound as AAD so the blob can't be replayed onto another row.
  context: string;
};

// Derive the AES-GCM content key from the KEK via HKDF-SHA256. Cheap
// enough to run per call; we never cache a CryptoKey across requests. The
// KEK is trimmed here — the single derivation point — so seal and open
// agree on the key even if a caller bypasses `kekFromEnv` (which trims) and
// passes a whitespace-padded value; the blank check above already rejects
// an all-whitespace KEK.
async function deriveContentKey(kek: string): Promise<CryptoKey> {
  const ikm = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(kek.trim()),
    "HKDF",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: HKDF_SALT, info: HKDF_INFO },
    ikm,
    { name: "AES-GCM", length: AES_KEY_BITS },
    false,
    ["encrypt", "decrypt"],
  );
}

// Encrypt `plaintext` into a self-describing envelope string. Fails loud
// (`GLOBAL-012`) on a blank secret, KEK, or context — each would silently
// weaken the scheme (a blank context drops the anti-replay binding).
export async function sealSecret(plaintext: string, opts: SealOptions): Promise<string> {
  if (plaintext === "") throw new Error("sealSecret: refusing to seal an empty secret.");
  if (opts.kek.trim() === "") throw new Error("sealSecret: KEK is empty.");
  if (opts.context === "") throw new Error("sealSecret: context (AAD) is empty.");

  const key = await deriveContentKey(opts.kek);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(opts.context) },
    key,
    new TextEncoder().encode(plaintext),
  );

  const packed = new Uint8Array(IV_BYTES + ciphertext.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(ciphertext), IV_BYTES);
  return ENVELOPE_PREFIX + base64UrlEncode(packed);
}

// Decrypt an envelope produced by `sealSecret`. The `context` must match
// the seal-time value or GCM authentication fails. Fails loud
// (`GLOBAL-012`) — a malformed envelope and a failed decrypt are distinct
// one-sentence messages, both server-internal (never surfaced verbatim to
// an end user, so neither is a decryption oracle).
export async function openSecret(envelope: string, opts: SealOptions): Promise<string> {
  if (opts.kek.trim() === "") throw new Error("openSecret: KEK is empty.");
  if (opts.context === "") throw new Error("openSecret: context (AAD) is empty.");
  if (!envelope.startsWith(ENVELOPE_PREFIX)) {
    throw new Error("openSecret: value is not a v1 sealed-secret envelope.");
  }

  let packed: Uint8Array<ArrayBuffer>;
  try {
    packed = base64UrlDecode(envelope.slice(ENVELOPE_PREFIX.length));
  } catch {
    throw new Error("openSecret: envelope payload is not valid base64url.");
  }
  if (packed.length <= IV_BYTES) throw new Error("openSecret: envelope is truncated.");

  const iv = packed.subarray(0, IV_BYTES);
  const ciphertext = packed.subarray(IV_BYTES);
  const key = await deriveContentKey(opts.kek);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(opts.context) },
      key,
      ciphertext,
    );
  } catch {
    throw new Error("openSecret: could not decrypt (wrong key, wrong context, or tampered data).");
  }
  return new TextDecoder().decode(plaintext);
}

// Read the KEK from the Worker env. Returns `undefined` when unset/blank
// so the caller surfaces an operator-config gap as 503 (the request is
// well-formed; the platform just can't seal yet) rather than 4xx —
// matching the `gateway_unconfigured` posture in `ask/byollm.ts`.
export function kekFromEnv(env: { BYO_SECRET_KEK?: string }): string | undefined {
  const kek = env.BYO_SECRET_KEK?.trim();
  return kek ? kek : undefined;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
