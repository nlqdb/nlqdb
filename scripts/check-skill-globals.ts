#!/usr/bin/env bun
// GLOBAL byte-identity check.
//
// Enforces the P3 sync rule from `docs/skill-conventions.md` §5 and the
// root `AGENTS.md` (P3): every `### GLOBAL-NNN` block duplicated under
// `.claude/skills/<feature>/SKILL.md` must be byte-identical to the
// canonical `## GLOBAL-NNN` block in `docs/decisions.md`, with a trailing
// `- **Source:** docs/decisions.md#GLOBAL-NNN` line.
//
// Run locally: bun scripts/check-skill-globals.ts
//   --fix mode rewrites skill GLOBAL blocks in place to match canonical.
// Wired into CI in .github/workflows/ci.yml.

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Block = { id: string; title: string; body: string[]; line: number };

const ROOT = process.cwd();
const DECISIONS_PATH = "docs/decisions.md";
const SKILLS_DIR = ".claude/skills";

const HEAD2 = /^##\s+(GLOBAL-\d{3})\s+—\s+(.+?)\s*$/;
const HEAD3 = /^###\s+(GLOBAL-\d{3})\s+—\s+(.+?)\s*$/;

function readLines(path: string): string[] {
  return readFileSync(join(ROOT, path), "utf8").split("\n");
}

function parseBlocks(
  lines: string[],
  headRe: RegExp,
  isTerminator: (line: string) => boolean,
): Block[] {
  const blocks: Block[] = [];
  let cur: Block | null = null;
  lines.forEach((line, i) => {
    const m = line.match(headRe);
    if (m) {
      if (cur) blocks.push(cur);
      cur = { id: m[1], title: m[2], body: [], line: i + 1 };
      return;
    }
    if (cur && isTerminator(line)) {
      blocks.push(cur);
      cur = null;
      return;
    }
    if (cur) cur.body.push(line);
  });
  if (cur) blocks.push(cur);

  // Trim trailing blank lines from every body.
  for (const b of blocks) {
    while (b.body.length > 0 && b.body[b.body.length - 1].trim() === "") {
      b.body.pop();
    }
  }
  return blocks;
}

function listSkillFiles(): string[] {
  const out: string[] = [];
  const dir = join(ROOT, SKILLS_DIR);
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillFile = join(SKILLS_DIR, entry.name, "SKILL.md");
    try {
      if (statSync(join(ROOT, skillFile)).isFile()) out.push(skillFile);
    } catch {
      // missing SKILL.md is the skill-index's problem, not ours
    }
  }
  return out.sort();
}

function bodyDiff(canon: string[], skill: string[]): string {
  const out: string[] = [];
  const max = Math.max(canon.length, skill.length);
  for (let i = 0; i < max; i++) {
    const a = i < canon.length ? canon[i] : "<eof>";
    const b = i < skill.length ? skill[i] : "<eof>";
    if (a !== b) {
      out.push(`    @@ body line ${i + 1} @@`);
      out.push(`    - canonical: ${a}`);
      out.push(`    + skill:     ${b}`);
    }
  }
  return out.join("\n");
}

function rewriteSkill(path: string, canonById: Map<string, Block>): boolean {
  const lines = readLines(path);
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(HEAD3);
    if (!m || !canonById.has(m[1])) {
      out.push(line);
      i++;
      continue;
    }
    const id = m[1];
    const canon = canonById.get(id) as Block;

    out.push(`### ${id} — ${canon.title}`);
    i++;
    // Consume original body up to and including the trailing - **Source:**
    // line for this GLOBAL. If we hit the next heading first, the block
    // had no Source line — treat the heading as terminator without
    // consuming it. This preserves any paragraphs that live between the
    // Source line and the next heading (e.g., "Interaction note" boxes).
    const sourcePrefix = `- **Source:** docs/decisions.md#${id}`;
    while (i < lines.length) {
      const ln = lines[i];
      if (ln.startsWith(sourcePrefix)) {
        i++;
        break;
      }
      if (/^#{1,3}\s/.test(ln)) break;
      i++;
    }

    // canon.body already starts with the blank line after the heading
    // (parseBlocks doesn't strip leading blanks), so don't add our own.
    for (const bl of canon.body) out.push(bl);
    out.push(`- **Source:** docs/decisions.md#${id}`);
  }
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  out.push("");

  const next = out.join("\n");
  const prev = readFileSync(join(ROOT, path), "utf8");
  if (next === prev) return false;
  writeFileSync(join(ROOT, path), next);
  return true;
}

function main(): void {
  const fixMode = process.argv.includes("--fix");

  const canonical = parseBlocks(readLines(DECISIONS_PATH), HEAD2, (line) => /^#{1,2}\s/.test(line));
  const canonicalById = new Map(canonical.map((b) => [b.id, b]));

  if (fixMode) {
    const skillFiles = listSkillFiles();
    let rewrote = 0;
    for (const file of skillFiles) {
      if (rewriteSkill(file, canonicalById)) {
        console.info(`✏️  rewrote ${file}`);
        rewrote++;
      }
    }
    console.info(`✅ ${rewrote} skill(s) rewritten — re-run without --fix to verify`);
    return;
  }

  let violations = 0;
  const skillFiles = listSkillFiles();

  for (const file of skillFiles) {
    const blocks = parseBlocks(readLines(file), HEAD3, (line) => /^#{1,3}\s/.test(line));

    for (const block of blocks) {
      const canon = canonicalById.get(block.id);
      if (!canon) {
        console.error(
          `❌ ${file}:${block.line} — cites ${block.id} but it is not in docs/decisions.md`,
        );
        violations++;
        continue;
      }

      // The natural end of a GLOBAL block is the - **Source:** line. Any
      // content after it (e.g., "Interaction note (P3)") is sibling
      // material in the same skill section, not part of the GLOBAL.
      const expectedSource = `- **Source:** docs/decisions.md#${block.id}`;
      let sourceIdx = -1;
      for (let k = block.body.length - 1; k >= 0; k--) {
        if (block.body[k] === expectedSource) {
          sourceIdx = k;
          break;
        }
      }
      const hasSource = sourceIdx >= 0;
      const body = hasSource ? block.body.slice(0, sourceIdx) : [...block.body];
      while (body.length > 0 && body[body.length - 1].trim() === "") body.pop();

      if (!hasSource) {
        console.error(
          `❌ ${file}:${block.line} — ${block.id} missing trailing "${expectedSource}" line`,
        );
        violations++;
      }

      if (block.title !== canon.title) {
        console.error(`❌ ${file}:${block.line} — ${block.id} title drift`);
        console.error(`    canonical: ${canon.title}`);
        console.error(`    skill:     ${block.title}`);
        violations++;
      }

      let bodyDrift = body.length !== canon.body.length;
      if (!bodyDrift) {
        for (let i = 0; i < body.length; i++) {
          if (body[i] !== canon.body[i]) {
            bodyDrift = true;
            break;
          }
        }
      }
      if (bodyDrift) {
        console.error(`❌ ${file}:${block.line} — ${block.id} body drift from docs/decisions.md`);
        console.error(bodyDiff(canon.body, body));
        violations++;
      }
    }
  }

  if (violations > 0) {
    console.error("");
    console.error(`Total drift: ${violations}`);
    console.error(
      "Fix the skill copy so it is byte-identical to docs/decisions.md plus a trailing - **Source:** line.",
    );
    console.error("To find every copy of a GLOBAL: grep -rn 'GLOBAL-NNN' .claude/skills/");
    process.exit(1);
  }

  console.info(
    `✅ ${skillFiles.length} skill(s) checked, all GLOBAL copies in sync with docs/decisions.md`,
  );
}

main();
