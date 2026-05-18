# Changesets

Pending release notes for `@nlqdb/*` packages. Apps under `apps/` are
deploy-only and ignored (see `config.json`).

## Workflow

1. Make a change that consumers will notice (new export, bug fix,
   breaking rename).
2. `bun run changeset` — CLI walks you through bump + summary,
   writes a markdown file here.
3. Commit it alongside the code so reviewers see both.
4. On merge to `main`, `.github/workflows/release-npm.yml` opens (or
   updates) a "Version Packages" PR. Merging that PR would publish —
   currently gated, see below.

## Publishing is gated

Every `packages/*/package.json` has `"private": true` and points
`main` at raw `src/index.ts`. The release workflow runs `changeset
version` (bumps versions, writes CHANGELOGs) but `changeset:publish`
is a no-op echo until packages emit `dist/`.

To enable publishing for a package:

1. Add a build step (e.g. `tsup`) emitting `dist/index.js` +
   `dist/index.d.ts`.
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
3. Replace `bun run changeset:publish` in `package.json` with the
   real `changeset publish` command.
4. Add `NPM_TOKEN` to repo secrets (npm Automation token on `@nlqdb`).

## Skipping a changeset

For docs-only or refactor PRs that don't touch a published package,
`bun run changeset --empty` drops a marker that satisfies CI without
bumping any version.
