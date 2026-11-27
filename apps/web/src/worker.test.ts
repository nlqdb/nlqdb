import { describe, expect, test } from "bun:test";
import worker, { productRedirectTarget } from "./worker";

// SK-AUTH-016 — the marketing worker must send the product surface (/app/*) to
// the merged app so it's first-party with the API, WITHOUT catching /auth/*
// (which hops client-side to preserve fragment state) or looping on the merged
// app / previews (which share the build but serve /app directly).
describe("productRedirectTarget", () => {
  test("redirects /app on the marketing host to the merged app", () => {
    expect(productRedirectTarget(new URL("https://nlqdb.com/app/"))).toBe(
      "https://app.nlqdb.com/app/",
    );
  });

  test("preserves the query string (shared db deep-link)", () => {
    expect(productRedirectTarget(new URL("https://nlqdb.com/app/?db=db_x"))).toBe(
      "https://app.nlqdb.com/app/?db=db_x",
    );
  });

  test("redirects nested product routes and www", () => {
    expect(productRedirectTarget(new URL("https://www.nlqdb.com/app/keys/"))).toBe(
      "https://app.nlqdb.com/app/keys/",
    );
  });

  test("does NOT redirect /auth (client-side hop preserves fragment state)", () => {
    expect(productRedirectTarget(new URL("https://nlqdb.com/auth/sign-in/"))).toBeNull();
  });

  test("does NOT redirect marketing pages", () => {
    expect(productRedirectTarget(new URL("https://nlqdb.com/pricing/"))).toBeNull();
  });

  test("does NOT touch /app on the merged app itself (no loop)", () => {
    expect(productRedirectTarget(new URL("https://app.nlqdb.com/app/"))).toBeNull();
  });

  test("does NOT redirect on preview hosts", () => {
    expect(
      productRedirectTarget(new URL("https://pr-5-nlqdb-web.example.workers.dev/app/")),
    ).toBeNull();
  });

  test("does NOT match lookalike paths like /apple-touch-icon.png", () => {
    expect(productRedirectTarget(new URL("https://nlqdb.com/apple-touch-icon.png"))).toBeNull();
  });
});

// SK-CLI-015 — the update check every installed `nlq` runs must reach the
// latest release's manifest, never the 404 page.
describe("update manifest", () => {
  const assets = { fetch: async () => new Response("asset", { status: 404 }) };

  test("redirects /install/latest.json to the latest release's manifest", async () => {
    const res = await worker.fetch(new Request("https://nlqdb.com/install/latest.json"), {
      ASSETS: assets,
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://github.com/nlqdb/nlqdb/releases/latest/download/latest.json",
    );
  });

  test("leaves the installer script itself to the assets", async () => {
    const res = await worker.fetch(new Request("https://nlqdb.com/install"), { ASSETS: assets });
    expect(await res.text()).toBe("asset");
  });
});
