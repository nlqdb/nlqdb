import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// GLOBAL-024 — `lib/logsnag.ts` emits into `window.__nlqdb_logsnag`, which
// only Base.astro defines. Pin the two halves of the wiring so neither
// silently regresses back to the pre-2026-07-29 state where every client
// demand signal was a no-op: the layout must define the hook (gated on both
// build-time vars), and both deploy workflows must bake those vars in — a
// var missing from a workflow compiles the hook out of the shipped bundle
// (the Turnstile arming failed exactly this way, SK-ANON-009).

const layout = readFileSync(join(import.meta.dir, "../layouts/Base.astro"), "utf8");

describe("LogSnag hook wiring", () => {
  test("Base.astro defines the late-bound hook lib/logsnag.ts emits through", () => {
    expect(layout).toContain("window.__nlqdb_logsnag");
    expect(layout).toContain("https://api.logsnag.com/v1/log");
  });

  test("the hook renders only when both PUBLIC_LOGSNAG_* vars are set", () => {
    expect(layout).toContain("import.meta.env.PUBLIC_LOGSNAG_TOKEN");
    expect(layout).toContain("import.meta.env.PUBLIC_LOGSNAG_PROJECT");
    const gate = layout.indexOf(
      "import.meta.env.PUBLIC_LOGSNAG_TOKEN && import.meta.env.PUBLIC_LOGSNAG_PROJECT",
    );
    const hook = layout.indexOf("window.__nlqdb_logsnag");
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(hook);
  });

  test("both deploy workflows bake the vars into the client build", () => {
    for (const wf of ["deploy-web.yml", "deploy-api.yml"]) {
      const text = readFileSync(join(import.meta.dir, "../../../../.github/workflows", wf), "utf8");
      expect(text, wf).toMatch(/PUBLIC_LOGSNAG_TOKEN: \$\{\{ secrets\.LOGSNAG_TOKEN \}\}/);
      expect(text, wf).toMatch(/PUBLIC_LOGSNAG_PROJECT: \$\{\{ secrets\.LOGSNAG_PROJECT \}\}/);
    }
  });
});
