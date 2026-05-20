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
- `@nlqdb/sdk` — un-gated; bootstrap publish pending.
- `@nlqdb/cli` — un-gated; bootstrap publish pending (npm shim that
  downloads the `nlq` Go binary on `postinstall`).
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

## Authentication: Trusted Publishing (OIDC), with `NPM_TOKEN` as bootstrap

Per [`SK-CIPERM-003`](../docs/features/ci-permissions/FEATURE.md), the
default publish path is npm's Trusted Publishing — the `release` job
mints an OIDC token (`id-token: write`) and npm verifies the claim
against the configured GitHub repo + workflow. No long-lived secret.

**Chicken-and-egg:** Trusted Publishers can only be configured on a
package that **already exists** on npm. The very first publish for a
new package therefore uses `NPM_TOKEN`; immediately after, configure
the Trusted Publisher on `npmjs.com/package/@nlqdb/<name>/access` and
drop `NPM_TOKEN` from future runs.

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

`NPM_TOKEN` stays in repo secrets while at least one package is on
the bootstrap path; remove when all `@nlqdb/*` packages are on
Trusted Publishing (the open question tracked in `SK-CIPERM-003`).

## Skipping a changeset

For docs-only or refactor PRs that don't touch a published package,
`bun run changeset --empty` drops a marker that satisfies CI without
bumping any version.
