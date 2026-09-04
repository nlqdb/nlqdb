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
    // SK-GTM-010 — creating surface (hero/chat/embed/cli/mcp); orthogonal to channel.
    dbsBySurface: Array<{ surface: string; total: number; last7d: number }>;
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
  // SK-GTM-008 — the D1-answerable inputs of the SK-PIVOT-016 dogfood
  // launch gate, plus the serving Worker's `MEMORY_PRESET`. Criteria
  // 3–5 have no D1 source and are static-with-as-of in launch-gate.ts.
  launchGate: {
    memoryPresetEnabled: boolean;
    memoryDbs: number;
    memoryDbsInternal: number;
    /** Lower bound only — `first10_asks` saturates at 10 per DB. */
    memoryFirst10Asks: number;
    memoryFirst10Ok: number;
    /** SK-GTM-011 — criterion 1's real instrument: non-saturating asks
        through the public MCP surface (`asks_mcp`) and all surfaces
        (`asks_total`), summed over the memory DBs. */
    memoryAsksMcp: number;
    memoryAsksTotal: number;
    memoryFirst10SuccessRate: number | null;
    memoryLastQueriedAt: string | null;
  };
  // SK-GTM-009 — the paying-customer watchlist: one row per customers
  // entry, newest conversion first. Bounded (LIMIT 50 server-side).
  customers: Array<{
    email: string;
    /** Founder/test account — a test purchase is not the first customer. */
    internal: boolean;
    status: string;
    convertedAt: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    dbs: number;
    /** Lower bounds — first-10 counters saturate at 10 per DB. */
    first10Asks: number;
    first10Ok: number;
    lastActivityAt: string | null;
  }>;
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
