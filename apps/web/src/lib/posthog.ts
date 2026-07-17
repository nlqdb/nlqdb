// Client-side PostHog capture — PRODUCT `/app` surfaces ONLY
// (SK-WEB-024 / SK-EVENTS-013). Never imported from a marketing / blog /
// vs / solve page: those stay SDK-free so the Lighthouse-100 posture and
// the no-cookie-banner promise hold (GLOBAL-034). This answers the
// founder's client-side questions — where users click more/less
// (autocapture + heatmaps), what blocks them (session replay + rage /
// dead clicks) — while the server-side sink (posthog.ts in
// events-worker) answers retention/funnels on real product events.
//
// Lazy-loaded: posthog-js is `import()`-ed only after the session probe
// resolves, so the ~50 KB SDK never sits on the critical path to first
// paint (the SDK ships to the browser only on `/app`, and even there
// after hydration).
//
// Privacy (non-negotiable): session recording masks ALL inputs and the
// entire conversation region (`[data-ph-mask="true"]` on the chat list),
// so user DB contents — query results, sample rows, the typed goal —
// are never recorded, only layout + interaction. `person_profiles:
// "identified_only"` keeps us from minting a person profile for every
// visit; `/app` is authed, so real users are identified below.

import type { SessionUser } from "./session";

let started = false;

// Publishable `phc_` project key + EU ingestion host, baked at build
// time (deploy-web.yml, mirroring PUBLIC_API_BASE). Absent locally →
// the SDK never loads, so `bun run dev` and previews stay SDK-free.
function config(): { key: string; host: string } | null {
  // Direct dotted access — Vite only statically inlines
  // `import.meta.env.PUBLIC_*` member expressions; bracket access
  // ships a runtime lookup of an empty object (dead getter in prod).
  const key = import.meta.env.PUBLIC_POSTHOG_KEY as string | undefined;
  const host = (import.meta.env.PUBLIC_POSTHOG_HOST as string | undefined) ?? "https://eu.i.posthog.com";
  return key ? { key, host } : null;
}

export async function initAppAnalytics(user: SessionUser | null): Promise<void> {
  if (started || typeof window === "undefined") return;
  const cfg = config();
  if (!cfg) return;
  started = true;

  const { default: posthog } = await import("posthog-js");
  posthog.init(cfg.key, {
    api_host: cfg.host,
    // Snapshot of PostHog's recommended defaults (autocapture on,
    // heatmaps + dead-click capture on, sensible replay defaults).
    defaults: "2026-05-30",
    // Full-page navigations (Astro MPA, no client router) — capture a
    // pageview on each load rather than SPA history events.
    capture_pageview: true,
    // Only identified (signed-in) visitors get a person profile — keeps
    // the person count bounded to real accounts, not every /app hit.
    person_profiles: "identified_only",
    persistence: "localStorage+cookie",
    autocapture: true,
    capture_heatmaps: true,
    capture_dead_clicks: true,
    disable_session_recording: false,
    session_recording: {
      // Mask every input value (passwords, connection URLs, goals).
      maskAllInputs: true,
      // Mask all text inside any element flagged `data-ph-mask="true"`
      // (the chat conversation list) and its descendants — replay keeps
      // layout + click targets but never the DB content rendered there.
      maskTextSelector: '[data-ph-mask="true"], [data-ph-mask="true"] *',
    },
  });

  // Stitch the lifecycle across visits: once we know the user, tie the
  // session to their stable id so funnels/retention span return visits.
  if (user) {
    posthog.identify(user.id, user.email ? { email: user.email } : undefined);
  }
}
