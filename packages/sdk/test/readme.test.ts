import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// This README *is* the npmjs.com package page — npm always ships README.md
// (regardless of the `files` allowlist), so it is an externally published
// discovery surface (channel #17 in `docs/research/acquisition-channels.md`),
// not internal notes. Nothing else guards it: `check-links.mjs` sweeps
// rendered site hrefs, not this file.

const README = readFileSync(join(import.meta.dirname, "../README.md"), "utf8");

/** Every `https://…` token, minus autolink brackets and sentence punctuation. */
function urls(text: string): string[] {
  return (text.match(/https?:\/\/[^\s"`)<>\]]+/g) ?? []).map((u) => u.replace(/[.,;:]+$/, ""));
}

describe("the @nlqdb/sdk package page gives a reader a way in", () => {
  // The canonical HTTP client's npm page used to dead-end: comprehensive API
  // docs, zero link to the product, the docs, or where to get the key the
  // `## Auth` section assumes. A developer who discovers the SDK on npm has to
  // guess the product exists.
  it("links to the product, the docs, and where to get a key", () => {
    expect(README).toContain("https://nlqdb.com/?utm_source=npm");
    expect(README).toContain("https://docs.nlqdb.com/sdk/?utm_source=npm");
    expect(README).toContain("https://app.nlqdb.com/app/keys");
  });
});

// SK-GTM-007: every externally published nlqdb landing URL carries its
// channel's `utm_source` key, and this page's channel is `npm`. The apex
// captures the first touch directly; `docs.nlqdb.com` forwards the params onto
// its outbound apex links (`apps/docs/src/channel-forward.ts`). An untagged
// link converts as `direct`, which is how a channel with real yield reads as a
// dead one. `app.nlqdb.com` is the product, not a landing page, so it is
// deliberately out of scope (it never runs the attribution capture).
describe("published nlqdb landing links are attributable to the npm channel", () => {
  it("tags every apex and docs URL with utm_source=npm", () => {
    const attributable = urls(README).filter(
      (u) => u.startsWith("https://nlqdb.com/") || u.startsWith("https://docs.nlqdb.com/"),
    );
    expect(attributable.length).toBeGreaterThan(0);
    for (const url of attributable) {
      expect(new URL(url).searchParams.get("utm_source"), url).toBe("npm");
    }
  });
});
