// Browser-side session probe (`SK-WEB-009`: host-only cookie, same-origin probe).
// Sign-out lives at `/auth/sign-out` (SK-AUTH-019), not here.

export type SessionUser = {
  id: string;
  email?: string;
  name?: string;
};

let cached: Promise<SessionUser | null> | null = null;

export function readApiBase(): string {
  const fromEnv =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env["PUBLIC_API_BASE"] as string | undefined)
      : undefined;
  return fromEnv ?? "";
}

// Drop the memoized probe so the next `fetchSession` re-hits the live
// cookie. Sign-out is trust-critical: a cached "signed-in" promise
// outlives the cookie after sign-out (here, or in another tab), so a
// bfcache restore or a re-probe would otherwise render a stale authed
// shell. The dedup for the initial load burst (topnav + page guard +
// banner all probe on mount) is preserved — only explicit invalidation
// or a page-restore/visibility change clears it.
export function invalidateSession(): void {
  cached = null;
}

if (typeof window !== "undefined") {
  // bfcache restore: scripts don't re-run, but `pageshow` (persisted)
  // fires on the still-registered listener — drop the cache so the
  // page's own guard re-probe sees the live cookie.
  window.addEventListener("pageshow", (event) => {
    if ((event as PageTransitionEvent).persisted) invalidateSession();
  });
  // Returning to a tab that was open during a sign-out elsewhere: the
  // next probe must not trust the pre-sign-out result.
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") invalidateSession();
  });
}

export function fetchSession(apiBase = readApiBase()): Promise<SessionUser | null> {
  if (cached) return cached;
  cached = (async () => {
    try {
      const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/auth/get-session`, {
        credentials: "include",
        headers: { accept: "application/json" },
      });
      if (!res.ok) return null;
      const text = await res.text();
      if (!text || text === "null") return null;
      const body = JSON.parse(text) as { user?: SessionUser } | null;
      return body?.user ?? null;
    } catch {
      // Treat network failures as "not signed in" — the topnav
      // falls back to the anon UX rather than flashing a stale
      // authed shell.
      return null;
    }
  })();
  return cached;
}
