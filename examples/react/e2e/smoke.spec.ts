import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(HERE, "..", "App.tsx"), "utf-8");

test.describe("@react · examples/react/", () => {
  test("source file uses the typed @nlqdb/react wrapper, not the raw element", async () => {
    expect(SOURCE).toMatch(/from ["']@nlqdb\/react["']/);
    expect(SOURCE).toMatch(/<NlqScript\b/);
    expect(SOURCE).toMatch(/<NlqData\b/);
    expect(SOURCE).toMatch(/goal="upcoming meals this week, soonest first"/);
    expect(SOURCE).toMatch(/template="table"/);
    expect(SOURCE).toMatch(/refresh="30s"/);
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
