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
  Step 2's `publishConfig` + `prepack`/`postpack` pair landed 2026-07-26, so the
  tarball's `main`/`exports` resolve to `dist/` and `src/index.ts` is no longer
  force-packed — `import "@nlqdb/mcp"` works from the registry, and the first
  (permanent) version won't ship the `@nlqdb/sdk` 0.1.0–0.2.1 defect. No `types`
  condition: the `bun build` bundle emits no `.d.ts`, and claiming one that
  isn't packed is the same class of lie.
  Only the founder's bootstrap-publish + Trusted-Publisher sitting is left;
  the command is queued as
  [`blocked-by-human.md`](../docs/blocked-by-human.md) bullet 2. Drop `private`
  in the follow-up PR, per the ordered list below.
- Everything else in `packages/*` — still gated.

To un-gate a new package, **in this order** — the repo change comes last,
because OIDC cannot create a package's first version (see below), so a
non-private package whose version is not yet on npm makes `changeset publish`
fail the whole release job:

1. Add a `build` script (tsup) that emits `dist/index.js` + `dist/index.d.ts`.
2. Add the publish metadata, **keeping `"private": true`** — it has to be in the
   manifest before the bootstrap publish, because that first version is
   permanent. `publishConfig` declares the *published* entrypoints and the
   `prepack`/`postpack` pair applies them at pack time, so workspace dev keeps
   reading `src/` via the top-level `main`/`exports`:
   ```json
   {
     "main": "./src/index.ts",
     "exports": { ".": "./src/index.ts" },
     "files": ["dist"],
     "license": "FSL-1.1-ALv2",
     "repository": {
       "type": "git",
       "url": "git+https://github.com/nlqdb/nlqdb.git",
       "directory": "packages/<name>"
     },
     "scripts": {
       "prepack": "node ../../scripts/apply-publish-config.mjs",
       "postpack": "node ../../scripts/apply-publish-config.mjs --restore"
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
   > **The `prepack`/`postpack` pair is not optional.** Rewriting
   > `main`/`types`/`exports` from `publishConfig` is a **pnpm** feature; npm
   > honours only its own keys there (`access`, `provenance`, `registry`,
   > `tag`) and silently drops the rest
   > ([npm/cli#7586](https://github.com/npm/cli/issues/7586)), so
   > `scripts/apply-publish-config.mjs` applies the override in `prepack` and
   > undoes it in `postpack`. The real fields can't just move to `dist/`:
   > every in-workspace consumer resolves the package through them (Bun/Vite,
   > no build step), and 5 of them break when `dist/` is absent. Without the
   > pair the published entrypoints point into `src/`, which `files` doesn't
   > pack (npm force-packs the `main` path only when it is written *bare* —
   > `@nlqdb/mcp`'s `main: "src/index.ts"` ships, `@nlqdb/sdk`'s
   > `"./src/index.ts"` doesn't — and either way that one file arrives without
   > its imports), so `import` throws `ERR_MODULE_NOT_FOUND` while every gate
   > stays green. Verified 2026-07-25 against the live registry: that is how
   > `@nlqdb/sdk` 0.1.0–0.2.1 shipped unimportable.
   > `apps/web/src/data/npm-tarball-entrypoint-integrity.test.ts` fails the
   > build if you forget the pair. The other viable surface is `bin` (what
   > `@nlqdb/mcp` does — its bin loads the source only when the source is
   > present *and* the runtime is Bun). Also don't add `"sideEffects": false`
   > to a package whose entry is a pure re-export barrel built by `bun build`:
   > the bundler shakes it down to a stub that still *builds* clean and then
   > fails to load.
3. **Verify the tarball**, since none of this fails at build time: `npm pack`
   (works while the package is still private), install the `.tgz` into an empty
   dir **outside the monorepo** — inside it Bun resolves the workspace copy and
   the test proves nothing — then `node -e "import('<pkg>')"`, or for a `bin`
   run it under **both** node and bun, which resolve the package differently.
4. Hand to the founder — one sitting, both account-walled: bootstrap-publish by
   hand (deleting `private` in the working tree only; the founder paste in
   [`blocked-by-human.md`](../docs/blocked-by-human.md) is the canonical form),
   then configure Trusted Publishing on the package (fields below). Both come
   before the repo change — CI's first publish of the package authenticates only
   through that Trusted Publisher.
5. *Then* the follow-up PR: drop `"private": true` and add a
   `bun run --filter='@nlqdb/<name>' build` step to `release-npm.yml` before the
   changesets action.

## Authentication: Trusted Publishing (OIDC)

Per [`SK-CIPERM-003`](../docs/features/ci-permissions/FEATURE.md), the
publish path is npm's Trusted Publishing — the `release` job mints an
OIDC token (`id-token: write`) and npm verifies the claim against the
configured GitHub repo + workflow. No long-lived secret in CI; npm
auto-attaches SLSA v1 provenance on OIDC publishes.

**Chicken-and-egg (one-time per new package):** OIDC cannot create a package's
first version ([npm/cli#8544](https://github.com/npm/cli/issues/8544)), and
Trusted Publishers can only be configured on a package that **already exists**
on npm. So publish the first version manually from a maintainer machine
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
