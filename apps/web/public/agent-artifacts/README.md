# nlqdb agent-memory artifacts

Drop one of these into your agent's repo and its coding agent (Claude Code,
Cursor, Codex) wires nlqdb memory and uses it correctly — a real Postgres it
queries in plain English over MCP, so it can `GROUP BY`/`JOIN`/aggregate over
what it remembered, not just recall the nearest few rows.

## One command (Claude Code, Cursor, Codex)

```bash
npx skills add https://github.com/nlqdb/nlqdb/tree/main/apps/web/public/agent-artifacts/nlqdb-memory
```

Installs the `nlqdb-memory` skill from this repo (public) with the
[`skills`](https://github.com/vercel-labs/skills) CLI. No account, no publish.
Measured against the live CLI 2026-07-25, it writes:

- `.agents/skills/nlqdb-memory/SKILL.md` — the cross-agent skill directory
  Cursor and Codex read directly, per their own docs
- `.claude/skills/nlqdb-memory` — a symlink to it. Claude Code documents only
  `.claude/skills/`, so the symlink is how the one command reaches it
- `skills-lock.json` — the install record

It does **not** write a `.cursor/rules/` file and does **not** edit
`AGENTS.md`, so a host that reads only `AGENTS.md` still needs
`AGENTS.snippet.md` from the table below appended by hand.
Then connect the MCP server once with the command inside the skill.

## Or drop a file in by hand

| File | Drop it at | For |
|------|-----------|-----|
| [`AGENTS.snippet.md`](AGENTS.snippet.md) | append to your repo's `AGENTS.md` | any agent that reads `AGENTS.md` (host-neutral) |
| [`nlqdb-memory/SKILL.md`](nlqdb-memory/SKILL.md) | `.claude/skills/nlqdb-memory/SKILL.md` | Claude Code (skill) |
| [`nlqdb-memory.mdc`](nlqdb-memory.mdc) | `.cursor/rules/nlqdb-memory.mdc` | Cursor |
| [`codex-config.toml`](codex-config.toml) | merge into `~/.codex/config.toml` | Codex |

Every connect command in these files is generated from one source of truth
(`apps/web/src/lib/mcp-install.ts`) and pinned by a drift test
(`apps/web/src/lib/agent-artifacts.test.ts`), so they can never fall out of
sync with the endpoint nlqdb actually serves.

Full setup guide: <https://docs.nlqdb.com/agent-memory/?utm_source=agent-artifacts>.
