import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// EK-03 box 4 — the honest-claims guard for the `/experts` trust surface.
//
// SK-EKP-001's whole posture is "trust copy never exceeds substance": the
// pillar is a contractual "not allowed", stated on top of the shipped
// technical floor (GLOBAL-037's enumerated egress lanes, RLS isolation,
// delete, FSL self-host) — and the page must keep saying exactly that as
// copy evolves. These tests scan the page source (comments included, on
// purpose: a violating phrase anywhere is drift waiting to be pasted into
// copy) and fail the build on any claim the shipped product does not back.

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "../experts.astro"), "utf8");
// Copy lives in the frontmatter + markup; the style block is layout, and
// its CSS (`width: 100%`) would false-positive the percentage ban.
const page = source.replace(/<style[\s\S]*?<\/style>/, "");

describe("/experts claims stay inside shipped substance (SK-EKP-001)", () => {
  test("no inability claims — operators of the hosted service technically can read rows", () => {
    // The posture is "not allowed", a contractual prohibition. "Not able"
    // becomes claimable per-deployment only when sovereign hosting ships.
    for (const banned of [
      /can[’']?t\s+(read|see|access)/i,
      /\bcannot\s+(read|see|access)/i,
      /\bunable\s+to\s+(read|see|access)/i,
      /\bno\s+way\s+(for\s+us\s+)?to\s+(read|see|access)/i,
      // The flat indicative form overclaims exactly as the modal one does —
      // "we don't read your data" is as false as "we can't", since the engine
      // does read rows to answer. This bans the factual denial while leaving
      // the contractual "nlqdb may not read…" (permission) and the positive
      // carve "the engine reads the relevant rows…" untouched.
      /\b(?:we|nlqdb)\s+(?:do(?:es)?\s+not|do(?:es)?n[’']?t)\s+(?:read|see|access|view)\b/i,
      /\b(?:nobody|no\s+one)\s+(?:[a-z]+\s+){0,3}?(?:reads?|sees?|accesses?|views?)\b/i,
    ]) {
      expect(page).not.toMatch(banned);
    }
  });

  test("no absolutes ahead of EK-09 — the stronger egress claim is not yet true", () => {
    // "Your rows are never sent to a language-model provider when buyers
    // query" becomes true only when EK-09's narration skip ships
    // (GLOBAL-037 lane 2, F1-B). Until then the word has no honest use on
    // this page — the shipped floor is lane-shaped, not absolute.
    expect(page).not.toMatch(/\bnever\b/i);
  });

  test("trust-loud means no pricing language on this surface (SK-EKP-002)", () => {
    // Seller-facing terms live in the selling flow (EK-05), and the
    // percentage is founder-set at ship time — it appears nowhere before.
    for (const banned of [/\bfees?\b/i, /\d+\s*%/, /\bcommission\b/i, /revenue\s+(share|split)/i]) {
      expect(page).not.toMatch(banned);
    }
  });

  test("no fake door — the page collects nothing for a product that does not exist", () => {
    for (const banned of [/waitlist/i, /early\s+access/i, /notify\s+me/i, /join\s+the\s+list/i]) {
      expect(page).not.toMatch(banned);
    }
  });

  test("sovereign hosting appears only as roadmap until it ships", () => {
    expect(page).toMatch(/sovereign/i);
    expect(page).toMatch(/roadmap/i);
    // The roadmap block must keep saying it has not shipped, in plain words.
    expect(page).toMatch(/not shipped/i);
  });

  test("the pillar is stated in the 'not allowed' posture, with its sequencing", () => {
    expect(page).toContain("not allowed to");
    // The contract is drafted, not live — the page may only claim it as the
    // condition the marketplace opens under, stated explicitly.
    expect(page).toContain("The marketplace does not open before those terms do.");
  });

  test("the technical floor is enumerated, not gestured at", () => {
    // GLOBAL-037 lane 1 — planning is schema-only, said concretely.
    expect(page).toContain("table and column names");
    // GLOBAL-037 lane 2 — narration egress disclosed, with the opt-out.
    expect(page).toContain("rows that answer returned");
    expect(page).toMatch(/JSON-only/);
    // RLS isolation, delete, self-host.
    expect(page).toMatch(/row-level security/i);
    expect(page).toMatch(/delete a database at any time/i);
    expect(page).toContain("FSL-1.1");
  });

  test("the honest carve is present — server-side answering is named, not hidden", () => {
    // SK-EKP-001: the claim stands BESIDE the truth that the engine reads
    // rows to answer. Dropping this sentence turns the pillar into spin.
    expect(page).toContain("reads the relevant rows on the server");
  });

  test("unshipped surfaces carry their build label; the fixture says it is a fixture", () => {
    expect(page).toMatch(/in build/i);
    expect(page).toMatch(/illustrative/i);
  });
});
