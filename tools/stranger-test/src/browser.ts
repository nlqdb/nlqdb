import { type Browser, type BrowserContext, chromium, type Page } from "@playwright/test";

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
  close: () => Promise<void>;
};

// 401 = expected session-probe; 429 = rate-limit story tracked under
// rate-limit/FEATURE.md, not the happy-path regression this primitive
// guards against.
const IGNORED_STATUSES = new Set([401, 429]);

// The stranger must reach the surface the way a stranger does: directly.
// Chromium reads these from its env on Linux, and an agent sandbox's proxy
// resets its CONNECT, so stripping them is the only config that reaches prod
// (measured 2026-07-25 — `--no-proxy-server` and `proxy: direct://` do not).
const PROXY_ENV_KEYS = ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"] as const;

export async function launchBrowser(): Promise<Browser> {
  const env = { ...process.env };
  for (const key of PROXY_ENV_KEYS) delete env[key];
  return chromium.launch({ headless: true, env });
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
  return {
    ctx,
    page,
    consoleErrors,
    httpErrors,
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
