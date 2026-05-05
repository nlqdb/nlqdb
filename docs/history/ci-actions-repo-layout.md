# Lessons Learnt — `nlqdb/actions` reusable-workflow repo layout

Detail of the reusable CI / release pipeline shared across the eight nlqdb repos (web, platform, CLI, MCP, elements, SDKs, infra, actions). The 4-line consumer snippet and the high-level "what it does" live in [`../architecture.md` §9](../architecture.md#9-cicd); permissions live in [`../../docs/features/ci-permissions/FEATURE.md`](../../docs/features/ci-permissions/FEATURE.md). This file captures the **repo layout, workflow shape, and inputs/secrets/inputs-defaults** that a maintainer of `nlqdb/actions` needs.

---

## Repository layout

```
nlqdb/actions/
├── .github/workflows/
│   ├── ci.yml            # reusable CI pipeline (lint → typecheck → test → build → scan → release)
│   └── release.yml       # reusable release pipeline (changelog + npm publish + tag)
└── actions/
    ├── setup/            # composite — auto-detects node/go/python, installs + caches
    ├── llm-changelog/    # composite — generates CHANGELOG.md via Sonnet 4.6
    └── deploy-cloudflare/  # composite — wrangler deploy wrapper
```

Composite actions live alongside the reusable workflows in one repo so a single tag (`@v1`) carries both. Splitting them across repos doubles the version-pin surface; one tag at a time is the operating budget.

## Reusable-workflow vs composite-action choice

`ci.yml` and `release.yml` are **reusable workflows**, not composite actions, because they need:

- `permissions:` block (composite actions inherit caller's permissions; reusable workflows declare their own — this is the load-bearing reason).
- `concurrency:` to cancel in-flight runs on the same ref.
- A matrix (Ubuntu + repo's pinned language version by default).
- `secrets:` declarations for downstream tokens.

The `setup` / `llm-changelog` / `deploy-cloudflare` pieces don't need any of those — they are composites because composites are cheaper to call and the action runs in the caller's job context.

## Workflow properties

- **One file, one entry point.** No "language: node" / "language: go" input — the workflow auto-detects from the consumer's tree (`package.json` → node, `go.mod` → go, `pyproject.toml` → python). If a repo has multiple, the workflow runs all matching matrices.
- **Concurrency-safe.** Cancels in-flight runs on the same ref (`concurrency.group: ${{ github.workflow }}-${{ github.ref }}`, `cancel-in-progress: true`).
- **Cached aggressively.** Bun install cache (`~/.bun/install/cache`), `bun.lockb`, Go build cache, uv cache (`~/.cache/uv`).
- **Implicit matrix.** Ubuntu + repo's pinned version by default. Opt-in via `matrix-os:` / `matrix-versions:` inputs.
- **Fast-fail order:** lint → typecheck → test → build → scan → release. Cheapest signal first.
- **Lint/format stack** (chosen for sub-second monorepo feedback; full rationale in [`../history/infrastructure-setup.md` §8](./infrastructure-setup.md#8-dev-toolchain)):
  - **Biome** for JS/TS/JSON/CSS — single binary, replaces Prettier + ESLint.
  - **gofumpt** + **golangci-lint** for Go.
  - **ruff** for Python.
  - **lefthook** wires them into `pre-commit` (fix-and-stage), `commit-msg` (Conventional Commits), `pre-push` (whole-repo Biome + `go vet`). CI runs the same commands — hooks are first-line, CI is the backstop.
- **Free for public repos** — $0/mo per `architecture.md §6`.

## Inputs

All optional, sensible defaults:

| Input              | Default        | Purpose                                       |
| :----------------- | :------------- | :-------------------------------------------- |
| `package-manager`  | auto           | Override autodetect (`bun`, `npm`, `pnpm`)    |
| `run-release`      | `false`        | Run the release job (gate: see below)         |
| `matrix-os`        | `ubuntu-24.04` | OS matrix — opt into Windows / macOS         |
| `matrix-versions`  | repo-pinned    | Language version matrix                       |

## Secrets

All optional, declared via `secrets:` so the caller can `secrets: inherit`:

| Secret                  | Purpose                                       |
| :---------------------- | :-------------------------------------------- |
| `NPM_TOKEN`             | npm publish (release job)                     |
| `CLOUDFLARE_API_TOKEN`  | wrangler deploy via the `deploy-cloudflare` composite |
| `ANTHROPIC_API_KEY`     | LLM changelog generation                      |
| `CODECOV_TOKEN`         | Coverage upload                                |

A repo without any of these still gets lint/test/build green — release / deploy / changelog gracefully no-op when the secret is absent.

## Permissions

See [`docs/features/ci-permissions/FEATURE.md`](../../docs/features/ci-permissions/FEATURE.md) — load-bearing decision, owns its own skill so the least-privilege contract is canonical and audited.

## Release-job gate

```yaml
if: inputs.run-release && github.ref == 'refs/heads/main' && github.event_name == 'push'
```

Three conditions, all required. `run-release: true` alone is not enough — the workflow refuses to publish from a feature branch or a PR run. Release uses `llm-changelog` (Sonnet 4.6, per `architecture.md §7`) followed by `changesets publish` for npm packages or a tag-driven flow for the Go CLI.

## Conventions enforced by CI

- **Conventional Commits** via commit-lint in the `lint:` job. Failing commits are caught at the `pre-commit` lefthook hook locally; CI is the second gate.
- **Generated `CHANGELOG.md`** via `llm-changelog` (Sonnet 4.6) — the LLM groups commits by Conventional-Commit type and renders the why, not the what.
- **`changesets`** for npm packages — releases are batched, intentional, atomic across the @nlqdb scope.
- **Tag-driven** for the Go CLI (`cli/v0.4.2`) — Go modules don't have changesets; `goreleaser` reads the tag and ships.
- **Sticky comment** — every PR gets a sticky comment with build-size / coverage / p95-bench deltas + preview-deploy link. Updated, not appended, so PR review pages aren't a wall of bot comments.

## Source

Carried forward from pre-consolidation `docs/design.md §13.1–§13.5` (deleted in PR #81 commit `fb6e8c9`). The 4-line consumer snippet and high-level prose live in `architecture.md §9`; this file is the reusable-workflow-author reference.
