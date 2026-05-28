// Browser-side invite code persistence (SK-GATE-007).
//
// Reads `?invite=<code>` from the landing URL, writes it to localStorage,
// and strips the param from the browser's URL bar so it doesn't appear in
// analytics referrer chains or get copy-pasted into unrelated contexts.

const STORAGE_KEY = "nlqdb_invite";
const URL_PARAM = "invite";
// Server generates 22-char base64url; cap at 128 to reject oversized payloads before localStorage/header.
const MAX_CODE_LEN = 128;

export function captureInviteFromUrl(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const code = params.get(URL_PARAM);
  if (!code || code.length > MAX_CODE_LEN) return;
  const clean = new URL(window.location.href);
  clean.searchParams.delete(URL_PARAM);
  try {
    // localStorage.setItem throws QuotaExceededError in Safari private mode;
    // replaceState throws SecurityError in sandboxed iframes.
    window.localStorage.setItem(STORAGE_KEY, code);
    window.history.replaceState(null, "", clean.toString());
  } catch {
    /* private-browsing / sandboxed-iframe — silent */
  }
}

export function getStoredInviteCode(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}
