// Browser-side session probe (`SK-WEB-009`: host-only cookie, same-origin probe).

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

export async function signOut(apiBase = readApiBase()): Promise<void> {
  try {
    // Empty `{}` body, not a missing body. Better Auth's router
    // (`better-call` v1.3.5) calls `request.json()` whenever the
    // request advertises `content-type: application/json`, and on
    // Cloudflare Workers `request.body` is a non-null ReadableStream
    // even when no bytes were written — so the upstream `if
    // (!request.body)` early-return never fires and `JSON.parse("")`
    // throws `SyntaxError: Unexpected end of JSON input`, which
    // Better Auth surfaces as a 500. Sending `{}` bypasses the
    // parser bug without a backend change.
    await fetch(`${apiBase.replace(/\/$/, "")}/api/auth/sign-out`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: "{}",
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
