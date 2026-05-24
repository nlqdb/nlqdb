import { type Browser, type BrowserContext, chromium, type Page } from "@playwright/test";

import type { StepResult } from "./types.ts";

// 80-bit min per SK-GATE-003; the runner already validates this against
// the CLI/env input, but a runtime guard here keeps the contract local
// to the only function that writes the code into a navigation URL.
const INVITE_CODE_RE = /^[A-Za-z0-9_-]{16,128}$/;

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
  return chromium.launch({ headless: true });
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
  // Defence-in-depth — every push site that interpolates a URL or
  // page-supplied string runs through `redactInviteFromUrl` before it
  // lands in the JSON artifact. The redactor is a no-op on strings that
  // don't carry `[?&]invite=`, so the cost is one regex per push.
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(redactInviteFromUrl(msg.text()).slice(0, 240));
  });
  page.on("pageerror", (e) => {
    consoleErrors.push(`pageerror: ${redactInviteFromUrl(e.message).slice(0, 240)}`);
  });
  page.on("response", (r) => {
    const s = r.status();
    if (s >= 400 && s < 600 && !IGNORED_STATUSES.has(s)) {
      httpErrors.push(`${r.request().method()} ${s} ${redactInviteFromUrl(r.url()).slice(0, 200)}`);
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

// SK-STRG-004 — append `?invite=<code>` to the path the walker navigates
// to. captureInviteFromUrl() in apps/web/src/lib/invite.ts reads it on
// load and stores it in localStorage["nlqdb_invite"]; the api.ts client
// then forwards X-Invite-Code on /v1/ask. `path` is the path-with-trailing-
// slash the walker would otherwise have used (e.g. `/`, `/solve/foo/`,
// `/vs/bar/`); a query string already present is preserved.
export function withInviteParam(path: string, inviteCode: string | null): string {
  if (inviteCode === null) return path;
  if (!INVITE_CODE_RE.test(inviteCode)) {
    throw new Error("invite code failed shape guard — refusing to forward to navigation URL");
  }
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}invite=${encodeURIComponent(inviteCode)}`;
}

// Strip the `invite=` query value before a URL is interpolated into any
// agent-readable surface (step description, stdout line, runner summary).
// The raw code MUST NOT appear in JSON artifacts: SK-GATE-007 codes are
// 30-day-TTL single-use gate bypasses, and the artifact dir is what the
// daily cron uploads to GH Actions for 90 days. Returns the URL with the
// invite value replaced by `<redacted>`; non-invite query params survive.
export function redactInviteFromUrl(url: string): string {
  return url.replace(/([?&]invite=)[^&#]*/gi, "$1<redacted>");
}

// Assertion shared by every flow when invite-bearing: prove
// captureInviteFromUrl() persisted the code AND stripped the URL param.
// Returns an `ok` step on success, a `fail` step on mismatch; the caller
// owns the step number so it slots correctly into the per-flow sequence.
export async function assertInviteCaptured(
  page: Page,
  stepNum: number,
  expected: string,
): Promise<StepResult> {
  const stored = await page
    .evaluate(() => window.localStorage.getItem("nlqdb_invite"))
    .catch(() => null);
  const urlClean = !page.url().includes("invite=");
  const ok = stored === expected && urlClean;
  // Never log the full code — `redact` shape matches scripts/flow-004-walk.sh.
  const redact = (s: string | null) =>
    s === null
      ? "<null>"
      : s.length < 12
        ? `<short:${s.length}>`
        : `${s.slice(0, 4)}..${s.slice(-4)}`;
  return step(
    stepNum,
    "captureInviteFromUrl: localStorage.nlqdb_invite set, ?invite= stripped",
    ok ? "ok" : "fail",
    ok ? undefined : `stored=${redact(stored)} expected=${redact(expected)} urlClean=${urlClean}`,
  );
}
