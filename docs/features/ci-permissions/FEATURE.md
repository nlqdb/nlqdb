---
name: ci-permissions
description: Least-privilege GitHub Actions `permissions:` blocks across reusable workflows. Default-deny; explicit grants per job; OIDC for publish.
when-to-load:
  globs:
    - .github/workflows/**
    - nlqdb/actions/.github/workflows/**
  topics: [permissions, github-actions, ci, oidc, gitops]
---

# Feature: CI permissions

**One-liner:** Least-privilege GitHub Actions `permissions:` blocks across reusable workflows. Default-deny; explicit grants per job; OIDC for publish.
**Status:** partial — reusable workflow contract locked (`SK-CIPERM-001..004`); `nlqdb/actions@v1` lives in its own repo, consumer repos call it with `secrets: inherit`. The CI-permissions linter (`SK-CIPERM-005`) is open work.
**Owners (code):** `.github/workflows/**` in every consumer repo; `nlqdb/actions/.github/workflows/ci.yml` in the reusable-workflow repo.
**Cross-refs:** [`docs/architecture.md §9`](../../architecture.md#9-cicd) (CI/CD overview) · [`docs/history/ci-actions-repo-layout.md`](../../history/ci-actions-repo-layout.md) (repo layout, inputs, secrets, gates)

## Touchpoints — read this skill before editing

- `nlqdb/actions/.github/workflows/ci.yml` — reusable CI workflow, declares the canonical `permissions:` block.
- `nlqdb/actions/.github/workflows/release.yml` — reusable release workflow, adds `id-token: write` for OIDC npm publish.
- Every consumer repo's `.github/workflows/ci.yml` — 4-line caller; should not redeclare `permissions:`.
- `nlqdb/actions/actions/deploy-cloudflare/` — composite action; runs in caller's job context, inherits permissions, must not assume any.

## Decisions

### SK-CIPERM-001 — Default-deny at the workflow root, explicit grants per job

- **Decision:** Every reusable workflow (`ci.yml`, `release.yml`) declares `permissions: {}` at the workflow root and grants only the specific scopes each job needs at the job level. No workflow inherits the repository's default `GITHUB_TOKEN` scope.
- **Core value:** Bullet-proof, Simple
- **Why:** GitHub's repo-level default permissions are `contents: write` (legacy) — every workflow gets write access to the entire repo unless explicitly narrowed. A compromised dependency in any job can push a commit, modify a release, or publish a tag. Default-deny at the workflow root makes this unreachable: a job that doesn't declare what it needs can't do anything destructive. Per-job grants make the audit trail explicit (`grep '^permissions:' .github/workflows/*.yml` shows every escalation).
- **Consequence in code:** `nlqdb/actions/.github/workflows/ci.yml` opens with `permissions: {}` at the top. Each job (`lint`, `typecheck`, `test`, `build`, `scan`, `release`) re-declares its own `permissions:` block. PRs that move `permissions:` to the workflow root with broad scopes (e.g. `contents: write` workflow-wide) are rejected. The CI-permissions linter (`SK-CIPERM-005`) enforces this in `nlqdb/actions`'s own self-test job.
- **Alternatives rejected:**
  - Inherit the org-default `permissions: contents: read` — works for read-only repos but breaks `release.yml`, which needs `id-token: write`. We'd end up with workflow-level grants anyway; better to make every workflow explicit.
  - Per-step `permissions:` — GitHub Actions doesn't support step-level permissions. Job-level is the smallest grain available.

### SK-CIPERM-002 — The canonical permission set for the CI workflow is `contents: read` + `pull-requests: write` + `id-token: write`

- **Decision:** The `ci.yml` reusable workflow grants exactly three scopes:
  - `contents: read` — checkout the consumer repo.
  - `pull-requests: write` — post the sticky build-size / coverage / p95 comment.
  - `id-token: write` — request an OIDC token (used by the release job for npm publish without long-lived `NPM_TOKEN`, and by `deploy-cloudflare` for OIDC-authenticated wrangler).
- **Core value:** Bullet-proof, Free
- **Why:** These three are sufficient for every CI job in the monorepo and for downstream repos. `contents: write` is never needed — releases push tags via the `changesets` action which uses OIDC, not `GITHUB_TOKEN`. `actions: read` for fetching artifacts across runs is opt-in per-job, not workflow-default. Wider grants invite a "while we're at it, give the workflow `packages: write` too" expansion that erodes the contract; pinning the canonical three keeps the audit small.
- **Consequence in code:** New scopes are not added without a `SK-CIPERM-NNN` decision. The release job opts into `packages: write` via its own job-level grant, not by adding to the workflow root. PRs that bundle "give the workflow `actions: write` while we're at it" without explicit justification are rejected.
- **Alternatives rejected:**
  - Add `actions: read` workflow-wide so any job can re-download artifacts — defeats per-job scoping; opt in where needed.
  - Add `packages: write` workflow-wide because release uses it — release is one job; grant at job level so the lint / test / build jobs can't publish.

### SK-CIPERM-003 — OIDC for publish; long-lived `NPM_TOKEN` is the fallback, not the default

- **Decision:** The `release` job in `release.yml` requests an OIDC token (`id-token: write`) and uses npm's "Trusted Publishing" path (npm verifies the OIDC claim against the configured GitHub repo + workflow path). `NPM_TOKEN` is supported as an optional secret for legacy packages or for repos that haven't been onboarded to Trusted Publishing yet.
- **Core value:** Bullet-proof, Free
- **Why:** Long-lived `NPM_TOKEN`s are a permanent footgun: rotation is manual, they leak via logs / env-dumps, and a compromised CI run can publish to any package the token covers. OIDC tokens are ephemeral (single-job, signed by GitHub, scoped to the calling repo + workflow); npm's Trusted Publishing checks the signature server-side. Even if the entire CI environment leaks, the OIDC token expires before it can be exfiltrated and reused.
- **Consequence in code:** `release.yml`'s `release` job declares `permissions: { id-token: write, contents: read }`. The `changesets/action@v1` step is configured with `provenance: true` to write npm provenance using the OIDC token. `NPM_TOKEN` is consulted via `if-not-present` semantics — present means use it, absent means assume Trusted Publishing.
- **Alternatives rejected:**
  - `NPM_TOKEN` only — the rotation-debt path; we accept it as fallback but not as default.
  - Vendor-managed signing keys (npm `--read-only`) — same rotation surface; OIDC is strictly better.

### SK-CIPERM-004 — Composite actions inherit the caller's permissions; they must not assume any

- **Decision:** Composite actions in `nlqdb/actions/actions/{setup,llm-changelog,deploy-cloudflare}` document their required scopes in the action's `README.md` but do not declare `permissions:` themselves (composite actions can't — only reusable workflows can). Callers must grant the documented scopes at the calling job level.
- **Core value:** Bullet-proof, Simple
- **Why:** GitHub Actions runs composites in the caller's job context — a composite has whatever permissions the calling job granted, no more and no less. A composite that "just works" because the caller had `contents: write` will silently fail in a repo with stricter defaults. Documenting required scopes makes the contract explicit; not declaring them in the composite itself avoids the false sense of security that `permissions:` in a composite would suggest (it's ignored).
- **Consequence in code:** Each composite action's `README.md` has a "Permissions" section listing required scopes (`deploy-cloudflare` documents it needs `id-token: write` for OIDC-authenticated wrangler; `llm-changelog` documents `contents: read` only — it generates output, doesn't write back). PRs that add `permissions:` blocks to a composite's `action.yml` are rejected with a comment pointing here.
- **Alternatives rejected:**
  - Declare `permissions:` in `action.yml` (composites) — silently ignored by GitHub Actions; misleads readers.
  - Bundle every required scope into the reusable workflow's defaults — violates `SK-CIPERM-001` (default-deny).

### SK-CIPERM-005 — A self-test job in `nlqdb/actions` lints the canonical workflows

- **Decision:** `nlqdb/actions` has a self-test job (`actionlint` + a custom rule) that fails any push if `ci.yml` / `release.yml` declare a workflow-root `permissions:` block with anything other than `{}`, or if a job grants a scope outside the canonical set without a referenced `SK-CIPERM-NNN` decision in the commit message.
- **Core value:** Bullet-proof
- **Why:** The contract above is grep-enforceable; an automated check is cheaper than a code-review checklist and doesn't drift. Tying the override path to a `SK-CIPERM-NNN` reference forces the conversation to happen in the decision record rather than in a commit nobody re-reads.
- **Consequence in code:** Status: not yet implemented. When it lands, `nlqdb/actions/.github/workflows/self-test.yml` runs `actionlint` plus a small bash check (`grep -E "^permissions:" .github/workflows/*.yml | grep -v "permissions: {}"`). The override mechanism is `# SK-CIPERM-006` (the next available ID) appended on the line that broadens the grant.
- **Alternatives rejected:**
  - Code-review checklist only — drifts; reviewers miss it; permissions sneak in.
  - GitHub branch-protection rule requiring "permissions audit" — bureaucratic, slows merges, doesn't catch the actual content.

## GLOBALs governing this feature

Canonical text in [`docs/decisions.md`](../../decisions.md). The list below names the rules that constrain this feature; any skill-local commentary is nested under the rule.

- **GLOBAL-013** — `$0/month free tier`.
  - *In this skill:* OIDC for publish (`SK-CIPERM-003`) keeps us off paid secret-rotation tools (HashiCorp Vault, AWS Secrets Manager) and removes the `NPM_TOKEN` rotation chore from the always-on list.
- **GLOBAL-014** — OTel span on every external call.
  - *In this skill:* CI runs aren't part of the user-facing trace, but the `deploy-cloudflare` composite emits a `nlqdb.ci.deploy` span when it has the OTel collector configured (Phase 2+). Permission to write OTel is in the `id-token: write` lane (vendor-issued OIDC at the OTel endpoint).

## Open questions / known unknowns

- **Repo-default `permissions:`.** GitHub allows org-wide setting of "default `GITHUB_TOKEN` permissions" — should we set this to `read` org-wide (defense in depth) or stay with the workflow-level explicit declarations only? Probably both, once `actionlint` self-test is reliable.
- **Per-environment scoping.** GitHub Environments support `permissions:` overrides per environment — useful for staging vs prod. Not yet used; revisit when staging environment lands in Phase 2.
- **`NPM_TOKEN` deprecation.** When does the long-lived `NPM_TOKEN` fallback in `SK-CIPERM-003` become forbidden rather than supported? Probably after every package on `@nlqdb/*` is on Trusted Publishing — track in `nlqdb/actions`'s release-pipeline issues, not here.
- **Org-wide `actionlint` enforcement.** Whether to run the `SK-CIPERM-005` self-test on every consumer repo (via a reusable test workflow) or only in `nlqdb/actions`. Phase 2 decision; not blocking.

## Source

Carried forward from pre-consolidation `docs/design.md §13.2` (deleted in PR #81 commit `fb6e8c9`). Repo layout, inputs, secrets, release-job gate live in `docs/history/ci-actions-repo-layout.md`; this skill is the canonical home for the permissions contract specifically because it's load-bearing for security and benefits from a SK-* decision record.
