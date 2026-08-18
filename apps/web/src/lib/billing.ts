// Browser-side helpers for the Stripe billing surfaces (SK-STRIPE-008/009).
// `/pricing` and the `/app` dunning banner (SK-WEB-012) both read the
// caller's status and open the hosted portal, so that fetch + redirect
// logic lives here once instead of being copy-pasted per page.

export type BillingStatus = {
  plan: "free" | "hobby" | "pro" | "unknown";
  // The Stripe subscription status verbatim, or "none" with no row.
  status: string;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  manageable: boolean;
};

// Current-period hosted-premium usage (SK-PREMIUM-009), backing the
// `/app/billing` allowance bar. Mirrors the API's `BillingUsage` shape.
export type BillingUsage = {
  plan: "free" | "hobby" | "pro" | "unknown";
  periodStart: number | null;
  included: number;
  consumed: number;
  overage: number;
};

const trimBase = (apiBase: string) => apiBase.replace(/\/$/, "");

// Formats a Stripe `current_period_end` (unix *seconds*) as a short calendar
// date for honest "your plan ends on …" messaging. Returns null when the
// timestamp is absent or unparseable so callers fall back to label-only copy.
// Rendered in the viewer's local timezone (no `timeZone` override) on purpose:
// the instant is when access lapses, so the local calendar day is the one the
// user actually loses the plan on — not the UTC day.
export function formatPlanEndDate(epochSeconds: number | null): string | null {
  if (epochSeconds == null || !Number.isFinite(epochSeconds)) return null;
  const d = new Date(epochSeconds * 1000);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// GET /v1/billing/status — a single indexed D1 read, no Stripe call. Returns
// null on any failure so callers treat status as a progressive enhancement.
export async function fetchBillingStatus(apiBase: string): Promise<BillingStatus | null> {
  try {
    const res = await fetch(`${trimBase(apiBase)}/v1/billing/status`, { credentials: "include" });
    return res.ok ? ((await res.json()) as BillingStatus) : null;
  } catch {
    return null;
  }
}

// GET /v1/billing/usage — current-period allowance projection, a pure D1 read
// (no Stripe call). Returns null on any failure so callers treat usage as a
// progressive enhancement, same posture as `fetchBillingStatus`.
export async function fetchBillingUsage(apiBase: string): Promise<BillingUsage | null> {
  try {
    const res = await fetch(`${trimBase(apiBase)}/v1/billing/usage`, { credentials: "include" });
    return res.ok ? ((await res.json()) as BillingUsage) : null;
  } catch {
    return null;
  }
}

// Outcome of a portal-open attempt. "ok" means the browser is already
// navigating to Stripe; the rest map to the caller's inline messaging
// (404 → no subscription yet, 503 → live keys not configured,
// no_subscription → a switch was asked for but there's no live plan to change,
// so the caller should route to checkout instead).
export type PortalOutcome = "ok" | "no_customer" | "no_subscription" | "not_configured" | "error";

// POST /v1/billing/portal — opens the Stripe-hosted Billing Portal and
// redirects on success. Never throws; returns an outcome the caller renders.
//
// Pass `{ flow: "switch_plan" }` to deep-link straight to the plan-change page
// (upgrade/downgrade) instead of the portal overview — the overview has no
// switch CTA under Stripe's default configuration (SK-STRIPE-015). The plain
// call (no options) opens the full portal for manage/cancel.
export async function openBillingPortal(
  apiBase: string,
  opts?: { flow?: "switch_plan" },
): Promise<PortalOutcome> {
  try {
    const init: RequestInit = { method: "POST", credentials: "include" };
    if (opts?.flow) {
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify({ flow: opts.flow });
    }
    const res = await fetch(`${trimBase(apiBase)}/v1/billing/portal`, init);
    if (res.status === 404) return "no_customer";
    if (res.status === 409) return "no_subscription";
    if (res.status === 503) return "not_configured";
    if (!res.ok) return "error";
    const { url } = (await res.json()) as { url: string };
    window.location.assign(url);
    return "ok";
  } catch {
    return "error";
  }
}
