// HTML example — plain static file, no build. Runs today.
//
// Persona: P5 (Student / First-Timer drops the snippet into a local
// index.html) and P1 (Solo Builder ships a minimal landing page).
//
// We don't load the live `elements.nlqdb.com/v1.js` (Phase 1 hasn't
// published it yet). What we verify here is the README contract:
//
//   1. The example file exists at the documented path
//   2. The DOM exposes `<nlq-data>` with the four required attrs
//   3. `<nlq-action>` is wired with on-success="reload"
//
// Together these mean "if a user copy-pastes the snippet, the markup
// is what they get." When the elements package publishes, the spec's
// final block (web-component-upgrade) flips from `fixme` to active.

import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE_URL = `file://${join(HERE, "..", "index.html")}`;

test.describe("@html · examples/html/", () => {
  test("renders the README's <nlq-data> + <nlq-action> markup", async ({
    page,
  }) => {
    await page.goto(FILE_URL);

    // Title from the README — sanity check we loaded the right file.
    await expect(page).toHaveTitle(/Orders — nlqdb/);

    // The `<nlq-data>` element is in the DOM with the four required
    // attributes from the README's "scaffold + drop in this file" recipe.
    const data = page.locator("nlq-data");
    await expect(data).toHaveCount(1);
    await expect(data).toHaveAttribute("goal", /today's orders/);
    await expect(data).toHaveAttribute("api-key", /^pk_live_/);
    await expect(data).toHaveAttribute("template", "table");
    await expect(data).toHaveAttribute("refresh", "5s");

    // The `<nlq-action>` element wires the form's "Add one" affordance.
    const action = page.locator("nlq-action");
    await expect(action).toHaveCount(1);
    await expect(action).toHaveAttribute("goal", /add an order/);
    await expect(action).toHaveAttribute("on-success", "reload");
  });

  test.fixme(
    "<nlq-data> upgrades to a custom element once elements.nlqdb.com publishes",
    async ({ page }) => {
      // Phase 0: `elements.nlqdb.com/v1.js` is a 404 — the markup is
      // parsed as an unknown HTMLElement and never upgrades. When
      // `@nlqdb/elements` publishes in Phase 1, lift this fixme — the
      // assertion already holds against the live CDN.
      await page.goto(FILE_URL);
      const upgraded = await page.evaluate(() => {
        const el = document.querySelector("nlq-data");
        if (!el) return false;
        // Real upgrade: shadow root attached + a "loaded" property set.
        return Boolean((el as HTMLElement & { shadowRoot?: ShadowRoot | null }).shadowRoot);
      });
      expect(upgraded).toBe(true);
    },
  );
});
