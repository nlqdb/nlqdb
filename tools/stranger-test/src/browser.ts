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

export async function launchBrowser(): Promise<Browser> {
  // Chromium ignores HTTPS_PROXY by default; honour it so the walker runs
  // from proxied agent sandboxes too (no-op on the cron/laptop path).
  // openSession's ignoreHTTPSErrors already tolerates the proxy's CA.
  const proxy = process.env["HTTPS_PROXY"] ?? process.env["https_proxy"];
  return chromium.launch({
    headless: true,
    ...(proxy ? { proxy: { server: proxy } } : {}),
  });
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
