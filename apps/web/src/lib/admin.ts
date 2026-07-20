// GET /v1/admin/metrics client (SK-GTM-004). Hand-rolled fetch like
// lib/billing.ts — a web-internal admin read, deliberately not an SDK
// method (GLOBAL-003 gap annotated in gtm-metrics/FEATURE.md). Never
// throws: the dashboard island renders each outcome kind.

export type GtmMetrics = {
  generatedAt: string;
  users: {
    total: number;
    strangers: number;
    internal: number;
    newestSignupAt: string | null;
    newestStrangerSignupAt: string | null;
    signupsByDay: Array<{ day: string; total: number; strangers: number }>;
  };
  funnel: {
    anonDbsTotal: number;
    dbsTotal: number;
    dbsCreated7d: number;
    adoptionsTotal: number;
    adoptions7d: number;
    adoptionRate: number | null;
    anonDbsSynthetic: number;
    adoptionsReal: number;
    adoptionRateReal: number | null;
  };
  uniques: {
    realUsers: number;
    anonDevices: number;
    anonDevicesSynthetic: number;
    anonDevicesOrganic: number;
  };
  activation: {
    dbsStarted: number;
    dbsActivated: number;
    dbsWithSecondAsk: number;
    first10SuccessRate: number | null;
    strangersWithDb: number;
    activatedStrangers: number;
  };
  retention: {
    dbsActive7d: number;
    dbsActive30d: number;
    strangersActive7d: number;
    strangersRetained7d: number;
  };
  acquisition: {
    dbsWithSource: number;
    dbsBySource: Array<{ source: string; total: number; last7d: number }>;
    strangersBySource: Array<{ source: string; strangers: number }>;
  };
  pmf: {
    premiumInterest: number;
    payingCustomers: number;
    customersByStatus: Record<string, number>;
    seanEllis: {
      runnable: boolean;
      activatedStrangers: number;
      minActivated: number;
      responses: number;
      byResponse: Record<string, number>;
      veryDisappointedShare: number | null;
    };
  };
  trend: Array<{ day: string } & Record<string, unknown>>;
};

export type AdminMetricsResult =
  | { kind: "ok"; metrics: GtmMetrics }
  | { kind: "forbidden" }
  | { kind: "unauthorized" }
  | { kind: "error"; message: string };

export async function fetchAdminMetrics(
  apiBase: string | undefined,
  signal?: AbortSignal,
): Promise<AdminMetricsResult> {
  try {
    const res = await fetch(`${apiBase ?? ""}/v1/admin/metrics`, {
      credentials: "include",
      headers: { accept: "application/json" },
      ...(signal ? { signal } : {}),
    });
    if (res.status === 401) return { kind: "unauthorized" };
    if (res.status === 403) return { kind: "forbidden" };
    if (!res.ok) return { kind: "error", message: `Metrics read failed (${res.status}).` };
    return { kind: "ok", metrics: (await res.json()) as GtmMetrics };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { kind: "error", message: "Aborted." };
    }
    return { kind: "error", message: "Network error — try reloading." };
  }
}
