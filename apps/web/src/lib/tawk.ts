// Identify the signed-in visitor to Tawk.to so the support operator sees the
// account's name / email / nlqdb user id instead of Tawk's anonymous visitor
// id. Mounted from SupportChat.astro on the `/app` product surfaces only
// (SK-WEB-025); `/app` is always authed, so a real user is (almost) always
// present.
//
// Uses setAttributes (not the Tawk_API.visitor object) because the session
// resolves async — after the embed script has already downloaded — which is
// exactly Tawk's documented path for ajax-login / SPA flows; the visitor object
// only transmits values set *before* the widget loads. Secure Mode is off: we
// hold no server-side email hash, and a hash is only required to *set* name /
// email under Secure Mode. That is fine for a support widget — the attributes
// are advisory operator hints, and the disclosed "visitor metadata" sharing
// (privacy.astro / SUBPROCESSORS.md) already covers them.
//
// No SK-ANON-015 concern: this sends account fields only, never the page URL,
// and `onLoad` fires long after the `#nlq=` handoff fragment has been stripped.

import type { SessionUser } from "./session";

type TawkApi = {
  onLoad?: () => void;
  setAttributes?: (attributes: Record<string, string>, callback: (error?: unknown) => void) => void;
};

declare global {
  interface Window {
    Tawk_API?: TawkApi;
  }
}

// Tawk attribute keys must be alphanumeric or dash. `name`/`email` are the
// first-class visitor fields; the stable nlqdb user id rides along as a custom
// attribute so the operator can tie a chat back to the account.
export function tawkAttributes(user: SessionUser): Record<string, string> {
  const attributes: Record<string, string> = {
    name: user.name ?? user.email ?? user.id,
    "user-id": user.id,
  };
  if (user.email) attributes.email = user.email;
  return attributes;
}

export function identifyTawkVisitor(user: SessionUser | null): void {
  if (typeof window === "undefined" || !user) return;
  window.Tawk_API ??= {};
  const api = window.Tawk_API;
  const attributes = tawkAttributes(user);
  const apply = () => api.setAttributes?.(attributes, () => {});
  // Apply now if the widget has already loaded (session resolved late), and
  // (re)apply on every widget load — covering the opposite race where the
  // session resolves before `onLoad` fires and setAttributes isn't ready yet.
  apply();
  api.onLoad = apply;
}
