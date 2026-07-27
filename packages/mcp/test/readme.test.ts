import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// This README *is* the npmjs.com package page — `files` ships it, so it is an
// externally published surface with real coding-agent traffic (channel #17 in
// `docs/research/acquisition-channels.md`), not internal notes. Two contracts
// hold on it, and neither is checked by anything else: `apps/web`'s
// `agent-artifacts.test.ts` pins the *site's* three surfaces, and
// `check-links.mjs` sweeps rendered site hrefs, not this file.

const README = readFileSync(join(import.meta.dirname, "../README.md"), "utf8");

// R-07 one-command install guard, mirrored from `agent-artifacts.test.ts`.
// The skill lives in the repo, so the published command is a repo path: move
// the directory and the command 404s for every reader of the package page.
const SKILL_REPO_PATH = "apps/web/public/agent-artifacts/nlqdb-memory";
const SKILLS_INSTALL_CMD = `npx skills add https://github.com/nlqdb/nlqdb/tree/main/${SKILL_REPO_PATH}`;

/** Every `https://…` token, minus autolink brackets and sentence punctuation. */
function urls(text: string): string[] {
  return (text.match(/https?:\/\/[^\s"`)<>\]]+/g) ?? []).map((u) => u.replace(/[.,;:]+$/, ""));
}

describe("the npm package page ships the drop-in skill install path", () => {
  it("shows the exact install command, and the skill still lives at that path", () => {
    expect(README).toContain(SKILLS_INSTALL_CMD);
    expect(existsSync(join(import.meta.dirname, "../../../", SKILL_REPO_PATH, "SKILL.md"))).toBe(
      true,
    );
  });

  // Hard rule 1 — only promise what the command does. Run live 2026-07-27 it
  // writes the cross-agent directory and a Claude Code symlink, and touches
  // neither `.cursor/rules/` nor `AGENTS.md`; a reader waiting on a Cursor
  // rule that never arrives silently gets no memory at all. Two halves,
  // because either alone is escapable: the disclosure must be present *and*
  // the overclaim absent.
  it("discloses what the command does not write", () => {
    const prose = README.replace(/[`*]/g, " ").replace(/\s+/g, " ").toLowerCase();
    expect(prose).toContain(".agents/skills/nlqdb-memory/skill.md");
    expect(prose).toContain("does not write a .cursor/rules/ file");
    expect(prose).toContain("does not edit agents.md");
    expect(prose).not.toContain("matching cursor");
    expect(prose).not.toContain("registers it in agents.md");
  });
});

// SK-GTM-007: every externally published nlqdb URL carries its channel's
// `utm_source` key, and this page's channel is `npm`. Both hosts below end in
// a first touch — the apex captures it directly, and `docs.nlqdb.com` forwards
// the params onto its outbound apex links (`apps/docs/src/channel-forward.ts`).
// An untagged link here converts as `direct`, which is how a channel with real
// yield reads as a dead one. `app.nlqdb.com` is the product, not a landing
// page, so it is deliberately out of scope.
describe("published nlqdb links are attributable to the npm channel", () => {
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
