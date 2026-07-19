import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { signInHintFor } from "./signin-hints";

const HERE = dirname(fileURLToPath(import.meta.url));

describe("signInHintFor", () => {
  test("maps session_lost to a non-empty, slug-free hint", () => {
    const hint = signInHintFor("session_lost");
    expect(hint).toBeTruthy();
    // GLOBAL-012 — never echo the raw code to the user.
    expect(hint).not.toContain("session_lost");
  });

  test("returns null for an absent or unknown code (no banner, no slug leak)", () => {
    expect(signInHintFor(null)).toBeNull();
    expect(signInHintFor("")).toBeNull();
    expect(signInHintFor("totally_unknown_code")).toBeNull();
  });
});

// A11y contract: the magic-link "Check your inbox" panel is the success
// beat that gates anon-DB adoption. Every other announcement in this flow
// carries a live-region role (#signin-error is role="alert"); the
// confirmation had none, so a screen-reader stranger heard nothing on
// submit and keyboard focus was orphaned onto the now-hidden submit button.
// Guard the role so it can't silently drift back to a silent div.
describe("sign-in confirmation is an announced live region", () => {
  test("#signin-sent carries a live-region role", () => {
    const src = readFileSync(join(HERE, "..", "pages", "auth", "sign-in.astro"), "utf8");
    const sent = src.match(/<div id="signin-sent"[^>]*>/);
    expect(sent).toBeTruthy();
    expect(sent?.[0]).toMatch(/role="(status|alert)"/);
    // Guard-the-guard: the error region's role must still be present, so a
    // stray regex edit can't let this pass while the flow loses its roles.
    expect(src).toMatch(/<p id="signin-error"[^>]*role="alert"/);
  });
});

// Contract guard: `post-signin.astro` bounces failed round-trips back to
// `/auth/sign-in/?error=<code>`. Before this the read side didn't exist, so
// the param was dead — written in one place, surfaced nowhere. This asserts
// every `?error=<code>` the redirect emits has copy here, so the two sides
// can't silently drift again (sibling of the SK-WEB-022 nav sweep).
describe("post-signin ↔ sign-in error contract", () => {
  test("every ?error=<code> post-signin redirects with has a hint", () => {
    const src = readFileSync(join(HERE, "..", "pages", "auth", "post-signin.astro"), "utf8");
    const codes = [...src.matchAll(/\?error=([a-z_]+)/g)].map((m) => m[1]);
    // Guard the guard: post-signin must emit at least one error redirect,
    // else this test would pass vacuously if the literal ever moves.
    expect(codes.length).toBeGreaterThan(0);
    for (const code of codes) {
      expect(signInHintFor(code)).toBeTruthy();
    }
  });
});
