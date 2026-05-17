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
    await expect(page).toHaveTitle(/Orders — nlqdb/);

    const data = page.locator("nlq-data");
    await expect(data).toHaveCount(1);
    await expect(data).toHaveAttribute("goal", /today's orders/);
    await expect(data).toHaveAttribute("api-key", /^pk_live_/);
    await expect(data).toHaveAttribute("template", "table");
    await expect(data).toHaveAttribute("refresh", "5s");

    const action = page.locator("nlq-action");
    await expect(action).toHaveCount(1);
    await expect(action).toHaveAttribute("goal", /add an order/);
    await expect(action).toHaveAttribute("on-success", "reload");
  });

  test.fixme(
    "<nlq-data> upgrades to a custom element once elements.nlqdb.com publishes",
    async ({ page }) => {
      await page.goto(FILE_URL);
      const upgraded = await page.evaluate(() => {
        const el = document.querySelector("nlq-data");
        if (!el) return false;
        return Boolean((el as HTMLElement & { shadowRoot?: ShadowRoot | null }).shadowRoot);
      });
      expect(upgraded).toBe(true);
    },
  );
});
