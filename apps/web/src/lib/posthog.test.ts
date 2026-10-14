import { describe, expect, test } from "bun:test";

// SK-ANON-015 — `/app/new/` receives the handoff as `#nlq=<json>`, and that
// JSON carries the anonymous **bearer token**. PostHog must never store it, so
// `sanitize_properties` cuts the fragment off every captured URL property.
// Asserting on the sanitized payload (not just on the config object) is the
// point: a config key that is never exercised proves nothing.

import { stripFragment } from "./posthog";

describe("stripFragment (the sanitize_properties hook)", () => {
  test("cuts the fragment off every URL-carrying property", () => {
    const out = stripFragment({
      $current_url: "https://app.nlqdb.com/app/new/#nlq=%7B%22anon%22%3A%22anon_secret%22%7D",
      $referrer: "https://nlqdb.com/solve/x/#nlq=leaked",
    });
    expect(out["$current_url"]).toBe("https://app.nlqdb.com/app/new/");
    expect(out["$referrer"]).toBe("https://nlqdb.com/solve/x/");
    expect(JSON.stringify(out)).not.toContain("anon_secret");
    expect(JSON.stringify(out)).not.toContain("#");
  });

  test("leaves legitimate analytics untouched", () => {
    const props = {
      $current_url: "https://app.nlqdb.com/app/",
      $referrer: "$direct",
      $pathname: "/app/",
      distinct_id: "u_1",
      $screen_height: 900,
      $referring_domain: null,
    };
    expect(stripFragment({ ...props })).toEqual(props);
  });
});

// Prod report 2026-10-14: `Failed to fetch dynamically imported module:
// …/_astro/module.<hash>.js` (the posthog-js chunk) reached the R&D inbox as a
// "client boot" error. The chunk was live and unchanged — a transient fetch
// failure of optional analytics must not reject, and must re-arm for a retry.
describe("initAppAnalytics when the SDK chunk fails to load", () => {
  test("resolves quietly, then retries on the next call", async () => {
    const g = globalThis as { window?: unknown };
    const prevWindow = g.window;
    const prevKey = process.env["PUBLIC_POSTHOG_KEY"];
    g.window = { location: { hash: "" } };
    process.env["PUBLIC_POSTHOG_KEY"] = "phc_test";
    try {
      const { initAppAnalytics } = await import("./posthog");
      const failing = () =>
        Promise.reject(new TypeError("Failed to fetch dynamically imported module"));
      await expect(initAppAnalytics(null, failing)).resolves.toBeUndefined();

      let inits = 0;
      const sdk = { init: () => void inits++, identify: () => {} };
      const ok = () => Promise.resolve({ default: sdk } as never);
      await initAppAnalytics(null, ok);
      expect(inits).toBe(1);
    } finally {
      g.window = prevWindow;
      if (prevKey === undefined) delete process.env["PUBLIC_POSTHOG_KEY"];
      else process.env["PUBLIC_POSTHOG_KEY"] = prevKey;
    }
  });
});
