---
"@nlqdb/cli": minor
---

Bootstrap `@nlqdb/cli`: the npm shim that downloads the matching `nlq`
Go binary from the GitHub Release pinned to the package's version,
verifies its sha256 against the release's `checksums.txt`, and lands
it on the user's PATH. Postinstall is a no-op inside the source
monorepo (workspace detection) and during `npm pack`. Three install
paths (`curl … | sh`, `brew install nlqdb/tap/nlq`, `npm i -g
@nlqdb/cli`) now all resolve to the same release artifact per
[`SK-CLI-002`](https://github.com/nlqdb/nlqdb/blob/main/docs/features/cli/decisions/SK-CLI-002-distribution-channels.md).
