// Cloudflare Turnstile challenge hook for the anonymous-create bot
// floor (SK-ANON-012 — unconditional invisible verification on every
// anon create; supersedes SK-ANON-007's 3-in-5-min burst gate).
//
// When `/v1/ask` returns 428 with `{ code: "challenge_required" }`,
// `<CreateForm>`'s retry seam calls `solveChallenge()`, which renders an
// invisible Turnstile widget, runs the challenge, and resolves the
// `cf-turnstile-response` token so the create can be resubmitted. The
// marketing hero AND `/app/new` both reach this path via `<CreateForm>`
// since SK-WEB-008 unified them on the real-LLM `/v1/ask` flow.
//
// The sitekey is baked at build time via `PUBLIC_TURNSTILE_SITE_KEY`
// (deploy-web.yml, mirroring PUBLIC_API_BASE). Absent — dev, PR
// previews, or before the widget ships — `solveChallenge()` returns
// null and the API fails open on an unset `TURNSTILE_SECRET`
// (SK-ANON-009), so `wrangler dev` keeps working without a keypair.
// Arm both halves in lockstep: set the worker secret only in the
// release that also sets this sitekey — a configured secret with no
// client token 428-kills every anon create (the run-56 outage).
//
// Every failure path (unconfigured, script blocked, challenge error,
// timeout) resolves null so the fail-open contract holds end to end.

const API_JS = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

// Bound the challenge so a hung/blocked Turnstile never wedges the
// create submit — on timeout we resolve null and let the API decide.
const EXECUTE_TIMEOUT_MS = 10_000;

interface TurnstileRenderOptions {
  sitekey: string;
  execution?: "render" | "execute";
  callback?: (token: string) => void;
  "error-callback"?: (error?: string) => void;
  "timeout-callback"?: () => void;
}

interface TurnstileApi {
  ready(cb: () => void): void;
  render(container: HTMLElement, opts: TurnstileRenderOptions): string;
  execute(container: string | HTMLElement, opts?: TurnstileRenderOptions): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

function siteKey(): string | null {
  const env = typeof import.meta !== "undefined" ? import.meta.env : undefined;
  const key = env?.["PUBLIC_TURNSTILE_SITE_KEY"] as string | undefined;
  return key || null;
}

// Load api.js once — proxying/caching it is unsupported (Cloudflare
// pushes silent updates), so we always point at the canonical URL.
let scriptLoad: Promise<TurnstileApi | null> | null = null;

function loadTurnstile(): Promise<TurnstileApi | null> {
  if (scriptLoad) return scriptLoad;
  scriptLoad = new Promise((resolve) => {
    if (typeof document === "undefined") return resolve(null);
    if (window.turnstile) return resolve(window.turnstile);
    const script = document.createElement("script");
    script.src = API_JS;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.turnstile ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return scriptLoad;
}

export async function solveChallenge(): Promise<string | null> {
  const sitekey = siteKey();
  if (!sitekey || typeof document === "undefined") return null;

  const turnstile = await loadTurnstile();
  if (!turnstile) return null;

  return new Promise<string | null>((resolve) => {
    // Invisible-mode widgets need a mount point but render no visible
    // UI — a hidden host, removed once the challenge settles.
    const host = document.createElement("div");
    host.style.display = "none";
    document.body.appendChild(host);

    let settled = false;
    let widgetId: string | undefined;
    const timer = setTimeout(() => finish(null), EXECUTE_TIMEOUT_MS);

    function finish(token: string | null) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        if (widgetId) turnstile?.remove(widgetId);
      } catch {
        // widget already torn down — nothing to clean up
      }
      host.remove();
      resolve(token);
    }

    try {
      turnstile.ready(() => {
        try {
          widgetId = turnstile.render(host, {
            sitekey,
            execution: "execute",
            callback: (token) => finish(token),
            "error-callback": () => finish(null),
            "timeout-callback": () => finish(null),
          });
          turnstile.execute(widgetId);
        } catch {
          finish(null);
        }
      });
    } catch {
      finish(null);
    }
  });
}
