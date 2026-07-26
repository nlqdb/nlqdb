import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { COMPETITORS } from "./competitors.ts";
import { PERSONA_ORDER, PERSONAS } from "./personas.ts";
import { SOLVE_ENTRIES } from "./solve.ts";

// Internal-terminology guard for the persona taxonomy.
//
// The `P1..P4` codes are repo-internal grouping keys, but two public AEO
// surfaces carry a persona: `/solve` (grouped index + page eyebrow) and
// `/vs` (per-comparison audience tag). `/solve` rendered the label from
// day one; `/vs` shipped the raw key, so 31 comparison pages told a
// stranger arriving on "supabase alternative" that they were reading a
// "P1 SOLO BUILDER" page — jargon with no meaning outside this repo.
//
// The data-level checks below pin the shared map; the file sweep pins the
// render path, which is where the leak actually happened (the type system
// can't catch a template interpolating a valid key into visible copy).

const WEB_SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(WEB_SRC, "..", "..", "..");

function sweepFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sweepFiles(p, acc);
    else if (/\.(ts|tsx|astro)$/.test(name) && !name.endsWith(".test.ts")) acc.push(p);
  }
  return acc;
}

describe("persona taxonomy stays internal (personas.ts)", () => {
  test("PERSONA_ORDER covers every persona key exactly once", () => {
    expect(new Set(PERSONA_ORDER).size).toBe(PERSONA_ORDER.length);
    expect([...PERSONA_ORDER].sort()).toEqual(Object.keys(PERSONAS).sort());
  });

  test("every persona used by a /solve or /vs entry has a label + description", () => {
    for (const persona of [...SOLVE_ENTRIES, ...COMPETITORS].map((e) => e.persona)) {
      const info = PERSONAS[persona];
      expect(info).toBeDefined();
      expect(info.label.length).toBeGreaterThan(0);
      expect(info.description.length).toBeGreaterThan(0);
    }
  });

  test("labels and descriptions carry no internal P1/P2/P3/P4 code", () => {
    for (const info of Object.values(PERSONAS)) {
      expect(info.label).not.toMatch(/\bP[1-9]\b/);
      expect(info.description).not.toMatch(/\bP[1-9]\b/);
    }
  });

  // The regression that shipped on /vs: `{c.persona}` in a template renders
  // the raw key. Interpolating a persona is only ever correct through
  // `PERSONAS[...]`, so any bare `.persona` inside `{...}` / `${...}` is the
  // leak — named on failure so the next one fails in the PR that writes it.
  test("no surface interpolates a raw persona code into rendered markup", () => {
    const leak = /[{$]\{?\s*[A-Za-z_$][\w$]*\.persona\s*\}/g;
    const offenders: string[] = [];
    for (const file of sweepFiles(WEB_SRC)) {
      for (const m of readFileSync(file, "utf8").matchAll(leak)) {
        offenders.push(`${relative(REPO_ROOT, file)}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
