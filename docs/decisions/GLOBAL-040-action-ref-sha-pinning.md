# GLOBAL-040 — Every workflow `uses:` is SHA-pinned, with the version in a trailing comment

- **Decision:** Every external action reference in `.github/workflows/**` and
  `nlqdb/actions/**` is pinned to a full 40-character commit SHA with the
  release it corresponds to in a trailing comment
  (`uses: owner/repo@<40-hex> # vX.Y.Z`). No floating tags — not `@v4`, not
  `@v2.6.1`. This applies to **first-party `actions/*` refs too**, not only
  third-party ones. In-repo `./` refs need no pin (they are the repo's own
  content at the checked-out commit). `renovate.json5`'s
  `matchManagers: ["github-actions"] → pinDigests: true` rolls the pins
  forward; it has no owner filter, so it enforces the same scope.

- **Core value:** Bullet-proof, Simple

- **Why:** A tag is a movable pointer. Anyone with push on an action's
  repository can repoint it at malicious code, and every consumer executes
  that code on the next run with whatever `permissions:` and secrets the job
  holds — which for this repo includes Cloudflare deploy credentials, a
  long-lived PAT, and npm publish rights. Tag hijack is the mechanism behind
  essentially every advisory in the GitHub Actions ecosystem, so the pin is
  the control that matters. Recorded as a GLOBAL because the rule previously
  existed **only as a code comment in `.github/actions/setup/action.yml`**:
  an agent editing any other workflow never saw it, and 17 sites across 7
  actions had silently drifted onto floating tags (`@v0` on
  `anchore/sbom-action` worst of all) while the comment still claimed the
  discipline held. A rule every workflow must obey cannot live in one file
  nobody reads. The version comment is load-bearing in its own right: a bare
  SHA tells a reader nothing about what would break on a bump, and a
  comment naming only a major (`# v5`) goes stale silently once that major
  moves.

- **Consequence in code:** 115 external `uses:` sites across 33 workflow
  files, all pinned, all carrying a version comment. When adding or bumping
  an action, resolve the SHA from upstream
  (`git ls-remote https://github.com/<owner>/<repo> refs/tags/<tag>`) and
  confirm the tag is lightweight by checking `refs/tags/<tag>^{}` is empty —
  an annotated tag advertises the *tag object's* SHA, which Actions rejects.
  For a subdirectory action (`owner/repo/path@sha`) the SHA is the parent
  repository's. Pinning a floating tag to the SHA it already resolves to is
  a no-op at runtime and is always safe; changing which release is pinned is
  a version bump and needs its own review of the action's inputs.

- **Alternatives rejected:**
  - **Floating tags plus Dependabot/Renovate alerts** — the window between
    hijack and alert is the exposure, and the compromised code runs with the
    job's full credentials in that window. Pinning removes the pointer.
  - **Pinning third-party actions only** — the practical reading of "third
    party", but the repo already pinned `actions/*` everywhere it was
    compliant and `renovate.json5` never filtered by owner, so a narrower
    rule would have described neither the intent nor the tooling. `actions/*`
    is a GitHub-owned org, not a trust boundary the repo controls.
  - **Leaving it as a code comment in `setup/action.yml`** — that is exactly
    how 17 sites drifted while the stated policy read as satisfied.
