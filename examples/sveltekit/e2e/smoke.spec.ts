// SvelteKit example — Phase 0 contract. See examples/nextjs/e2e/ for
// the pattern. Persona: P4 (Backend Engineer using SvelteKit).

import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(HERE, "..", "+page.svelte"), "utf-8");

test.describe("@sveltekit · examples/sveltekit/", () => {
  test("source file renders the canonical <nlq-data> contract", async () => {
    expect(SOURCE).toMatch(/<nlq-data/);
    expect(SOURCE).toMatch(/goal="today's orders, newest first"/);
    expect(SOURCE).toMatch(/template="table"/);
    expect(SOURCE).toMatch(/refresh="5s"/);
    // <svelte:head> injects the elements script — documented in the README.
    expect(SOURCE).toMatch(/<svelte:head>/);
    // SvelteKit's PUBLIC_ env var is read via $env/static/public.
    expect(SOURCE).toMatch(/PUBLIC_NLQDB_KEY/);
  });

  test.fixme(
    "boots a real SvelteKit dev server and renders the page",
    async ({ page }) => {
      await page.goto("http://localhost:5173/");
      await expect(page.locator("nlq-data")).toBeVisible();
    },
  );
});
