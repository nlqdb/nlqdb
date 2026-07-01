// Shared client-side email shape check. Intentionally lax and pragmatic —
// the authoritative validation is server-side; this only catches obvious
// typos before a round-trip so the user gets instant feedback. Centralised
// so the rule is unit-tested in one place.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True when `raw` (after trimming surrounding whitespace) is a plausible email. */
export function isValidEmail(raw: string): boolean {
  return EMAIL_RE.test(raw.trim());
}
