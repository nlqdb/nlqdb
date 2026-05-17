// Astro example — Phase 0 contract. See examples/nextjs/e2e/ for the
// pattern. Persona: P1 (Solo Builder ships an Astro static site).

import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(HERE, "..", "index.astro"), "utf-8");

test.describe("@astro · examples/astro/", () => {
  test("source file renders the canonical <nlq-data> contract", async () => {
    expect(SOURCE).toMatch(/<nlq-data/);
    expect(SOURCE).toMatch(/goal="today's orders, newest first"/);
    expect(SOURCE).toMatch(/template="table"/);
    expect(SOURCE).toMatch(/refresh="5s"/);
    // Astro's `is:inline` keeps the script tag verbatim — documented
    // in the example's README.
    expect(SOURCE).toMatch(/is:inline/);
    // Astro mandates `PUBLIC_*` prefix for client-visible env vars.
    expect(SOURCE).toMatch(/PUBLIC_NLQDB_KEY/);
  });

  test.fixme(
    "boots a real Astro dev server and renders the page",
    async ({ page }) => {
      await page.goto("http://localhost:4321/");
      await expect(page.locator("nlq-data")).toBeVisible();
    },
  );
});
