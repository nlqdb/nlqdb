import { existsSync } from "node:fs";

import { type Browser, type BrowserContext, chromium, type Page } from "@playwright/test";

import { isTurnstileApiRequest } from "./outcome.ts";
import type { StepResult } from "./types.ts";

export type SessionDeps = {
  baseUrl: string;
  userAgent: string;
  browser: Browser;
};

export type Session = {
  ctx: BrowserContext;
  page: Page;
  consoleErrors: string[];
  httpErrors: string[];
  // Did the page ask Cloudflare for the Turnstile challenge? See openSession.
  challengeEngaged: (timeoutMs?: number) => Promise<boolean>;
  close: () => Promise<void>;
};

// 401 = expected session-probe; 429 = rate-limit story tracked under
// rate-limit/FEATURE.md, not the happy-path regression this primitive
// guards against.
const IGNORED_STATUSES = new Set([401, 429]);

// The stranger must reach the surface the way a stranger does: directly.
// Chromium reads all of these from its env on Linux, and an agent sandbox's
// proxy resets its CONNECT, so stripping them is the only config that reaches
// prod (measured 2026-07-25 — `--no-proxy-server` and `proxy: direct://` do
// not). Only the spawned browser's env is touched; this process keeps its own.
const PROXY_ENV_KEYS = [
  "HTTPS_PROXY",
  "https_proxy",
  "HTTP_PROXY",
  "http_proxy",
  "ALL_PROXY",
  "all_proxy",
] as const;

// CI provisions the Chromium revision Playwright pins (`playwright install`),
// and the default resolution finds it. The agent sandbox ships a *different*
// prebuilt revision at a stable symlink instead (PLAYWRIGHT_BROWSERS_PATH's
// pinned dir is absent), so the default launch would try to download and fail.
// Fall back to that prebuilt browser only when the pinned one is missing, so
// the walker is container-runnable without changing CI. An explicit
// NLQDB_STRANGER_CHROMIUM override wins over both.
function resolveExecutablePath(): string | undefined {
  const override = process.env["NLQDB_STRANGER_CHROMIUM"];
  if (override) return override;
  // executablePath() computes the pinned path (and can throw if nothing is
  // registered); either "pinned present" or a throw with no prebuilt means
  // let Playwright resolve as usual.
  try {
    if (existsSync(chromium.executablePath())) return undefined; // CI: use the pin
  } catch {
    /* fall through to the prebuilt probe */
  }
  const prebuilt = "/opt/pw-browsers/chromium";
  return existsSync(prebuilt) ? prebuilt : undefined;
}

export async function launchBrowser(): Promise<Browser> {
  const env = { ...process.env };
  for (const key of PROXY_ENV_KEYS) delete env[key];
  return chromium.launch({ headless: true, env, executablePath: resolveExecutablePath() });
}

export async function openSession(deps: SessionDeps): Promise<Session> {
  const ctx = await deps.browser.newContext({
    ignoreHTTPSErrors: true,
    userAgent: deps.userAgent,
    viewport: { width: 1280, height: 800 },
  });
  const page = await ctx.newPage();
  const consoleErrors: string[] = [];
  const httpErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 240));
  });
  page.on("pageerror", (e) => {
    consoleErrors.push(`pageerror: ${e.message.slice(0, 240)}`);
  });
  page.on("response", (r) => {
    const s = r.status();
    if (s >= 400 && s < 600 && !IGNORED_STATUSES.has(s)) {
      httpErrors.push(`${r.request().method()} ${s} ${r.url().slice(0, 200)}`);
    }
  });
  // The client half of the SK-ANON-012 dance: `CreateForm`'s 428 retry seam
  // calls `solveChallenge()`, which fetches Cloudflare's api.js. Its absence
  // means the widget never ran, so the 428 is terminal for real visitors too
  // (the run-56 fail-closed outage) rather than a bot-floor decline — which is
  // the one thing that tells those two apart from outside (SK-STRG-010).
  let challengeSeen = false;
  page.on("request", (r) => {
    if (isTurnstileApiRequest(r.url())) challengeSeen = true;
  });
  return {
    ctx,
    page,
    consoleErrors,
    httpErrors,
    // Polls because the fetch is kicked off by the retry seam that the 428 we
    // are classifying has only just unblocked.
    challengeEngaged: async (timeoutMs = 10_000) => {
      const deadline = Date.now() + timeoutMs;
      while (!challengeSeen && Date.now() < deadline) {
        const alive = await page
          .waitForTimeout(200)
          .then(() => true)
          .catch(() => false);
        if (!alive) break;
      }
      return challengeSeen;
    },
    close: async () => {
      await ctx.close().catch(() => {});
    },
  };
}

// Wraps `body` with a wall-clock timeout so a stalled walk (e.g. a CDN
// keeping a connection open) never hangs the cron longer than the cap.
export async function withDeadline<T>(
  label: string,
  ms: number,
  body: () => Promise<T>,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      body(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} exceeded ${ms}ms deadline`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Wait for the content→app CTA to land and report what the create input
// actually holds. Origin-agnostic on purpose: `/app/new/` 301s to the app host
// (SK-AUTH-016), so the goal can only arrive via the SK-ANON-015 `#nlq=`
// fragment, and only the rendered input proves it did. Polls because the value
// appears when the React island hydrates and its rehydrate effect runs, not
// when the URL settles. Returns null if the goal never shows up.
export async function landedGoal(
  page: Page,
  expected: string | undefined,
  timeoutMs = 15_000,
): Promise<string | null> {
  await page.waitForURL(/\/app\/new\/?$/, { timeout: timeoutMs }).catch(() => {});
  const input = page.locator("input[placeholder],textarea[placeholder]").first();
  const deadline = Date.now() + timeoutMs;
  let last: string | null = null;
  while (Date.now() < deadline) {
    last = await input.inputValue({ timeout: 2_000 }).catch(() => null);
    if (last && (expected === undefined || last === expected)) return last;
    await page.waitForTimeout(250);
  }
  return last;
}

export function step(
  num: number,
  description: string,
  status: StepResult["status"],
  detail?: string,
): StepResult {
  return { step: num, description, status, ...(detail !== undefined ? { detail } : {}) };
}

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx] ?? null;
}
