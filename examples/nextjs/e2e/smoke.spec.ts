import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE_SOURCE = readFileSync(join(HERE, "..", "page.tsx"), "utf-8");

test.describe("@nextjs · examples/nextjs/", () => {
  test("source file renders the canonical <nlq-data> contract", async () => {
    expect(PAGE_SOURCE).toMatch(/<nlq-data/);
    expect(PAGE_SOURCE).toMatch(/goal="today's orders, newest first"/);
    expect(PAGE_SOURCE).toMatch(/template="table"/);
    expect(PAGE_SOURCE).toMatch(/refresh="5s"/);
    expect(PAGE_SOURCE).toMatch(/next\/script/);
    expect(PAGE_SOURCE).toMatch(/afterInteractive/);
  });

  test.fixme(
    "boots a real Next.js dev server and renders the page",
    async ({ page }) => {
      await page.goto("http://localhost:3000/");
      await expect(page.locator("nlq-data")).toBeVisible();
    },
  );
});
