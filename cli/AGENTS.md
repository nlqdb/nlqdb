# CLI — Agents Guide

`nlq` command-line tool. Verbs ask/run, OS-keychain credentials, MCP install helper.

> This is the local guide. Read root [`AGENTS.md`](../AGENTS.md) first
> for the three behavioral principles, the full path → skill map, and
> the project-wide tech stack. This file narrows that guide to
> `cli/`.

## Skills relevant to this area

- [`cli`](../.claude/skills/cli/SKILL.md) — mandatory pre-read for changes that touch the feature.
- [`sdk`](../.claude/skills/sdk/SKILL.md) — mandatory pre-read for changes that touch the feature.
- [`mcp-server`](../.claude/skills/mcp-server/SKILL.md) — mandatory pre-read for changes that touch the feature.
- [`anonymous-mode`](../.claude/skills/anonymous-mode/SKILL.md) — mandatory pre-read for changes that touch the feature.

## Commands

```bash
bun run --filter cli dev
bun run --filter cli build
bun run --filter cli test
```

## Local rules

- Every change here must respect the `GLOBAL-NNN` decisions in
  [`docs/decisions.md`](../docs/decisions.md).
- A new external call (DB / LLM / HTTP / queue) needs an OTel span
  (`GLOBAL-014`).
- If a request is ambiguous or an error is unfamiliar — web-research
  current best practices first (see root `AGENTS.md` §2 P2).
- A decision change (new or amended) updates every place that copies
  it, in the same PR (root `AGENTS.md` §2 P3).

## When you finish

1. Run the commands above and ensure they all pass.
2. If you added a decision, it has an ID, lives in the right place
   (`docs/decisions.md` or the relevant `SKILL.md`), and any duplicate
   of an affected `GLOBAL-NNN` is updated.
3. Open a PR; the root `AGENTS.md` §8 lists the pre-PR quality gates.
