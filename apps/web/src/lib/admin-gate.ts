// SK-GTM-002 — presentation-only copy of the admin predicate. The
// canonical, security-bearing gate lives in
// apps/api/src/admin/gate.ts and runs on every /v1/admin/* request;
// this copy only decides whether the static /app/admin page shows a
// shell or bounces. Keep the two in sync when the allowlist changes.

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
