import { describe, expect, test } from "bun:test";
import { canonicalRedirectRules, MAX_STATIC_RULES } from "./canonical-redirects.ts";

const noFiles = () => false;

describe("canonicalRedirectRules", () => {
  test("maps a bare page path to its slashed URL with a permanent code", () => {
    // 301, not 307 — a temporary code is not a canonicalisation signal, which is
    // the whole reason this file exists.
    expect(canonicalRedirectRules(["/agents"], noFiles)).toEqual(["/agents /agents/ 301"]);
  });

  test("skips the root — `/` is already the served 200", () => {
    expect(canonicalRedirectRules(["/", ""], noFiles)).toEqual([]);
  });

  test("emits no rule under `/app`, `/auth` or `/oauth`", () => {
    // The same build ships to the merged app host, where these are the app's own
    // routes (`SK-WEB-026` / `SK-AUTH-016`). A same-named sibling like
    // `/apps-of-note` is a marketing page and must still get its rule.
    const excluded = ["/app", "/app/new", "/auth", "/auth/sign-in", "/oauth/mcp-authorize"];
    expect(canonicalRedirectRules([...excluded, "/apps-of-note"], noFiles)).toEqual([
      "/apps-of-note /apps-of-note/ 301",
    ]);
  });

  test("never shadows a real file at the bare path", () => {
    // `/install` is the `curl nlqdb.com/install | sh` script; a redirect rule
    // wins over asset matching, so a rule there would break the installer.
    const rules = canonicalRedirectRules(["/install", "/blog"], (p) => p === "/install");
    expect(rules).toEqual(["/blog /blog/ 301"]);
  });

  test("throws past Cloudflare's static-rule ceiling instead of silently truncating", () => {
    const tooMany = Array.from({ length: MAX_STATIC_RULES + 1 }, (_, i) => `/p${i}`);
    expect(() => canonicalRedirectRules(tooMany, noFiles)).toThrow(/ceiling/);
    expect(canonicalRedirectRules(tooMany.slice(0, MAX_STATIC_RULES), noFiles)).toHaveLength(
      MAX_STATIC_RULES,
    );
  });
});
