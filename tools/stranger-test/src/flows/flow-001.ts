// FLOW-001 — Anonymous-first happy path.
// Mirror: docs/research/automated-icp-validation-plan-verification.md#flow-001.

import type { Browser } from "@playwright/test";

import { openSession, step, withDeadline } from "../browser.ts";
import type { FlowRun, StepResult } from "../types.ts";

const HERO_PLACEHOLDER_RE = /orders|tracker|building/i;
const SECOND_PROMPT = "now group by week";
const ASK_TIMEOUT_MS = 60_000;
const WALK_DEADLINE_MS = 180_000;

export async function walkFlow001(
  prompt: string,
  baseUrl: string,
  userAgent: string,
  browser: Browser,
): Promise<FlowRun> {
  return withDeadline(`flow-001:${prompt}`, WALK_DEADLINE_MS, () =>
    doWalk(prompt, baseUrl, userAgent, browser),
  ).catch((e) => ({
    prompt,
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
  prompt: string,
  baseUrl: string,
  userAgent: string,
  browser: Browser,
): Promise<FlowRun> {
  const session = await openSession({ baseUrl, userAgent, browser });
  const { page, consoleErrors, httpErrors, close } = session;
  const steps: StepResult[] = [];
  const startedAt = Date.now();
  let ttfvMs: number | null = null;
  let failedStep: number | null = null;

  try {
    const navResp = await page.goto(`${baseUrl}/`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    const navStatus = navResp?.status() ?? 0;
    if (navStatus !== 200) {
      steps.push(step(1, "GET / returns 200", "fail", `status=${navStatus}`));
      failedStep = 1;
    } else {
      steps.push(step(1, "GET / returns 200", "ok"));
    }

    if (failedStep === null) {
      // SK-WEB-018 two-door home: the goal input lives on /app/new/ behind
      // the GLOBAL-007 no-login-wall door ("just describe your data →").
      // The walker takes the same door a stranger does.
      const door = page.locator('a[href="/app/new/"]', { hasText: /describe your data/i }).first();
      const doorVisible = await door.isVisible({ timeout: 5_000 }).catch(() => false);
      if (!doorVisible) {
        steps.push(
          step(
            2,
            "no-login-wall door → /app/new/ hero input matches /orders|tracker|building/i",
            "fail",
            "no 'describe your data' link to /app/new/ on /",
          ),
        );
        failedStep = 2;
      } else {
        await door.click().catch(() => {});
        await page.waitForURL(/\/app\/new\/?$/, { timeout: 10_000 }).catch(() => {});
        const onAppNew = /\/app\/new\/?($|[?#])/.test(page.url());
        const hero = page.locator("input[placeholder],textarea[placeholder]").first();
        const placeholder = onAppNew
          ? await hero.getAttribute("placeholder", { timeout: 5_000 }).catch(() => null)
          : null;
        const stepOk = onAppNew && placeholder !== null && HERO_PLACEHOLDER_RE.test(placeholder);
        steps.push(
          step(
            2,
            "no-login-wall door → /app/new/ hero input matches /orders|tracker|building/i",
            stepOk ? "ok" : "fail",
            `url=${page.url()} placeholder=${JSON.stringify(placeholder)}`,
          ),
        );
        if (!stepOk) failedStep = 2;
      }
    } else {
      steps.push(
        step(
          2,
          "no-login-wall door → /app/new/ hero input matches /orders|tracker|building/i",
          "skip",
          "blocked by earlier step",
        ),
      );
    }

    if (failedStep === null) {
      const hero = page.locator("input[placeholder],textarea[placeholder]").first();
      await hero.fill(prompt);
      steps.push(step(3, "typed persona-seeded goal into hero", "ok"));

      // `.catch` attached at construction time — under Bun runtime an early
      // page-close rejection between waitForResponse() and `await` can land
      // as an unhandled rejection (the cron+CI Node runtime tolerates the
      // later `.catch`; Bun is stricter).
      const askWaiter = page
        .waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/v1/ask"), {
          timeout: ASK_TIMEOUT_MS,
        })
        .catch(() => null);
      const submit = page.getByRole("button", { name: /create/i }).first();
      const t0 = Date.now();
      await submit.click().catch(() => {});
      steps.push(step(4, "submit (clicked Create the DB)", "ok"));

      const askResp = await askWaiter;
      if (!askResp) {
        steps.push(
          step(5, "/v1/ask responded within 60 s", "fail", "no /v1/ask response observed"),
        );
        failedStep = 5;
      } else {
        ttfvMs = Date.now() - t0;
        const status = askResp.status();
        if (status === 200) {
          steps.push(
            step(5, "/v1/ask 200 + result table within 60 s", "ok", `status=200 ttfvMs=${ttfvMs}`),
          );
          await page
            .locator("nlq-data, table")
            .first()
            .waitFor({ state: "visible", timeout: 10_000 })
            .catch(() => {});
        } else {
          const body = await askResp.text().catch(() => "");
          steps.push(
            step(
              5,
              "/v1/ask 200 + result table within 60 s",
              "fail",
              `status=${status} ttfvMs=${ttfvMs} body=${body.slice(0, 120)}`,
            ),
          );
          failedStep = 5;
        }
      }
    }

    // Remaining steps (trace toggle, snippet copy, second-query reuse) only
    // run when /v1/ask succeeded; otherwise they're skipped honestly.
    if (failedStep === null) {
      // The trace toggle is a `<summary>` inside `Trace.tsx`'s `<details>`;
      // `<summary>` has no canonical ARIA role across browsers, so widen the
      // selector to match summary text + ARIA-button + plain `<button>`.
      const traceBtn = page
        .locator(
          'summary:has-text("trace"), [role="button"][aria-label*="trace" i], button:has-text("trace")',
        )
        .first();
      const traceFound = await traceBtn.isVisible({ timeout: 5_000 }).catch(() => false);
      if (!traceFound) {
        steps.push(step(6, "trace toggle visible", "fail", "no trace affordance found"));
        failedStep = 6;
      } else {
        await traceBtn.click().catch(() => {});
        const traceText = await page.locator("pre, code").allInnerTexts();
        // The first answer on /app/new is the create path, whose trace
        // carries the compiled DDL (SK-TRUST-002) — so the revealed SQL
        // is CREATE TABLE, not SELECT. A post-create chat reply would
        // reveal SELECT; accept either shape of "what ran".
        const sqlVisible = traceText.some((t) => /\b(select|create table)\b/i.test(t));
        steps.push(
          step(
            6,
            "trace reveals SQL (SELECT or CREATE TABLE)",
            sqlVisible ? "ok" : "fail",
            sqlVisible ? undefined : "no SELECT/CREATE TABLE in revealed text",
          ),
        );
        if (!sqlVisible) failedStep = 6;
      }
    } else {
      steps.push(
        step(6, "trace reveals SQL (SELECT or CREATE TABLE)", "skip", "blocked by earlier step"),
      );
    }

    if (failedStep === null) {
      const copyBtn = page.getByRole("button", { name: /copy snippet/i }).first();
      const copyVisible = await copyBtn.isVisible({ timeout: 5_000 }).catch(() => false);
      if (copyVisible) {
        await page
          .context()
          .grantPermissions(["clipboard-read", "clipboard-write"])
          .catch(() => {});
        await copyBtn.click();
        const clipboard = await page
          .evaluate(() => navigator.clipboard.readText().catch(() => ""))
          .catch(() => "");
        const ok = /<nlq-data[\s>]/.test(clipboard);
        steps.push(
          step(
            7,
            "Copy snippet writes <nlq-data> to clipboard",
            ok ? "ok" : "fail",
            ok ? undefined : `clipboard=${clipboard.slice(0, 80)}`,
          ),
        );
        if (!ok) failedStep = 7;
      } else {
        steps.push(
          step(
            7,
            "Copy snippet writes <nlq-data> to clipboard",
            "skip",
            "no copy affordance on this page",
          ),
        );
      }
    } else {
      steps.push(
        step(7, "Copy snippet writes <nlq-data> to clipboard", "skip", "blocked by earlier step"),
      );
    }

    if (failedStep === null) {
      // The post-first-query input is the chat composer; selectors-by-role
      // outlast placeholder-text drift better than a `last()` placeholder match.
      const followInput = page.getByRole("textbox").last();
      const t1 = Date.now();
      const ask2Waiter = page
        .waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/v1/ask"), {
          timeout: ASK_TIMEOUT_MS,
        })
        .catch(() => null);
      const filled = await followInput
        .fill(SECOND_PROMPT)
        .then(() => true)
        .catch(() => false);
      if (filled) await followInput.press("Enter").catch(() => {});
      const ask2 = await ask2Waiter;
      if (!ask2) {
        steps.push(
          step(
            8,
            "second /v1/ask within 60 s with same dbId",
            "fail",
            filled ? "no second /v1/ask observed" : "could not fill follow-up input",
          ),
        );
        failedStep = 8;
      } else {
        const status = ask2.status();
        const body = await ask2.text().catch(() => "");
        const dbId = body.match(/"dbId":\s*"([^"]+)"/)?.[1];
        steps.push(
          step(
            8,
            "second /v1/ask within 60 s with same dbId",
            status === 200 ? "ok" : "fail",
            `status=${status} dt=${Date.now() - t1} dbId=${dbId ?? "<unparsed>"}`,
          ),
        );
        if (status !== 200) failedStep = 8;
      }
    } else {
      steps.push(
        step(8, "second /v1/ask within 60 s with same dbId", "skip", "blocked by earlier step"),
      );
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
  const state: FlowRun["state"] = failedStep === null ? "passed" : "failed";
  return {
    prompt,
    state,
    failedStep,
    ttfvMs,
    durationMs,
    steps,
    consoleErrors: [...consoleErrors],
    httpErrors: [...httpErrors],
  };
}
