import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The `/app/new/` dead-end fix. Two symptoms, one root cause: CreateForm
// runs the anon `/v1/ask` path unconditionally (credentials:"omit",
// SK-ANON-001), so when the SK-ANON-012 Turnstile bot-challenge can't be
// completed on this origin the create 428s with no recovery — and a
// signed-in user hits it too, since the anon path never consults their
// cookie session. The fix keeps first-value anon working (SK-ANON-009
// fail-open, GLOBAL-007) but removes the dead-end:
//   • CreateForm folds an unrecoverable challenge_required into the same
//     seamless sign-in redirect as auth_required (prompt stashed +
//     handed off; an accountable identity skips Turnstile).
//   • /app/new/ routes signed-in visitors straight to the product chat.
//
// Guarded as source-scans — this workspace has no React render harness,
// so every component test here is a scan (see create-result-a11y.test.ts).
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("/app/new/ challenge dead-end fix", () => {
  test("CreateForm falls back to the sign-in redirect on an unrecoverable challenge", () => {
    const src = read("./CreateForm.tsx");
    // challenge_required shares the auth_required redirect branch, so a
    // 428 that survives the Turnstile retry seam stashes the prompt and
    // hands off to sign-in instead of dead-ending on an error banner.
    expect(src).toContain('outcome.error.kind === "challenge_required"');
    expect(src).toContain("buildSignInUrl");
    // The fallback still preserves the prompt (SK-ANON-011) and carries
    // it across the origin hop (SK-ANON-015).
    expect(src).toMatch(/challenge_required[\s\S]*savePending[\s\S]*attachHandoff/);
  });

  test("the anon-create page routes signed-in users to the product chat", () => {
    const src = read("../pages/app/new.astro");
    expect(src).toContain("fetchSession");
    expect(src).toContain('appHref("/app/")');
  });
});
