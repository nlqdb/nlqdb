// Next.js example — Phase 0 contract. The example file is a snippet
// (`page.tsx`); the live runtime needs a `next create` scaffold around
// it. Once the elements package publishes (Phase 1) and the scaffold-
// per-example layout settles, the `test.fixme` lifts.
//
// Persona: P1 (Solo Builder embeds the snippet into a Next.js side
// project) and P4 (Backend Engineer at a small startup).
//
// What this spec encodes today: the wire shape (goal + api-key,
// template, refresh) that the example file should expose once
// rendered. The single static assertion is the file contains the
// right attributes — when the scaffold lands, this becomes the boot-
// dev-server + visit-page assertion.

import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE_SOURCE = readFileSync(join(HERE, "..", "page.tsx"), "utf-8");

test.describe("@nextjs · examples/nextjs/", () => {
  test("source file renders the canonical <nlq-data> contract", async () => {
    // Same four attributes as the HTML example — every framework
    // example MUST keep the inner snippet byte-equivalent (modulo
    // syntax differences) per GLOBAL-003 surface parity.
    expect(PAGE_SOURCE).toMatch(/<nlq-data/);
    expect(PAGE_SOURCE).toMatch(/goal="today's orders, newest first"/);
    expect(PAGE_SOURCE).toMatch(/template="table"/);
    expect(PAGE_SOURCE).toMatch(/refresh="5s"/);
    // Uses next/script with afterInteractive — documented in the
    // example's README; required because <script> in JSX doesn't
    // auto-execute client-side.
    expect(PAGE_SOURCE).toMatch(/next\/script/);
    expect(PAGE_SOURCE).toMatch(/afterInteractive/);
  });

  test.fixme(
    "boots a real Next.js dev server and renders the page",
    async ({ page }) => {
      // Phase 1: scaffold the example into a tmp Next.js project,
      // boot `next dev`, visit `localhost:3000/`, assert `<nlq-data>`
      // upgrades and the staging API returns rows. Until elements
      // publishes, this assertion can't hold.
      await page.goto("http://localhost:3000/");
      await expect(page.locator("nlq-data")).toBeVisible();
    },
  );
});
