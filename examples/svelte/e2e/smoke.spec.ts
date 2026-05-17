import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(HERE, "..", "App.svelte"), "utf-8");

test.describe("@svelte · examples/svelte/", () => {
  test("source file uses the typed @nlqdb/svelte wrapper", async () => {
    expect(SOURCE).toMatch(/from ["']@nlqdb\/svelte["']/);
    expect(SOURCE).toMatch(/<NlqData\b/);
    expect(SOURCE).toMatch(/goal="all users, newest first"/);
    expect(SOURCE).toMatch(/template="table"/);
    expect(SOURCE).toMatch(/refresh="60s"/);
    // Svelte 5 runes-style lowercase callback, not on:load.
    expect(SOURCE).toMatch(/onload=\{handleLoad\}/);
    expect(SOURCE).not.toMatch(/on:load=/);
    // Wrapper users get the camelCase apiKey prop, not the raw element's api-key.
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
