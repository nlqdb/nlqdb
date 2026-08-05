# @nlqdb/cli

## 0.1.1

### Patch Changes

- cb957b2: Republish `@nlqdb/cli` so its registry manifest carries the `?utm_source=npm`
  homepage tag. The tag was committed in-repo after `0.1.0` published, so the
  served `0.1.0` still points its `homepage` at an untagged `https://nlqdb.com`
  — every click-through from the package page converts as `direct`, invisible to
  the GLOBAL-038 / SK-GTM-007 attribution the npm channel is meant to carry. This
  is the CLI half of the acquisition-channels `/daily` republish task (the
  `@nlqdb/sdk` half shipped in the 0.2.2 release). No code change — bin, shim and
  postinstall are byte-identical; only the published manifest's homepage moves.

## 0.1.0

### Minor Changes

- 26bdc9d: Bootstrap `@nlqdb/cli`: the npm shim that downloads the matching `nlq`
  Go binary from the GitHub Release pinned to the package's version,
  verifies its sha256 against the release's `checksums.txt`, and lands
  it on the user's PATH. Postinstall is a no-op inside the source
  monorepo (workspace detection) and during `npm pack`. Three install
  paths (`curl … | sh`, `brew install nlqdb/tap/nlq`, `npm i -g
@nlqdb/cli`) now all resolve to the same release artifact per
  [`SK-CLI-002`](https://github.com/nlqdb/nlqdb/blob/main/docs/features/cli/decisions/SK-CLI-002-distribution-channels.md).
