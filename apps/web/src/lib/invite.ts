// Browser-side invite code persistence (SK-GATE-007).
//
// Reads `?invite=<code>` from the landing URL, writes it to localStorage,
// and strips the param from the browser's URL bar so it doesn't appear in
// analytics referrer chains or get copy-pasted into unrelated contexts.

const STORAGE_KEY = "nlqdb_invite";
const URL_PARAM = "invite";
// Allows base64url chars only; 256 chars is a generous upper bound that prevents localStorage pollution.
const INVITE_CODE_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;

export function captureInviteFromUrl(): void {
  if (typeof window === "undefined") return;
  // Safari Private Browsing throws QuotaExceededError on localStorage.setItem; swallow so Base.astro's site-wide call can't trip the boot-fallback overlay.
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get(URL_PARAM);
    if (!code || !INVITE_CODE_PATTERN.test(code)) return;
    window.localStorage.setItem(STORAGE_KEY, code);
    const clean = new URL(window.location.href);
    clean.searchParams.delete(URL_PARAM);
    window.history.replaceState(null, "", clean.toString());
  } catch {
    /* private-browsing / sandboxed-iframe / locked-down CSP — silent */
  }
}

export function getStoredInviteCode(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}
