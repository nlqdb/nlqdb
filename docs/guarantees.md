# Guarantees — what nlqdb promises

Single-page index of every cross-cutting guarantee the product makes. **Bodies live elsewhere — this page is link-only.** Every row points to a canonical decision ID (`GLOBAL-NNN` in [`decisions.md`](./decisions.md), `SK-*-NNN` in the per-feature [`SKILL.md`](../.claude/skills/) files). Per P3 in `CLAUDE.md`, a decision exists in exactly one place; this page only references.

The goal is "everything we promise on one page" without violating single-source-of-truth.

## Trust & UX

| Promise | Canonical ID |
|---|---|
| First value before login (anonymous mode is the default first-touch) | [`GLOBAL-007`](./decisions.md#global-007--no-login-wall-before-first-value) |
| No "pick a region", no config files in the first 60 s | [`GLOBAL-020`](./decisions.md#global-020--no-pick-a-region-no-config-files-in-the-first-60s) |
| Honest latency — show the live trace, never spinner-lie | [`GLOBAL-011`](./decisions.md#global-011--honest-latency--show-the-live-trace-never-spinner-lie) |
| Errors are one sentence with the next action | [`GLOBAL-012`](./decisions.md#global-012--errors-are-one-sentence-with-the-next-action) |
| Tokens refresh silently — never surface a 401 | [`GLOBAL-009`](./decisions.md#global-009--tokens-refresh-silently--never-surface-a-401) |
| Revocation is instant and visible across devices | [`GLOBAL-018`](./decisions.md#global-018--revocation-is-instant-and-visible-across-devices) |

## Pricing & honesty

| Promise | Canonical ID |
|---|---|
| $0/month free tier; no card, ever | [`GLOBAL-013`](./decisions.md#global-013--0month-for-the-free-tier-workers-free-tier-bundle--3-mib-compressed) |
| Free + Open Source core (Apache-2.0); Cloud is convenience, not a moat | [`GLOBAL-019`](./decisions.md#global-019--free--open-source-core-apache-20-cloud-is-convenience-not-a-moat) |
| No dark patterns: cancel one-click, export always free, no surprise bills | [`stripe-billing`](../.claude/skills/stripe-billing/SKILL.md#billing-constraints-and-philosophy) |

## Reliability & data integrity

| Promise | Canonical ID |
|---|---|
| Schemas only widen — never destructively migrated | [`GLOBAL-004`](./decisions.md#global-004--schemas-only-widen) |
| Every mutation accepts `Idempotency-Key` — retries are byte-exact | [`GLOBAL-005`](./decisions.md#global-005--every-mutation-accepts-idempotency-key) |
| Plans content-addressed by `(schema_hash, query_hash)` — no cache flushes | [`GLOBAL-006`](./decisions.md#global-006--plans-content-addressed-by-schema_hash-query_hash) |
| OTel span on every external call (DB, LLM, HTTP, queue) | [`GLOBAL-014`](./decisions.md#global-014--otel-span-on-every-external-call-db-llm-http-queue) |

## Surface & escape hatch

| Promise | Canonical ID |
|---|---|
| SDK is the only HTTP client | [`GLOBAL-001`](./decisions.md#global-001--sdk-is-the-only-http-client) |
| Behavior parity across surfaces (HTTP, SDK, CLI, MCP, elements) | [`GLOBAL-002`](./decisions.md#global-002--behavior-parity-across-surfaces) |
| New capabilities ship to all surfaces in one PR | [`GLOBAL-003`](./decisions.md#global-003--new-capabilities-ship-to-all-surfaces-in-one-pr) |
| Two endpoints, two CLI verbs, one chat box — one way to do each thing | [`GLOBAL-017`](./decisions.md#global-017--two-endpoints-two-cli-verbs-one-chat-box--one-way-to-do-each-thing) |
| Power users always have an escape hatch (raw SQL / Mongo / connection string) | [`GLOBAL-015`](./decisions.md#global-015--power-users-always-have-an-escape-hatch) |

## Security & operations

| Promise | Canonical ID |
|---|---|
| One Better Auth identity across all surfaces | [`GLOBAL-008`](./decisions.md#global-008--one-better-auth-identity-across-all-surfaces) |
| Credentials live in the OS keychain; `NLQDB_API_KEY` is the CI escape hatch | [`GLOBAL-010`](./decisions.md#global-010--credentials-live-in-the-os-keychain-nlqdb_api_key-is-the-ci-escape-hatch) |
| Reach for small mature packages before DIY; hard-pass on RC on the critical path | [`GLOBAL-016`](./decisions.md#global-016--reach-for-small-mature-packages-before-diy-hard-pass-on-rc-on-the-critical-path) |

## Maintenance

When a guarantee changes, update its canonical home — `decisions.md` for `GLOBAL-NNN`, the relevant `SKILL.md` for `SK-*-NNN` — and edit only the row label here if the user-facing wording shifts. Never copy the body. To find every doc that references an ID:

```bash
grep -rn 'GLOBAL-NNN' docs/ .claude/skills/
```

A row added here without a canonical home is a P4 (D2) violation — don't document ambiguity.
