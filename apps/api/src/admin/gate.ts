// SK-GTM-002 — the ONLY authorization predicate for admin surfaces
// (GLOBAL-038). Sign-in is OAuth/magic-link only (SK-AUTH-002), so a
// session email is a verified identity; matching the company domain
// admits future teammates with zero code change. Server-side gate —
// the static /app/admin page's client-side copy
// (apps/web/src/lib/admin-gate.ts) is presentation only, never a
// security boundary. Reviewed constants, not env vars: the list
// changes ~never and a code review beats a secret-mirroring errand.

const ADMIN_EMAILS = new Set(["omer@salfati.group"]);
const ADMIN_DOMAINS = new Set(["nlqdb.com"]);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (ADMIN_EMAILS.has(normalized)) return true;
  const at = normalized.lastIndexOf("@");
  if (at < 0) return false;
  return ADMIN_DOMAINS.has(normalized.slice(at + 1));
}
