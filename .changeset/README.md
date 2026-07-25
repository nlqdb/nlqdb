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
- `@nlqdb/mcp` — **gated, publish-ready and tarball-verified** 2026-07-25:
  `npm pack` → install → `node .../bin/nlqdb-mcp.mjs` serves a real MCP
  `initialize` + `tools/list` with the full `SK-MCP-002` catalog, so
  `npx -y @nlqdb/mcp` will work on publish. The `@nlqdb/sdk` workspace dep is
  bundled into `dist/`, so it is a **devDependency** — a `workspace:*` range
  must never reach a published `dependencies`.
  Only the bootstrap publish below is left, and it is maintainer-only;
  the founder command is queued as
  [`blocked-by-human.md`](../docs/blocked-by-human.md) bullet 2. Un-gate
  (steps 2–4) in the PR that follows the publish, not before — a
  non-private package whose version is not yet on npm makes
  `changeset publish` fail the whole release job.
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
       "provenance": true,
       "access": "public"
     }
   }
   ```
   > **npm ignores `publishConfig` field overrides.** Rewriting
   > `main`/`types`/`exports` from `publishConfig` is a **pnpm** feature; npm
   > honours only its own keys (`access`, `provenance`, `registry`, `tag`).
   > Verified 2026-07-25 against the live registry: `@nlqdb/sdk@0.2.1`
   > publishes `main: "./src/index.ts"` while its `files` ships only `dist/`,
   > so `import "@nlqdb/sdk"` from npm throws `ERR_MODULE_NOT_FOUND`. Point a
   > library's real `main`/`types`/`exports` at `dist/`, or expose the artifact
   > through `bin` (what `@nlqdb/mcp` does — its bin picks source under bun and
   > `dist/` under node). Don't add `"sideEffects": false` to a package whose
   > entry is a pure re-export barrel built by `bun build`: the bundler shakes
   > it down to a stub that still *builds* clean and then fails to load.
3. Add a `bun run --filter='@nlqdb/<name>' build` step to
   `release-npm.yml` before the changesets action.
4. **Verify the tarball before publishing**, since none of the above fails at
   build time: `npm pack`, install the `.tgz` into an empty dir, and
   `node -e "import('<pkg>')"` (or run its `bin`) with **node**, not bun.
5. Configure Trusted Publishing on the package (see below).

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
