// Browser-side session probe for the marketing surfaces. Better
// Auth exposes `GET /api/auth/get-session` which returns the
// session+user when the cookie is present and valid, and a body
// of `null` (or empty) when not. The session cookie is HttpOnly
// (SK-WEB-006), so this network round-trip is the only way the
// static marketing pages can detect "is this visitor signed in?".
//
// Used by Topnav.astro and the home page banner to flip into the
// authed UX (Open chat / Sign out) without ever showing a "Sign
// in" affordance the user can no longer use.

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
  return fromEnv ?? "https://app.nlqdb.com";
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

export async function signOut(apiBase = readApiBase()): Promise<void> {
  try {
    await fetch(`${apiBase.replace(/\/$/, "")}/api/auth/sign-out`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", accept: "application/json" },
    });
  } catch {
    // Continue regardless — we still navigate the user away. The
    // cookie-clear is a server concern; the worst case is a stale
    // cookie until expiry, and the next protected call will 401.
  } finally {
    cached = null;
    if (typeof window !== "undefined") {
      window.location.assign("/");
    }
  }
}
