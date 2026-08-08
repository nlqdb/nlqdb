// Identify the signed-in visitor to Tawk.to so the support operator sees the
// account's name / email / nlqdb user id instead of Tawk's anonymous visitor
// id. Mounted from SupportChat.astro on the `/app` product surfaces only
// (SK-WEB-025); `/app` is always authed, so a real user is (almost) always
// present.
//
// Tawk Secure Mode: setting a visitor's name/email requires an
// HMAC-SHA256(email, key) `hash` computed server-side — without it Tawk
// silently drops name/email and the operator sees only an anonymous id. So the
// identity (including the hash) comes from `GET /api/tawk/identity`, which holds
// the key; the browser never sees it. When the key is unprovisioned the
// endpoint omits the hash and Tawk keeps the anon id — no crash.
//
// Uses setAttributes (not the Tawk_API.visitor object) because the identity
// resolves async — after the embed script has already downloaded — which is
// Tawk's documented path for ajax-login / SPA flows; the visitor object only
// transmits values set *before* the widget loads.
//
// No SK-ANON-015 concern: this sends account fields only, never the page URL,
// and `onLoad` fires long after the `#nlq=` handoff fragment has been stripped.

import { readApiBase, type SessionUser } from "./session";

// The signed-in identity plus the Secure Mode hash the server vouches for.
export type TawkIdentity = SessionUser & { hash?: string };

type TawkApi = {
  onLoad?: () => void;
  setAttributes?: (attributes: Record<string, string>, callback: (error?: unknown) => void) => void;
};

declare global {
  interface Window {
    Tawk_API?: TawkApi;
  }
}

// Tawk attribute keys must be alphanumeric or dash. `name`/`email`/`hash` are
// the first-class visitor fields (email only attaches when the hash vouches for
// it under Secure Mode); the stable nlqdb user id rides along as a custom
// attribute so the operator can tie a chat back to the account.
export function tawkAttributes(user: TawkIdentity): Record<string, string> {
  const attributes: Record<string, string> = {
    name: user.name ?? user.email ?? user.id,
    "user-id": user.id,
  };
  if (user.email) attributes.email = user.email;
  if (user.hash) attributes.hash = user.hash;
  return attributes;
}

// Fetch the visitor identity + Secure Mode hash for the signed-in user. Same-
// origin authed GET (cookie); returns null when signed out or on error, so the
// caller bails exactly like the session probe does.
export async function fetchTawkIdentity(apiBase = readApiBase()): Promise<TawkIdentity | null> {
  try {
    const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/tawk/identity`, {
      credentials: "include",
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text === "null") return null;
    return JSON.parse(text) as TawkIdentity;
  } catch {
    return null;
  }
}

export function identifyTawkVisitor(user: TawkIdentity | null): void {
  if (typeof window === "undefined" || !user) return;
  window.Tawk_API ??= {};
  const api = window.Tawk_API;
  const attributes = tawkAttributes(user);
  const apply = () => api.setAttributes?.(attributes, () => {});
  // Apply now if the widget has already loaded (identity resolved late), and
  // (re)apply on every widget load — covering the opposite race where the
  // identity resolves before `onLoad` fires and setAttributes isn't ready yet.
  apply();
  api.onLoad = apply;
}
