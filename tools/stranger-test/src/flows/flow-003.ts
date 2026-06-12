// FLOW-003 — Comparison-driven inbound (/vs/<slug> → first query).
// Mirror: docs/research/automated-icp-validation-plan-verification.md#flow-003.

import type { Browser } from "@playwright/test";

import { openSession, step, withDeadline } from "../browser.ts";
import type { FlowRun, StepResult } from "../types.ts";

// Pinned literal mirror of `apps/web/src/data/competitors.ts` — drift fails
// the walk loudly; same regression-detector intent as `verify-flows.sh`.
// `VS_SLUGS` exported so `runner.ts` has a single source of truth.
export const SLUG_META: Readonly<Record<string, { title: string; goal: string }>> = {
  supabase: { title: "Supabase", goal: "top 5 customers by revenue this month" },
  vanna: { title: "Vanna AI", goal: "monthly revenue trend for the last 12 months" },
  mem0: { title: "Mem0", goal: "users who logged in this week and viewed pricing" },
};

export const VS_SLUGS = Object.keys(SLUG_META) as readonly string[];

const ASK_TIMEOUT_MS = 60_000;
const WALK_DEADLINE_MS = 180_000;

export async function walkFlow003(
  slug: string,
  baseUrl: string,
  userAgent: string,
  browser: Browser,
): Promise<FlowRun> {
  return withDeadline(`flow-003:${slug}`, WALK_DEADLINE_MS, () =>
    doWalk(slug, baseUrl, userAgent, browser),
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
): Promise<FlowRun> {
  const meta = SLUG_META[slug];
  const session = await openSession({ baseUrl, userAgent, browser });
  const { page, consoleErrors, httpErrors, close } = session;
  const steps: StepResult[] = [];
  const startedAt = Date.now();
  let ttfvMs: number | null = null;
  let failedStep: number | null = null;

  try {
    const url = `${baseUrl}/vs/${slug}/`;
    const navResp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const navStatus = navResp?.status() ?? 0;
    if (navStatus !== 200) {
      steps.push(step(1, `GET ${url} returns 200`, "fail", `status=${navStatus}`));
      failedStep = 1;
    } else {
      steps.push(step(1, `GET ${url} returns 200`, "ok"));
    }

    const h1Text = (
      (await page
        .locator("h1")
        .first()
        .textContent({ timeout: 5_000 })
        .catch(() => "")) ?? ""
    ).trim();
    const expectedH1 = meta ? `nlqdb vs ${meta.title}` : null;
    const h1Ok = expectedH1 !== null && h1Text === expectedH1;
    steps.push(
      step(
        2,
        "<h1> matches 'nlqdb vs <Name>'",
        h1Ok ? "ok" : "fail",
        `expected=${expectedH1 ?? "<unknown-slug>"} actual=${h1Text}`,
      ),
    );
    if (!h1Ok && failedStep === null) failedStep = 2;

    const wtcLabel = meta ? `When to choose ${meta.title}` : null;
    if (wtcLabel) {
      const wtcCount = await page
        .locator(`section:has-text("${wtcLabel}") li, h2:has-text("${wtcLabel}") + * li`)
        .count()
        .catch(() => 0);
      steps.push(
        step(
          3,
          '"When to choose <Name>" section with ≥3 <li>',
          wtcCount >= 3 ? "ok" : "fail",
          `items=${wtcCount}`,
        ),
      );
      if (wtcCount < 3 && failedStep === null) failedStep = 3;
    } else {
      steps.push(step(3, '"When to choose <Name>" section with ≥3 <li>', "skip", "unknown slug"));
    }

    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    const hasFaq = ld.some((s) => s.includes('"FAQPage"'));
    steps.push(step(4, "FAQPage JSON-LD present", hasFaq ? "ok" : "fail"));
    if (!hasFaq && failedStep === null) failedStep = 4;

    if (failedStep === null) {
      const cta = page.getByRole("button", { name: /try this query/i }).first();
      const ctaVisible = await cta.isVisible({ timeout: 5_000 }).catch(() => false);
      if (!ctaVisible) {
        steps.push(step(5, "Try this query CTA clickable", "fail", "CTA not found"));
        failedStep = 5;
      } else {
        await cta.click();
        steps.push(step(5, "Try this query CTA clickable", "ok"));
      }
    } else {
      steps.push(step(5, "Try this query CTA clickable", "skip", "blocked by earlier step"));
    }

    if (failedStep === null) {
      const draft = await page
        .evaluate(() => localStorage.getItem("nlqdb_draft"))
        .catch(() => null);
      const expectedDraft = meta?.goal;
      const draftOk = expectedDraft !== undefined && draft === expectedDraft;
      steps.push(
        step(
          6,
          "localStorage.nlqdb_draft = Competitor.demo.goal",
          draftOk ? "ok" : "fail",
          `expected=${expectedDraft ?? "<unknown>"} actual=${draft ?? "<null>"}`,
        ),
      );
      if (!draftOk) failedStep = 6;
    } else {
      steps.push(
        step(
          6,
          "localStorage.nlqdb_draft = Competitor.demo.goal",
          "skip",
          "blocked by earlier step",
        ),
      );
    }

    if (failedStep === null) {
      await page.waitForURL(/\/app\/new\/?$/, { timeout: 10_000 }).catch(() => {});
      const currentUrl = page.url();
      const onAppNew = /\/app\/new\/?$/.test(currentUrl);
      steps.push(
        step(
          7,
          "navigated to /app/new with form prefilled",
          onAppNew ? "ok" : "fail",
          `url=${currentUrl}`,
        ),
      );
      if (!onAppNew) failedStep = 7;
    } else {
      steps.push(
        step(7, "navigated to /app/new with form prefilled", "skip", "blocked by earlier step"),
      );
    }

    // Step 8 matches the mirror's "Submit. Assert FLOW-001 step 5+ behaviour."
    if (failedStep === null) {
      const submit = page.getByRole("button", { name: /create/i }).first();
      const t0 = Date.now();
      // `.catch` at construction — see flow-001/002 for the Bun rationale.
      const askWaiter = page
        .waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/v1/ask"), {
          timeout: ASK_TIMEOUT_MS,
        })
        .catch(() => null);
      await submit.click().catch(() => {});
      const askResp = await askWaiter;
      if (!askResp) {
        steps.push(
          step(
            8,
            "submit → /v1/ask 200 + table within 60 s",
            "fail",
            "no /v1/ask response observed",
          ),
        );
        failedStep = 8;
      } else {
        ttfvMs = Date.now() - t0;
        const status = askResp.status();
        const body = await askResp.text().catch(() => "");
        steps.push(
          step(
            8,
            "submit → /v1/ask 200 + table within 60 s",
            status === 200 ? "ok" : "fail",
            status === 200
              ? `status=200 ttfvMs=${ttfvMs}`
              : `status=${status} ttfvMs=${ttfvMs} body=${body.slice(0, 120)}`,
          ),
        );
        if (status !== 200) failedStep = 8;
      }
    } else {
      steps.push(
        step(8, "submit → /v1/ask 200 + table within 60 s", "skip", "blocked by earlier step"),
      );
    }

    // Step 9: /llms.txt enumerates this slug. Independent from steps 5-8 —
    // a separate GET, useful even when the submit fails earlier.
    const llmsResp = await page.request.get(`${baseUrl}/llms.txt`).catch(() => null);
    if (!llmsResp || llmsResp.status() !== 200) {
      steps.push(
        step(
          9,
          "/llms.txt lists this vs slug",
          "fail",
          `status=${llmsResp?.status() ?? "no-response"}`,
        ),
      );
      if (failedStep === null) failedStep = 9;
    } else {
      const txt = await llmsResp.text();
      const listed = txt.includes(`/vs/${slug}`);
      steps.push(step(9, "/llms.txt lists this vs slug", listed ? "ok" : "fail"));
      if (!listed && failedStep === null) failedStep = 9;
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
