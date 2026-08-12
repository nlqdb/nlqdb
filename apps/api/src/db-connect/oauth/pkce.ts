// PKCE + state primitives for the OAuth connect handshake (RFC 9700 / RFC 7636).
// Web Crypto only (Workers-native), no deps. The `state` is a one-time CSRF
// token stored in KV; the `code_verifier` is the PKCE secret replayed on token
// exchange, and `code_challenge` is its S256 digest sent on the authorize leg.

// base64url without padding — the encoding PKCE requires for both the verifier
// and the S256 challenge.
function base64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomBase64Url(nBytes: number): string {
  const buf = new Uint8Array(nBytes);
  crypto.getRandomValues(buf);
  return base64Url(buf);
}

// Opaque one-time CSRF state (128 bits).
export function generateState(): string {
  return randomBase64Url(16);
}

// PKCE code verifier — 32 random bytes → 43-char base64url (RFC 7636 length is
// 43–128 chars).
export function generateCodeVerifier(): string {
  return randomBase64Url(32);
}

// S256 challenge = base64url(SHA-256(verifier)).
export async function codeChallengeS256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(digest);
}
