import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PERSONAS } from "./personas.ts";

// Internal-terminology guard for the persona taxonomy. `/vs` shipped 31
// comparison pages rendering the raw grouping key, so a stranger arriving
// on "supabase alternative" read "P1 SOLO BUILDER" — jargon with no meaning
// outside this repo. TypeScript can't catch it: the key is a valid string,
// and the leak lives in the render path, not the data.
//
// So the rule is structural rather than a search for one leak shape: a
// `.persona` property read may only be a `PERSONAS[...]` lookup or an
// equality comparison. Blank those two out, and anything left can reach HTML.
// Known limit: a persona reached by destructuring (`const { persona } = c`)
// carries no `.persona` token and slips through — closing that would need a
// parser, and the four render sites all go through the property read.

const WEB_SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const ALLOWED = /PERSONAS\[\s*[\w$.]*\.persona\s*\]|\.persona\s*[!=]==/g;
const RAW = /\.persona\b|\[\s*["']persona["']\s*\]/;

describe("persona taxonomy stays internal (personas.ts)", () => {
  test("labels and descriptions are real copy, with no internal P1..P4 code", () => {
    for (const info of Object.values(PERSONAS)) {
      expect(info.label.length).toBeGreaterThan(0);
      expect(info.description.length).toBeGreaterThan(0);
      expect(info.label).not.toMatch(/\bP[1-9]\b/);
      expect(info.description).not.toMatch(/\bP[1-9]\b/);
    }
  });

  test("no surface reads a raw persona code outside a PERSONAS lookup", () => {
    const offenders: string[] = [];
    for (const name of readdirSync(WEB_SRC, { recursive: true, encoding: "utf8" })) {
      if (!/\.(ts|tsx|astro)$/.test(name) || name.includes(".test.")) continue;
      const src = readFileSync(join(WEB_SRC, name), "utf8");
      const lines = src.split("\n");
      // Blank the allowed forms to spaces, not "", so line numbers survive.
      src
        .replace(ALLOWED, (m) => m.replace(/[^\n]/g, " "))
        .split("\n")
        .forEach((line, i) => {
          if (RAW.test(line)) offenders.push(`src/${name}:${i + 1}: ${lines[i].trim()}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
