// HMAC-SHA256 + base64url helpers for the OAuth flow-state envelope.
// The signed envelope (`<payload>.<sig>`) round-trips the OAuth context
// through the consent screen URL — unsigned would let an attacker
// substitute their own `redirect_uri` or strip the PKCE challenge.

export async function signBlob(value: unknown, secret: string): Promise<string> {
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifyBlob<T>(envelope: string, secret: string): Promise<T> {
  const dot = envelope.indexOf(".");
  if (dot < 0) throw new Error("blob: missing signature");
  const payload = envelope.slice(0, dot);
  const sig = envelope.slice(dot + 1);
  if (!timingSafeEqual(sig, await hmac(secret, payload))) {
    throw new Error("blob: signature mismatch");
  }
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as T;
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return base64UrlEncode(new Uint8Array(sig));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(padded + "==".slice(0, (4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
