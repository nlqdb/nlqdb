# Changesets

This folder holds **pending release notes** for the `@nlqdb/*` packages
under `packages/`. Apps under `apps/` (`api`, `web`, `events-worker`,
`mcp-server`, `coming-soon`) are deploy-only and ignored by changesets —
see the `ignore` list in `config.json`.

## How it works

1. **You make a change** in a `packages/*` directory that consumers will
   notice — a new export, a bug fix, a breaking rename.
2. **You add a changeset** describing it:
   ```bash
   bun run changeset
   ```
   The CLI walks you through: which packages changed, semver bump
   (major/minor/patch), one-line summary. It writes a markdown file
   here in `.changeset/`.
3. **You commit the changeset alongside the code**. Reviewers see both
   in the same PR — the change *and* its release note.
4. **On merge to `main`**, `.github/workflows/release-npm.yml` collects
   every pending changeset, opens (or updates) a "Version Packages"
   PR that bumps versions + writes CHANGELOGs. Merging that PR
   publishes the affected packages to npm.

## Publishing is currently gated

Today every `packages/*/package.json` has `"private": true` and
`main` / `exports` pointing at raw `src/index.ts`. The release workflow
runs `changeset version` (bumps versions, writes CHANGELOGs) but
**skips `changeset publish`** — the actual npm publish step is wired
but commented, because publishing raw TypeScript isn't right.

To enable publishing for a package:

1. Add a build step (e.g. `tsup` or `tsc`) that emits `dist/index.js`
   + `dist/index.d.ts`.
2. Update its `package.json`:
   ```json
   {
     "private": false,
     "main": "./dist/index.js",
     "types": "./dist/index.d.ts",
     "exports": { ".": "./dist/index.js" },
     "files": ["dist"]
   }
   ```
3. Uncomment the `publish` step in `.github/workflows/release-npm.yml`.

The changesets workflow then publishes anything not marked `private`
on the next "Version Packages" merge.

## When NOT to add a changeset

- Refactors with no observable change (renaming internal helpers, etc.).
- Pure docs / test changes.
- Workspace-only changes (private packages — changesets ignore them
  by default via the `private` flag).

For these, run `bun run changeset --empty` to drop a marker that
satisfies CI without bumping any version.
