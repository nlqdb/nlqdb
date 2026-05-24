// FLOW-002 — Pain-driven AEO inbound (/solve/<slug> → first query).
// Mirror: docs/research/automated-icp-validation-plan-verification.md#flow-002.

import type { Browser } from "@playwright/test";

import {
  assertInviteCaptured,
  openSession,
  redactInviteFromUrl,
  step,
  withDeadline,
  withInviteParam,
} from "../browser.ts";
import type { FlowRun, StepResult } from "../types.ts";

// Pinned literal mirror of `apps/web/src/data/solve.ts` `demoGoal` values;
// drift between this map and the data file fails the walk loudly, which is
// the regression detector we want — see `scripts/verify-flows.sh` for the
// same pattern. `SOLVE_SLUGS` is exported so `runner.ts` has a single
// source of truth (avoids duplication that would silently desync).
export const SLUG_DEMO_GOAL: Readonly<Record<string, string>> = {
  "cheap-internal-dashboard": "today's orders aggregated by drink with revenue",
  "give-ai-agent-persistent-memory": "recent agent memory across threads in the last day",
  "skip-postgres-setup-side-project": "show recent customer contacts sorted by last touch",
  "natural-language-sql-without-training-data":
    "feedback from the last 24 hours grouped by channel",
  "ship-leaderboard-no-sql": "top players by score for the current week",
};

export const SOLVE_SLUGS = Object.keys(SLUG_DEMO_GOAL) as readonly string[];

const ASK_TIMEOUT_MS = 60_000;
const WALK_DEADLINE_MS = 180_000;

export async function walkFlow002(
  slug: string,
  baseUrl: string,
  userAgent: string,
  browser: Browser,
  inviteCode: string | null = null,
): Promise<FlowRun> {
  return withDeadline(`flow-002:${slug}`, WALK_DEADLINE_MS, () =>
    doWalk(slug, baseUrl, userAgent, browser, inviteCode),
  ).catch((e) => ({
    prompt: slug,
    state: "failed" as const,
    failedStep: 0,
    ttfvMs: null,
    durationMs: WALK_DEADLINE_MS,
    steps: [
      step(0, "walk deadline", "fail", e instanceof Error ? e.message.slice(0, 240) : String(e)),
    ],
    consoleErrors: [],
    httpErrors: [],
  }));
}

async function doWalk(
  slug: string,
  baseUrl: string,
  userAgent: string,
  browser: Browser,
  inviteCode: string | null,
): Promise<FlowRun> {
  const expectedDraft = SLUG_DEMO_GOAL[slug];
  const session = await openSession({ baseUrl, userAgent, browser });
  const { page, consoleErrors, httpErrors, close } = session;
  const steps: StepResult[] = [];
  const startedAt = Date.now();
  let ttfvMs: number | null = null;
  let failedStep: number | null = null;

  // The CTA emits the event synchronously then calls `location.assign`,
  // so an in-window spy gets wiped by the navigation. Persist into
  // sessionStorage instead — it survives same-origin navigations and
  // can be read on /app/new.
  await page.addInitScript(() => {
    const w = window as unknown as {
      __nlqdb_logsnag?: (e: string, p?: Record<string, unknown>) => void;
    };
    w.__nlqdb_logsnag = (event, props) => {
      try {
        const raw = sessionStorage.getItem("__nlqdb_logsnag_events");
        const arr = raw ? (JSON.parse(raw) as unknown[]) : [];
        arr.push({ event, ...(props !== undefined ? { props } : {}) });
        sessionStorage.setItem("__nlqdb_logsnag_events", JSON.stringify(arr));
      } catch {
        /* ignore — analytics should never break the user flow */
      }
    };
  });

  try {
    const url = `${baseUrl}${withInviteParam(`/solve/${slug}/`, inviteCode)}`;
    // SK-GATE-007 codes are 30-day-TTL single-use bypasses — never
    // interpolate the raw URL into a step description; the JSON shipped
    // to the cron artifact would carry the live code for 90 days.
    const safeUrl = redactInviteFromUrl(url);
    const navResp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const navStatus = navResp?.status() ?? 0;
    if (navStatus !== 200) {
      steps.push(step(1, `GET ${safeUrl} returns 200`, "fail", `status=${navStatus}`));
      failedStep = 1;
    } else {
      steps.push(step(1, `GET ${safeUrl} returns 200`, "ok"));
    }

    if (inviteCode !== null && failedStep === null) {
      const inviteStep = await assertInviteCaptured(page, 10, inviteCode);
      steps.push(inviteStep);
      if (inviteStep.status === "fail") failedStep = 10;
    }

    const h1Text =
      (await page
        .locator("h1")
        .first()
        .textContent({ timeout: 5_000 })
        .catch(() => "")) ?? "";
    steps.push(
      step(
        2,
        "<h1> rendered",
        h1Text.trim().length > 0 ? "ok" : "fail",
        `h1=${h1Text.trim().slice(0, 80)}`,
      ),
    );
    if (h1Text.trim().length === 0 && failedStep === null) failedStep = 2;

    const ldScripts = await page.locator('script[type="application/ld+json"]').allTextContents();
    const hasFaq = ldScripts.some((s) => s.includes('"FAQPage"'));
    const hasHowTo = ldScripts.some((s) => s.includes('"HowTo"'));
    steps.push(
      step(
        3,
        "FAQPage + HowTo JSON-LD present",
        hasFaq && hasHowTo ? "ok" : "fail",
        `faq=${hasFaq} howto=${hasHowTo}`,
      ),
    );
    if (!(hasFaq && hasHowTo) && failedStep === null) failedStep = 3;

    const limitsHeading = page.getByText("What nlqdb doesn't do here").first();
    const limitsVisible = await limitsHeading.isVisible({ timeout: 5_000 }).catch(() => false);
    let limitItemCount = 0;
    if (limitsVisible) {
      limitItemCount = await page
        .locator('section:has-text("What nlqdb doesn\'t do here") li')
        .count()
        .catch(() => 0);
    }
    const limitsOk = limitsVisible && limitItemCount >= 2;
    steps.push(
      step(
        4,
        "honest-limits section with ≥2 <li>",
        limitsOk ? "ok" : "fail",
        `visible=${limitsVisible} items=${limitItemCount}`,
      ),
    );
    if (!limitsOk && failedStep === null) failedStep = 4;

    if (failedStep === null) {
      const cta = page.getByRole("button", { name: /try this query/i }).first();
      const ctaVisible = await cta.isVisible({ timeout: 5_000 }).catch(() => false);
      if (!ctaVisible) {
        steps.push(step(5, "Try this query CTA clickable", "fail", "CTA not found on page"));
        failedStep = 5;
      } else {
        await cta.click();
        steps.push(step(5, "Try this query CTA clickable", "ok"));
      }
    } else {
      steps.push(step(5, "Try this query CTA clickable", "skip", "blocked by earlier step"));
    }

    if (failedStep === null) {
      // Read localStorage on the origin BEFORE the navigation lands —
      // CTA's saveDraft + emit + location.assign all run synchronously.
      const draft = await page
        .evaluate(() => localStorage.getItem("nlqdb_draft"))
        .catch(() => null);
      const draftOk = expectedDraft !== undefined && draft === expectedDraft;
      steps.push(
        step(
          6,
          "localStorage.nlqdb_draft = SolveEntry.demoGoal",
          draftOk ? "ok" : "fail",
          `expected=${expectedDraft ?? "<unknown-slug>"} actual=${draft ?? "<null>"}`,
        ),
      );
      if (!draftOk) failedStep = 6;
    } else {
      steps.push(
        step(
          6,
          "localStorage.nlqdb_draft = SolveEntry.demoGoal",
          "skip",
          "blocked by earlier step",
        ),
      );
    }

    if (failedStep === null) {
      await page.waitForURL(/\/app\/new\/?$/, { timeout: 10_000 }).catch(() => {});
      const onAppNew = /\/app\/new\/?$/.test(page.url());
      steps.push(step(7, "navigated to /app/new", onAppNew ? "ok" : "fail", `url=${page.url()}`));
      if (!onAppNew) failedStep = 7;
    } else {
      steps.push(step(7, "navigated to /app/new", "skip", "blocked by earlier step"));
    }

    if (failedStep === null) {
      const events = await page
        .evaluate(() => {
          try {
            const raw = sessionStorage.getItem("__nlqdb_logsnag_events");
            return raw ? (JSON.parse(raw) as unknown[]) : [];
          } catch {
            return [];
          }
        })
        .catch(() => []);
      const sawEvent =
        Array.isArray(events) &&
        events.some((ev) => {
          return (
            typeof ev === "object" &&
            ev !== null &&
            (ev as { event?: unknown }).event === "solve.try_query_clicked"
          );
        });
      steps.push(
        step(
          8,
          "solve.try_query_clicked event fired",
          sawEvent ? "ok" : "fail",
          sawEvent ? undefined : `events=${JSON.stringify(events).slice(0, 120)}`,
        ),
      );
      if (!sawEvent) failedStep = 8;
    } else {
      steps.push(step(8, "solve.try_query_clicked event fired", "skip", "blocked by earlier step"));
    }

    if (failedStep === null) {
      const submit = page.getByRole("button", { name: /create/i }).first();
      const t0 = Date.now();
      // `.catch` at construction — keeps Bun's strict unhandled-rejection
      // detector happy when the page closes mid-flight; cron's Node tolerates
      // either shape.
      const askWaiter = page
        .waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/v1/ask"), {
          timeout: ASK_TIMEOUT_MS,
        })
        .catch(() => null);
      await submit.click().catch(() => {});
      const askResp = await askWaiter;
      if (!askResp) {
        steps.push(
          step(9, "/v1/ask 200 + table within 60 s", "fail", "no /v1/ask response observed"),
        );
        failedStep = 9;
      } else {
        ttfvMs = Date.now() - t0;
        const status = askResp.status();
        const body = await askResp.text().catch(() => "");
        const gate = body.match(/"status":\s*"feature_gated"/);
        // With invite + feature_gated = SK-GATE-007 regression signature.
        const gateNote = gate
          ? inviteCode === null
            ? "feature_gated"
            : "feature_gated WITH invite — SK-GATE-007 regression"
          : "no";
        steps.push(
          step(
            9,
            "/v1/ask 200 + table within 60 s",
            status === 200 ? "ok" : "fail",
            `status=${status} ttfvMs=${ttfvMs} gate=${gateNote}`,
          ),
        );
        if (status !== 200) failedStep = 9;
      }
    } else {
      steps.push(step(9, "/v1/ask 200 + table within 60 s", "skip", "blocked by earlier step"));
    }
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    steps.push(
      step(
        failedStep ?? steps.length + 1,
        "unexpected walker exception",
        "fail",
        detail.slice(0, 240),
      ),
    );
    if (failedStep === null) failedStep = steps.length;
  } finally {
    await close();
  }

  const durationMs = Date.now() - startedAt;
  return {
    prompt: slug,
    state: failedStep === null ? "passed" : "failed",
    failedStep,
    ttfvMs,
    durationMs,
    steps,
    consoleErrors: [...consoleErrors],
    httpErrors: [...httpErrors],
  };
}
