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
   updates) a "Version Packages" PR. Merging that PR publishes any
   un-gated package (see below).

## Per-package un-gating

A package is publishable when its `package.json` is **not**
`"private": true` and it emits a `dist/`. Packages that still have
`"private": true` are skipped by `changeset publish` automatically.

Status:
- `@nlqdb/sdk` — un-gated; bootstrap published at `0.1.0` from
  maintainer machine on 2026-05-20. Configure Trusted Publisher on
  npmjs.com (see below) so subsequent publishes flow via OIDC.
- `@nlqdb/cli` — un-gated; bootstrap published at `0.1.0` (npm shim
  that downloads the `nlq` Go binary on `postinstall`). Configure
  Trusted Publisher on npmjs.com (see below).
- Everything else in `packages/*` — still gated.

To un-gate a new package:

1. Add a `build` script (tsup) that emits `dist/index.js` + `dist/index.d.ts`.
2. Drop `"private": true` and add `publishConfig` so the published
   tarball points at `dist/` (workspace dev keeps reading `src/` via
   the top-level `main`/`exports`):
   ```json
   {
     "main": "./src/index.ts",
     "exports": { ".": "./src/index.ts" },
     "files": ["dist"],
     "sideEffects": false,
     "license": "FSL-1.1-ALv2",
     "repository": {
       "type": "git",
       "url": "git+https://github.com/nlqdb/nlqdb.git",
       "directory": "packages/<name>"
     },
     "publishConfig": {
       "main": "./dist/index.js",
       "types": "./dist/index.d.ts",
       "exports": {
         ".": {
           "types": "./dist/index.d.ts",
           "import": "./dist/index.js",
           "default": "./dist/index.js"
         }
       },
       "provenance": true,
       "access": "public"
     }
   }
   ```
3. Add a `bun run --filter='@nlqdb/<name>' build` step to
   `release-npm.yml` before the changesets action.
4. Configure Trusted Publishing on the package (see below).

## Authentication: Trusted Publishing (OIDC)

Per [`SK-CIPERM-003`](../docs/features/ci-permissions/FEATURE.md), the
publish path is npm's Trusted Publishing — the `release` job mints an
OIDC token (`id-token: write`) and npm verifies the claim against the
configured GitHub repo + workflow. No long-lived secret in CI; npm
auto-attaches SLSA v1 provenance on OIDC publishes.

**Chicken-and-egg (one-time per new package):** Trusted Publishers
can only be configured on a package that **already exists** on npm.
Publish the first version manually from a maintainer machine
(`npx --yes -p npm@latest -- npm publish --no-provenance --access public`)
with the user's npm session (`npm login --auth-type=web`), then
configure the Trusted Publisher fields below. The next CI publish
flows via OIDC.

### Trusted Publisher fields (one-time, per package)

On `npmjs.com/package/@nlqdb/<name>/access` → **Trusted Publisher**:

| Field | Value |
|---|---|
| Publisher | GitHub Actions |
| Organization or user | `nlqdb` |
| Repository | `nlqdb` |
| Workflow filename | `release-npm.yml` (filename only, not the path) |
| Environment name | leave blank (or `npm-publish` if/when we add a GH Environment for approval gating) |

Then **Publishing access** → "Require two-factor authentication and
disallow tokens" to lock out token-based fallback for that package.

## Skipping a changeset

For docs-only or refactor PRs that don't touch a published package,
`bun run changeset --empty` drops a marker that satisfies CI without
bumping any version.
