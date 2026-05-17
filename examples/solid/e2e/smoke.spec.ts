import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(HERE, "..", "App.tsx"), "utf-8");

test.describe("@solid · examples/solid/", () => {
  test("source file uses the typed @nlqdb/solid wrapper for a real-time dashboard", async () => {
    expect(SOURCE).toMatch(/from ["']@nlqdb\/solid["']/);
    expect(SOURCE).toMatch(/<NlqData\b/);
    expect(SOURCE).toMatch(
      /goal="API errors in the last 5 minutes, grouped by status_code"/,
    );
    expect(SOURCE).toMatch(/template="table"/);
    // 5s refresh is the dashboard's defining characteristic — assert it.
    expect(SOURCE).toMatch(/refresh="5s"/);
    expect(SOURCE).toMatch(/onLoad=/);
    // Wrapper users get camelCase apiKey, not kebab api-key.
    expect(SOURCE).not.toMatch(/api-key=/);
  });

  test.fixme(
    "boots a real Vite dev server and renders the page",
    async ({ page }) => {
      await page.goto("http://localhost:5173/");
      await expect(page.locator("nlq-data")).toBeVisible();
    },
  );
});
