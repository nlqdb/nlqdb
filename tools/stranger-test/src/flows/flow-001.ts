// FLOW-001 — Anonymous-first happy path.
// Mirror: docs/research/automated-icp-validation-plan-verification.md#flow-001.

import type { Browser } from "@playwright/test";

import { openSession, step, withDeadline } from "../browser.ts";
import type { FlowRun, StepResult } from "../types.ts";

const HERO_PLACEHOLDER_RE = /orders|tracker|building/i;
// SK-ANON-012 gates the *second* anon /v1/ask behind sign-in: message #1
// answers free (GLOBAL-007), message #2 returns 401 `anon_device_cap`.
// FLOW-001 is the anonymous-first path, so its terminus is that wall —
// the designed conversion moment, not a failure. A 200 here would mean
// the device cap regressed (unlimited free anon asks).
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
      // Hydration race (the run-58 "submit flake", deterministic on cold
      // asset serves): fill() before the React island hydrates writes the
      // pre-hydration DOM; hydration then resets the controlled input to
      // "" and the submit button stays disabled, so the later click is
      // silently swallowed and no /v1/ask ever fires. A real stranger
      // types after the page is interactive — emulate that by re-filling
      // until the submit button reports enabled (React state holds the
      // goal), bounded at ~10 s.
      const submitBtn = page.getByRole("button", { name: /create/i }).first();
      let armed = false;
      for (let i = 0; i < 10 && !armed; i++) {
        if (i % 2 === 0) {
          await hero.fill(prompt).catch(() => {});
        } else {
          // Real key events — some hydration states swallow fill()'s
          // synthetic input event but accept trusted keystrokes.
          await hero.click().catch(() => {});
          await hero.clear().catch(() => {});
          await hero.pressSequentially(prompt, { delay: 5 }).catch(() => {});
        }
        await page.waitForTimeout(1000);
        armed = await submitBtn.isEnabled().catch(() => false);
      }
      // Self-diagnosing fail detail: the DOM value, the submit state,
      // and whether the Astro island reports hydrated (the `ssr`
      // attribute is removed on hydration).
      const diag = armed
        ? undefined
        : await page
            .evaluate(() => {
              const island = document.querySelector("astro-island");
              const input = document.querySelector<HTMLInputElement>("input[placeholder]");
              const btn = Array.from(document.querySelectorAll("button")).find((b) =>
                /create/i.test(b.textContent ?? ""),
              );
              return `value=${JSON.stringify(input?.value?.slice(0, 30))} btnDisabled=${btn?.disabled} islandSsrAttr=${island?.hasAttribute("ssr")} islandHydrated=${island?.hasAttribute("props") ? "props-present" : "no-props"}`;
            })
            .catch(() => "diag-failed");
      steps.push(
        step(
          3,
          "typed persona-seeded goal into hero",
          armed ? "ok" : "fail",
          armed ? undefined : `submit never enabled — ${diag}`,
        ),
      );
      if (!armed) failedStep = 3;
    } else {
      steps.push(step(3, "typed persona-seeded goal into hero", "skip", "blocked by earlier step"));
    }

    if (failedStep === null) {
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
    } else {
      steps.push(step(4, "submit (clicked Create the DB)", "skip", "blocked by earlier step"));
      steps.push(step(5, "/v1/ask responded within 60 s", "skip", "blocked by earlier step"));
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
      // The follow-up input is the same create field (CreateForm stays
      // mounted with the result appended below it); selectors-by-role
      // outlast placeholder-text drift better than a `last()` match.
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
            "second anon /v1/ask hits the SK-ANON-012 sign-in wall (401 + redirect)",
            "fail",
            filled ? "no second /v1/ask observed" : "could not fill follow-up input",
          ),
        );
        failedStep = 8;
      } else {
        // SK-ANON-012: the 2nd anon call returns 401; the client
        // `savePending`s the prompt (SK-ANON-011) and redirects to
        // sign-in. That wall IS the anonymous happy-path terminus
        // (GLOBAL-007 lands it at #2, not #1). A 200 here would mean
        // the per-device cap regressed to unlimited free anon asks.
        // Status alone can't tell the wall from an auth regression —
        // a generic `unauthorized` 401 (e.g. the bearer dropped from
        // the follow-up request) carries no auth_required envelope,
        // so CreateForm never redirects. The redirect usually empties
        // the response body before the walker reads it, so require
        // the envelope's cap code when the body is readable, and the
        // observed hop to /auth/sign-in when it isn't.
        const status = ask2.status();
        const body = await ask2.text().catch(() => "");
        const capCode = /anon_device_cap|anon_global_cap/.exec(body)?.[0];
        const wall =
          capCode ??
          (status === 401
            ? await page
                .waitForURL(/\/auth\/sign-in/, { timeout: 10_000 })
                .then(() => "sign-in redirect (body consumed by it)")
                .catch(() => null)
            : null);
        const capped = status === 401 && wall !== null;
        steps.push(
          step(
            8,
            "second anon /v1/ask hits the SK-ANON-012 sign-in wall (401 + redirect)",
            capped ? "ok" : "fail",
            capped
              ? `status=401 ${wall} dt=${Date.now() - t1}`
              : `status=${status} wall=${wall ?? "none"} dt=${Date.now() - t1} body=${body.slice(0, 120)}`,
          ),
        );
        if (!capped) failedStep = 8;
      }
    } else {
      steps.push(
        step(
          8,
          "second anon /v1/ask hits the SK-ANON-012 sign-in wall (401 + redirect)",
          "skip",
          "blocked by earlier step",
        ),
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
