// `/app` analytics consent (SK-WEB-029). Opt-in gate for PostHog product
// analytics (SK-WEB-024), which sets its own cookies — so ePrivacy Art 5(3)
// requires consent before it loads. The first-party session cookie is strictly
// necessary and is never gated (declining does not sign you out).
//
// The Tawk support chat cookie is NOT gated here: Tawk's own native Consent
// Form (a dashboard toggle, SK-WEB-025) blocks its cookies until the visitor
// accepts in-widget, which keeps the chat bubble visible for everyone. This
// module governs only PostHog.
//
// Marketing / blog / vs / solve pages stay cookieless and banner-free
// (GLOBAL-034); this gate exists only on the authenticated `/app` surfaces.
//
// State lives in localStorage (a per-device choice, no server round-trip) and
// changes broadcast on a window event so the analytics + support-chat loaders
// — which run in separate island scripts — start the moment consent is granted
// without a reload.

const KEY = "nlqdb_consent";
// Version prefix so a material change to which cookies we set can re-ask
// everyone by bumping it; old `1:*` values then read back as "unset".
const VERSION = "1";
const GRANTED = `${VERSION}:granted`;
const DENIED = `${VERSION}:denied`;

const EVENT = "nlqdb:consent";

export type ConsentChoice = "granted" | "denied" | "unset";

export function readConsent(): ConsentChoice {
  if (typeof window === "undefined") return "unset";
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === GRANTED) return "granted";
    if (v === DENIED) return "denied";
    return "unset";
  } catch {
    // Storage blocked (private mode, embedded) → treat as no choice, which
    // keeps the non-essential cookies OFF. Fail closed, never fail open.
    return "unset";
  }
}

export function isConsentGranted(): boolean {
  return readConsent() === "granted";
}

// Persist the choice and broadcast it. Consumers listen on the window event so
// a grant lights up analytics + chat in place; a withdrawal is handled by the
// banner (a reload, since a loaded third-party SDK can't be cleanly unloaded).
export function setConsent(granted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, granted ? GRANTED : DENIED);
  } catch {
    // Best-effort persistence; still broadcast so this page reacts.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { granted } }));
}

// Run `cb` exactly once, as soon as consent is granted: immediately if it is
// already granted, otherwise when the user grants it later (same page, no
// reload). Used by the PostHog and Tawk loaders so neither fires a cookie
// before opt-in.
export function whenConsentGranted(cb: () => void): void {
  if (typeof window === "undefined") return;
  if (isConsentGranted()) {
    cb();
    return;
  }
  let ran = false;
  window.addEventListener(EVENT, (e) => {
    if (ran) return;
    const granted = (e as CustomEvent<{ granted: boolean }>).detail?.granted;
    if (granted) {
      ran = true;
      cb();
    }
  });
}
