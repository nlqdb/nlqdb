import { chromium } from "@playwright/test";

const base = "https://pr-674-nlqdb-api.omer-hochman.workers.dev";
const proxy = { server: process.env.HTTPS_PROXY ?? "" };
const browser = await chromium.launch({ headless: true, executablePath: "/opt/pw-browsers/chromium", ...(proxy ? { proxy } : {}) });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE ERR:", m.text().slice(0, 200)); });
page.on("pageerror", (e) => console.log("PAGE ERR:", String(e).slice(0, 300)));

await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 30_000 });
const door = page.locator('a[href="/app/new/"]', { hasText: /describe your data/i }).first();
console.log("door visible:", await door.isVisible({ timeout: 5000 }).catch(() => false));
await door.click();
await page.waitForURL(/\/app\/new\/?$/, { timeout: 10_000 });
console.log("url:", page.url());

const inputs = page.locator("input[placeholder],textarea[placeholder]");
console.log("matching inputs:", await inputs.count());
for (let i = 0; i < (await inputs.count()); i++) {
  const el = inputs.nth(i);
  console.log(`  [${i}] placeholder=${await el.getAttribute("placeholder")} visible=${await el.isVisible()} id=${await el.getAttribute("id")}`);
}
const hero = inputs.first();
await hero.fill("a meal planner for couples");
await page.waitForTimeout(1500);
console.log("value after fill:", await hero.inputValue());
const btn = page.getByRole("button", { name: /create/i }).first();
console.log("submit text:", (await btn.textContent())?.trim(), "| enabled:", await btn.isEnabled());
const allBtns = page.getByRole("button", { name: /create/i });
console.log("buttons matching /create/i:", await allBtns.count());
// hydration marker: does the island root have astro-island hydrated attr?
const island = await page.evaluate(() => {
  const el = document.querySelector("astro-island");
  return el ? { hydrated: el.hasAttribute("ssr") ? "pending(ssr attr present)" : "hydrated", uid: el.getAttribute("uid"), props: el.getAttribute("component-export") } : null;
});
console.log("astro-island:", JSON.stringify(island));
await browser.close();
