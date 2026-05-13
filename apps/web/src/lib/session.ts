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
