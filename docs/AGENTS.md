# nlqdb — scheduled run

This repo's part of the scheduled run, read alongside `rules://scheduled-run`.

## Cron prompt

```
Scheduled run for nlqdb/nlqdb: read every resource at https://mcp.hochly.com/mcp, then follow rules://scheduled-run and this repo's docs/AGENTS.md once main has it, opening, reviewing and merging pull requests yourself. End with the report.
```

## Modes

- **Worker mode** runs [`/daily`](../.claude/commands/daily.md): measure
  first (regenerate [`scorecard.md`](scorecard.md)), then one measured box of
  [`ROADMAP.md`](ROADMAP.md), or a null run.
- **Reviewer mode** runs [`/review`](../.claude/commands/review.md).
- **Sundays (UTC)**, either mode also starts [`/weekly`](../.claude/commands/weekly.md)
  in the background (`/daily` § 0 says how it avoids duplicates).

## Ahead of the roadmap

1. Red `main` (`bun run typecheck`, `bun run check`, `bun run test`) or a
   failing `deploy-*` workflow on `main` — fixing it is the run.
2. A draft PR whose un-draft condition is now met.

## Merge gate

The local checks are `bun run typecheck`, `bun run check` and `bun run test`
(`CLAUDE.md` §7–§8). Hosted CI (`.github/workflows/ci.yml`) runs on every PR
and must be green.

## Deploys

Each Worker deploys on merge to `main` through its `deploy-*.yml` workflow;
confirm by the workflow's run going green on the merge commit, then a
`WebFetch` of `nlqdb.com`, `app.nlqdb.com`, `docs.nlqdb.com` or
`mcp.nlqdb.com`. Manual deploys, D1 migrations and secrets are the bare
`bun run --filter <pkg> deploy` / `migrate:remote` / `secrets:remote`
commands allowed in [`.claude/settings.json`](../.claude/settings.json);
details in [`runbook.md`](runbook.md) §6.
