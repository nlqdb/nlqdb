# Apps · Docs — Agents Guide

User-facing documentation site (`docs.nlqdb.com`) — Astro Starlight on
Cloudflare Workers Static Assets.

> This is the local guide. Read root [`AGENTS.md`](../../AGENTS.md) first
> for the three behavioral principles, the full path → feature map, and
> the project-wide tech stack. This file narrows that guide to
> `apps/docs/`.

## Features relevant to this area

- [`docs-site`](../../docs/features/docs-site/FEATURE.md) — mandatory pre-read for changes here.

## Scope

User-facing only. Internal docs (`decisions.md`, per-feature
`FEATURE.md`, `runbook.md`, `phase-plan.md`) stay in the repo's
`docs/` tree — they are not copied or imported here. The site
publishes: Quickstart, HTTP API reference, SDK reference, MCP setup,
CLI reference.

## Commands

```bash
bun run --filter apps/docs dev        # local dev server
bun run --filter apps/docs build      # static build → dist/
bun run --filter apps/docs deploy     # build + wrangler deploy
```

## Deploy

GH Actions → `.github/workflows/deploy-docs.yml` on push to `main`
touching `apps/docs/**`. Custom domain + cert auto-provisioned by
`wrangler` via `custom_domain = true` in `wrangler.toml`.

## Local rules

- Content additions: write new `.mdx` files under
  `src/content/docs/`; update the sidebar in `astro.config.mjs`.
- No client-side analytics SDKs — use Cloudflare Web Analytics
  (`apps/web` pattern) once configured.
- No imports from `apps/web` or `packages/elements` — keep the docs
  site decoupled from product code.
