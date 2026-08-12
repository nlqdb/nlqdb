// SK-GTM-002 — the ONLY authorization predicate for admin surfaces
// (GLOBAL-038). Sign-in is OAuth/magic-link only (SK-AUTH-002), so a
// session email is a verified identity; matching the company domain
// admits future teammates with zero code change. The exact-allowlist
// entry is the founder's real sign-in account (`omer@salfati.group` —
// the same address SK-GTM-001's INTERNAL_EMAIL_SQL calls internal);
// without it the founder's own dashboard 403s. No web-side copy: a
// non-admin sees the API's 403 rendered in place, so there is exactly
// one predicate. Reviewed constants, not env vars: the list changes
// ~never and a code review beats a secret-mirroring errand.

const ADMIN_EMAILS = new Set(["omer@salfati.group", "omer@nlqdb.com"]);
const ADMIN_DOMAINS = new Set(["nlqdb.com"]);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (ADMIN_EMAILS.has(normalized)) return true;
  const at = normalized.lastIndexOf("@");
  if (at < 0) return false;
  return ADMIN_DOMAINS.has(normalized.slice(at + 1));
}
