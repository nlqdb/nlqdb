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
