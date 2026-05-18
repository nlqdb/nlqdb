import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(HERE, "..", "App.vue"), "utf-8");
const MAIN = readFileSync(join(HERE, "..", "main.ts"), "utf-8");

test.describe("@vue · examples/vue/", () => {
  test("source files use @nlqdb/vue wrapper + configureNlqdb registration", async () => {
    expect(APP).toMatch(/from ["']@nlqdb\/vue["']/);
    expect(APP).toMatch(/<NlqData\b/);
    expect(APP).toMatch(/goal="upcoming meals this week, soonest first"/);
    expect(APP).toMatch(/template="table"/);
    expect(APP).toMatch(/refresh="30s"/);
    // Vue dynamic binding for runtime config.
    expect(APP).toMatch(/:api-key="apiKey"/);
    // Vue-idiomatic event handler, not a prop-style onLoad.
    expect(APP).toMatch(/@load="onLoad"/);

    expect(MAIN).toMatch(/configureNlqdb\(app\)/);
  });

  test.fixme(
    "boots a real Vite dev server and renders the page",
    async ({ page }) => {
      await page.goto("http://localhost:5173/");
      await expect(page.locator("nlq-data")).toBeVisible();
    },
  );
});
