import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(HERE, "..", "app.vue"), "utf-8");

test.describe("@nuxt · examples/nuxt/", () => {
  test("source file renders the canonical <nlq-data> contract", async () => {
    expect(SOURCE).toMatch(/<nlq-data/);
    expect(SOURCE).toMatch(/goal="today's orders, newest first"/);
    expect(SOURCE).toMatch(/template="table"/);
    expect(SOURCE).toMatch(/refresh="5s"/);
    expect(SOURCE).toMatch(/useHead/);
    expect(SOURCE).toMatch(/useRuntimeConfig/);
  });

  test.fixme(
    "boots a real Nuxt dev server and renders the page",
    async ({ page }) => {
      await page.goto("http://localhost:3000/");
      await expect(page.locator("nlq-data")).toBeVisible();
    },
  );
});
