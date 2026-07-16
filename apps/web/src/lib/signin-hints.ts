// User-facing copy for a sign-in page arrived at with an `?error=<code>`
// hint. Centralised here (mirrors `create-errors.ts`) so `sign-in.astro`
// and its test share one source of truth.
//
// Returns null for an absent or unknown code — GLOBAL-012: never echo a
// raw slug to the user, so an unrecognised code shows no banner rather
// than leaking the internal code.
//
// `session_lost` is emitted by `post-signin.astro` when the cookie
// session didn't land after the OAuth / magic-link round-trip (cookies
// blocked, third-party-cookie partitioning / Safari ITP, or the tab
// closed mid-flow). The redirect side has always sent it; this is the
// read side that surfaces the promised hint instead of a pristine,
// unexplained form (SK-WEB-001 — no blank screens). The
// `signin-hints.test.ts` contract guard asserts every code
// `post-signin.astro` redirects with has copy here, so the two sides
// can't drift.
const HINTS: Record<string, string> = {
  session_lost:
    "Your sign-in didn't finish — your session didn't stick. This usually means cookies are blocked for this site; allow cookies (or turn off tracking prevention for nlqdb.com) and try again.",
};

export function signInHintFor(code: string | null): string | null {
  if (!code) return null;
  return HINTS[code] ?? null;
}
