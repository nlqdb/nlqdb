import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// SK-EVENTS-015 — browser events POST first-party to `/v1/events/web`; no
// LogSnag token may reach page source again (it shipped in every page until
// 2026-11-22, so anyone could drain the quota or push a fake page).

const root = join(import.meta.dir, "../../../..");
const layout = readFileSync(join(import.meta.dir, "../layouts/Base.astro"), "utf8");
const lib = readFileSync(join(import.meta.dir, "events.ts"), "utf8");

describe("browser event wiring", () => {
  test("emit posts to the first-party route, never to LogSnag", () => {
    expect(lib).toContain("/v1/events/web");
    expect(lib + layout).not.toMatch(/logsnag/i);
  });

  test("no deploy workflow bakes a LogSnag var into the client build", () => {
    const dir = join(root, ".github/workflows");
    for (const wf of readdirSync(dir)) {
      expect(readFileSync(join(dir, wf), "utf8"), wf).not.toContain("PUBLIC_LOGSNAG");
    }
  });
});
