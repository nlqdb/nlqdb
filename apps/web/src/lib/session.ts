// Browser-side session probe (`SK-WEB-009`: host-only cookie, same-origin probe).
//
// Sign-out lives at `/auth/sign-out` (apps/web/src/pages/auth/sign-out.astro).
// Every sign-out affordance — Topnav button, ChatPanel command palette,
// ErrorBoundary fallback, Base.astro boot fallback — navigates there so
// the POST-then-redirect dance has exactly one implementation. The boot
// fallback can only emit a plain `<a>` (it renders before React mounts),
// which is the constraint that forces the page-as-sink design.

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
