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
    expect(SOURCE).toMatch(/is:inline/);
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
