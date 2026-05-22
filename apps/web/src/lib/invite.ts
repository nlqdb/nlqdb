// Browser-side invite code persistence (SK-GATE-007).
//
// Reads `?invite=<code>` from the landing URL, writes it to localStorage,
// and strips the param from the browser's URL bar so it doesn't appear in
// analytics referrer chains or get copy-pasted into unrelated contexts.

const STORAGE_KEY = "nlqdb_invite";
const URL_PARAM = "invite";

export function captureInviteFromUrl(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const code = params.get(URL_PARAM);
  if (!code) return;
  window.localStorage.setItem(STORAGE_KEY, code);
  const clean = new URL(window.location.href);
  clean.searchParams.delete(URL_PARAM);
  window.history.replaceState(null, "", clean.toString());
}

export function getStoredInviteCode(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}
