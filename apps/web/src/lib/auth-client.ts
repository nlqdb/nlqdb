// Shared client-side helpers for the signed-in surface (Slice 10).
//
// Astro `<script>` tags (without `is:inline`) get bundled at build
// time, support imports, and inline `import.meta.env.PUBLIC_*`. So
// the chat + sign-in islands can share this module without dragging
// in a runtime config layer — all the `PUBLIC_*` overrides resolve
// at `astro build`.
//
// Environment overrides:
//   PUBLIC_API_BASE  Worker origin (default: https://app.nlqdb.com)
//   PUBLIC_APP_BASE  Web origin    (default: https://nlqdb.com)
// Both are PUBLIC because they ship in the bundle — no secrets here.

export const API_BASE: string =
  (import.meta.env.PUBLIC_API_BASE as string | undefined) ?? "https://app.nlqdb.com";

export const APP_BASE: string =
  (import.meta.env.PUBLIC_APP_BASE as string | undefined) ?? "https://nlqdb.com";

// Send the user to /sign-in preserving the current path as
// return_to. Called from any 401 path on the signed-in surface so
// the post-verify callback lands them back where they were.
export function redirectToSignIn(): void {
  const ret = encodeURIComponent(`${location.pathname}${location.search}`);
  location.href = `/sign-in?return_to=${ret}`;
}

// Conservative HTML escape — covers the five characters that matter
// for HTML interpolation. Used wherever we string-template untrusted
// content (LLM output, user prompts, DB error messages, row values)
// into innerHTML. Prefer textContent / DOM construction when an
// element-by-element option exists; this is the fallback for the
// table renderer where `.innerHTML = "<td>…"` is the simplest path.
export function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Browser-grade email regex. Not RFC-perfect; not trying to be —
// the source of truth is "did Resend deliver?", not "would the
// IETF approve?". The regex catches typos like "asdf" or "x@x" that
// would round-trip a server error for no good reason.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isLikelyEmail(s: string): boolean {
  return EMAIL_RE.test(s.trim());
}

// Minimal POST helper — JSON in, JSON out, cookies attached so the
// session cookie set by /api/auth/* is sent on /v1/* calls. 401
// triggers the sign-in redirect by default; opt out with
// `redirectOn401: false` for the sign-in page itself (which would
// loop otherwise).
export type FetchOptions = {
  redirectOn401?: boolean;
};

export async function postJson<T = unknown>(
  path: string,
  body: unknown,
  opts: FetchOptions = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 401 && opts.redirectOn401 !== false) {
    redirectToSignIn();
    // Throw to short-circuit the caller; the redirect navigates
    // away before this resolves anyway.
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const errBody = (await res.json()) as { message?: string; error?: unknown };
      if (errBody && typeof errBody.message === "string") detail = errBody.message;
      else if (typeof errBody.error === "string") detail = errBody.error;
    } catch {
      // body wasn't JSON; fall through with HTTP status
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export async function getJson<T = unknown>(path: string, opts: FetchOptions = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  if (res.status === 401 && opts.redirectOn401 !== false) {
    redirectToSignIn();
    throw new Error("unauthorized");
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}
