// Single source of truth for client-side error reports (SK-WEB-001).
// Both the React ErrorBoundary (`components/ErrorBoundary.tsx`) and
// the pre-hydration handler (`layouts/Base.astro`) report through
// this helper so the payload shape, abuse safeguards, and apiBase
// resolution live in one place.

const REPORT_PATH = "/v1/errors/web";

// Resolves the API base. The merged app worker (`SK-AUTH-016`) serves
// `apps/web` and `apps/api` from the same origin, so `""` (relative)
// works — but a standalone marketing worker would need the absolute
// origin. Prefer the explicit `PUBLIC_API_BASE` build-time env when
// it's set; fall back to same-origin.
function resolveApiBase(): string {
  try {
    const v =
      typeof import.meta !== "undefined" && import.meta.env
        ? (import.meta.env["PUBLIC_API_BASE"] as string | undefined)
        : undefined;
    return v ?? "";
  } catch {
    return "";
  }
}

export interface ErrorReport {
  surface: string;
  message: string;
  stack?: string | null;
  componentStack?: string | null;
  href?: string | null;
  userAgent?: string | null;
}

// Per-session dedup. The page can re-throw the same error many times
// (render loop after a reload, repeated unhandled rejections from a
// `setInterval`); without this, every retry hits the sink. Keyed on a
// cheap hash of the fields that uniquely identify the error.
const SEEN = new Set<string>();
const SEEN_MAX = 32;

function fingerprint(report: ErrorReport): string {
  const head = (report.stack ?? "").slice(0, 200);
  return `${report.surface}::${report.message}::${head}`;
}

export function reportClientError(report: ErrorReport): void {
  try {
    const fp = fingerprint(report);
    if (SEEN.has(fp)) return;
    if (SEEN.size >= SEEN_MAX) {
      // Drop oldest by clearing — a tiny LRU isn't worth the bytes.
      SEEN.clear();
    }
    SEEN.add(fp);

    const base = resolveApiBase();
    void fetch(`${base}${REPORT_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // No cookies — the endpoint reads nothing from the session.
      credentials: "omit",
      keepalive: true,
      body: JSON.stringify({
        surface: report.surface,
        message: report.message,
        stack: report.stack ?? null,
        componentStack: report.componentStack ?? null,
        href: report.href ?? null,
        userAgent: report.userAgent ?? null,
      }),
    }).catch(() => {
      // best-effort — drop network failures silently.
    });
  } catch {
    // never let reporting itself blow up.
  }
}

// Test-only: clear the dedup set between cases.
export function _resetReportClientErrorForTests(): void {
  SEEN.clear();
}
