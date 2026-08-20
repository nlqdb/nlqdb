---
name: mcp-server
description: MCP server + `nlq mcp install` host detection (Claude Desktop, Cursor, etc.).
when-to-load:
  globs:
    - packages/mcp/**
  topics: [mcp, host-detection, claude-desktop, cursor]
---

# Feature: Mcp Server

**One-liner:** MCP server + `nlq mcp install` host detection (Claude Desktop, Cursor, etc.).
**Status:** partial (Phase 2) — design locked (`SK-MCP-001..014`). **Slices 1, 2, 3a, 3b, 3c shipped** (hosted MCP server end-to-end with per-key rate-limit + auth-failure observability). Slice 4 (`nlq mcp install` host-detect) remains open — see [`cli/FEATURE.md`](../cli/FEATURE.md).
**Owners (code):** `packages/mcp/**`, `apps/mcp/**`
**Cross-refs:** docs/architecture.md §3.4 (MCP server) · docs/phase-plan.md (Phase 2 mcp slice)

## Touchpoints — read this feature before editing

- `packages/mcp/**`
- `apps/mcp/**`

## Decisions

Canonical bodies live in [`decisions/`](decisions/) — one file per `SK-MCP-NNN`. The list below is the index; open the linked file for the full five-field block.

- [**SK-MCP-001**](decisions/SK-MCP-001-two-transports.md) — Two transports: hosted (default) and local stdio (npm fallback).
- [**SK-MCP-002**](decisions/SK-MCP-002-three-tools.md) — Fixed verb set: `nlqdb_query`, `nlqdb_read` (read-only, pre-authorizable sibling — never writes/creates, honest `readOnlyHint`), `nlqdb_list_databases`, `nlqdb_describe`, + additive `nlqdb_remember` (E-02 memory write) and `nlqdb_connect_database` (BYO-connect); no public `nlqdb_create_database`.
- [**SK-MCP-003**](decisions/SK-MCP-003-install-autodetect.md) — `nlq mcp install` no-arg auto-detects hosts; explicit `<host>` is the power-user override.
- [**SK-MCP-004**](decisions/SK-MCP-004-per-host-keys.md) — Per-host scoped keys: `sk_mcp_<host>_<device>_…`.
- [**SK-MCP-005**](decisions/SK-MCP-005-zero-db-drivers.md) — Zero DB drivers in `@nlqdb/mcp`'s lockfile (CI-enforced).
- [**SK-MCP-006**](decisions/SK-MCP-006-recoverable-revocation.md) — Revocation surfaces a recoverable `401 key_revoked` with one-line CTA.
- [**SK-MCP-007**](decisions/SK-MCP-007-shared-orchestration.md) — Streamable-HTTP (hosted) and stdio (local) — same `/v1/ask` orchestration.
- [**SK-MCP-008**](decisions/SK-MCP-008-host-detector.md) — Per-host detector behind one `HostDetector` interface.
- [**SK-MCP-009**](decisions/SK-MCP-009-per-key-revocation.md) — Per-key rate-limit bucket; revocation propagates ≤ 1 s.
- [**SK-MCP-010**](decisions/SK-MCP-010-implementation-slicing.md) — Implementation slicing: keys → stdio → hosted → install.
- [**SK-MCP-011**](decisions/SK-MCP-011-dynamic-client-registration.md) — Dynamic client registration (RFC 7591) via `/register`.
- [**SK-MCP-012**](decisions/SK-MCP-012-single-scope.md) — Single `mcp` scope; tool-level capability lives in `apps/api/`'s validator.
- [**SK-MCP-013**](decisions/SK-MCP-013-callback-bridge.md) — Cross-Worker callback bridge mints `sk_mcp_*` server-side via one-shot KV code.
- [**SK-MCP-014**](decisions/SK-MCP-014-do-revalidation-cache.md) — `McpAgent` DO caches `sk_mcp_*` + revalidates every 1 s.
- [**SK-MCP-015**](decisions/SK-MCP-015-stay-on-2025-11-25-until-v2-settles.md) — Serve 2025-11-25 until SDK v2 settles; never hand-roll 2026-07-28 on v1. Migration staged in [`E-08`](../agent-memory-pivot/worksheets/engine/E-08-mcp-2026-07-28-revision.md).
- [**SK-MCP-016**](decisions/SK-MCP-016-mcp-route-allows-any-browser-origin.md) — `/mcp` accepts any browser `Origin` (CORS reflects it, OPTIONS answered, 401 is CORS-readable); the load-bearing invariant is that `/mcp` never accepts cookies. OAuth / consent endpoints keep strict origin + redirect-URI validation. Supersedes the WS06-T5 Origin-allowlist note under **Open questions** below.

## Install paths

User-facing install flow lives at
[`docs.nlqdb.com/mcp/`](https://docs.nlqdb.com/mcp/) and documents only
the live paths (hosted connector URL, nlqdb.com one-click buttons,
`NLQDB_API_KEY` env var); `nlq mcp install` + the `app.nlqdb.com/mcp`
one-click join it when Slice 4 ships. The internal
contract — four paths terminate at the same `/v1/ask` orchestration and
the same fixed tool set (+ the additive `nlqdb_remember`, E-02, and
`nlqdb_connect_database`, byo-connect, verbs) — is canonical in [`SK-MCP-002`](decisions/SK-MCP-002-three-tools.md)
+ [`SK-MCP-007`](decisions/SK-MCP-007-shared-orchestration.md). Host
auto-detection lives in [`SK-MCP-003`](decisions/SK-MCP-003-install-autodetect.md).

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)).

- **GLOBAL-001** — SDK is the only HTTP client.
- **GLOBAL-002** — Behavior parity across surfaces.
- **GLOBAL-008** — One Better Auth identity across all surfaces.
- **GLOBAL-010** — Credentials live in the OS keychain; `NLQDB_API_KEY` is the CI escape hatch.
- **GLOBAL-017** — Two endpoints, two CLI verbs, one chat box — one way to do each thing.
- **GLOBAL-023** — Trust UX baseline.
  - *In this feature:* tools that mutate (writes / DDL) return `confirm_required` with the diff body (per `SK-TRUST-001`). Audit each host (Claude Desktop, Cursor, Zed) for diff-rendering ergonomics — hosts that hide the diff fail `SK-TRUST-001` on that surface. See [`trust-ux/FEATURE.md`](../trust-ux/FEATURE.md) Open questions.
- **GLOBAL-032** — Canonical user flows.
  - *In this feature:* FLOW-005 (P2 agent builder) is one of the canonical flows and runs over both `SK-MCP-001` transports. The **hosted** transport (`mcp.nlqdb.com`) no-credential subset (RFC 9728 root + scoped resource-metadata, RFC 8414 AS metadata, unauthenticated `initialize` + `tools/list` returning 401 with `WWW-Authenticate: Bearer realm=*, resource_metadata=*` whose URL matches the scoped discovery) is covered by `bash scripts/flow-005-walk.sh` ([`SK-STRG-005`](../stranger-test/decisions/SK-STRG-005-flow-005-walker.md)). The **local-stdio** transport (the npm-fallback install path) is covered by `bash scripts/flow-005-stdio-walk.sh` ([`SK-STRG-009`](../stranger-test/decisions/SK-STRG-009-flow-005-stdio-walker.md)), which spawns the real `@nlqdb/mcp` binary and asserts the `initialize` + `tools/list` catalog — the `SK-MCP-002` tools (`nlqdb_query` / `nlqdb_read` / `nlqdb_list_databases` / `nlqdb_describe` / the additive `nlqdb_remember`, E-02, and `nlqdb_connect_database`, byo-connect), with **no public `create_database` tool** (create is implicit via `nlqdb_query`). Both walk daily under `.github/workflows/acquisition-health.yml`. The credentialed subset (authenticated tool *invocation* — `nlqdb_query` against a DB, `nlqdb_list_databases`, `nlqdb_describe`) still needs an `sk_mcp_*`/`sk_live_*` key and stays in the verification mirror. Changes to the discovery routes, the auth-wall response shape, the tool catalog, or the protocol handshake must keep the walkers green or surface a regression in the daily artifact within 24 h.
- **GLOBAL-039** — Production hosts are https-only. *In this feature:* `apps/mcp/src/https-enforce.ts` runs first in the worker's `fetch` (301 + HSTS).

## Open questions / known unknowns

- **Dashboard `app.nlqdb.com/mcp` deep-link landing — Parked until the Slice 4 `nlq mcp install` build** (`GLOBAL-033`, surface-parity gap → ship with the install flow it serves). The `nlq mcp install` happy path (`SK-MCP-007`) needs a sibling `/mcp` landing that calls the session-gated `POST /v1/oauth/mcp-callback` (`SK-APIKEYS-009`) and serves the `nlqdb://install?…` deep link; the mint endpoint exists, the landing UI does not. Builds with Slice 4 (see [`cli/FEATURE.md`](../cli/FEATURE.md)), not on the `/app/keys` surface.
- **Promote-to-account UX — Parked until the dashboard DB-list slice** (`GLOBAL-033`, UX micro-decision → zero modals, reuse the existing pattern). Server contract is locked (`PATCH /v1/databases/:id { scope: "account" }`). Shape follows the `/app/keys` revoke affordance: an inline button on the DB row, single `PATCH`, optimistic in-place update — no modal, no redirect. Wired when the `/app` DB list ships, not on spec.
- **MCP `confirm_required` host-rendering audit — Parked until a host is observed dropping the diff body** (`GLOBAL-033`, speculative-scope → don't pre-audit all hosts on spec). A host that renders `confirm_required` as a one-button "Approve" without the diff breaks `SK-TRUST-001`; the mechanism is locked — the offending host gets a warning in `nlq mcp install`. Candidates to check when the first report lands: Claude Desktop, Cursor, Zed, Windsurf, VS Code Continue, Cline. Cross-ref: [`trust-ux/FEATURE.md`](../trust-ux/FEATURE.md).
- **Anthropic Connectors Directory submission — Resolved (engineering); the submission itself is a founder action, queued in [`docs/blocked-by-human.md`](../../blocked-by-human.md).** The original form (`https://clau.de/mcp-directory-submission`) was submitted by the founder 2026-06-12 but produced no listing; the 2026-07-21 reach re-verification (R-05 row #9) found the live path is the Claude.ai org **admin-settings submission portal** (Team/Enterprise-gated), so the pending human action is recorded in the founder queue — this feature carries no engineering blocker. Engineering prereqs done (WS06-T5): (a) **Superseded 2026-08-18 by [`SK-MCP-016`](decisions/SK-MCP-016-mcp-route-allows-any-browser-origin.md)** — `/mcp` accepts any browser `Origin` (CORS reflects it, OPTIONS answered, 401 stays CORS-readable so a browser client can start OAuth on the `WWW-Authenticate` challenge). The DNS-rebinding wording targeted localhost-bound MCP servers, does not apply to a TLS remote, and CSRF is closed by the "no cookies on `/mcp`" invariant pinned by test. OAuth / consent endpoints (`/authorize`, `/token`, `/register`, `/.well-known/*`, `/oauth/mcp-bridge-callback`) keep strict origin + redirect-URI validation unchanged. (b) Branded 256 × 256 SVG logo at `apps/web/public/logo.svg`, served from `nlqdb.com/logo.svg` (favicon at `apps/web/public/favicon.svg`). Tool-annotation hints (`readOnlyHint` / `destructiveHint`) are already wired per `SK-MCP-002`.
- **No headless credential reaches the hosted transport — Resolved 2026-07-26.** `@nlqdb/mcp@0.1.0` is live on npm (founder bootstrap-publish + Trusted Publisher configured the same sitting; OIDC cannot create a first version — [npm/cli#8544](https://github.com/npm/cli/issues/8544)) and the package is un-gated in-repo (`private` dropped, `--filter='@nlqdb/mcp'` in `release-npm.yml`), so the `SK-MCP-001` stdio escape hatch (`npx -y @nlqdb/mcp` reading `NLQDB_API_KEY`) is a real install path — a coding agent no longer dead-ends at the hosted `/authorize` browser consent. Standing guidance: do **not** add a bearer-key path to `apps/mcp` — that would amend `SK-MCP-001`'s hosted-transport contract to solve a problem the stdio transport already solves.
- **The headless credential is `sk_mcp_`, not `sk_live_` — Resolved 2026-07-28 (founder call).** `/app/keys` now mints `sk_mcp_*` per [`SK-APIKEYS-015`](../api-keys/decisions/SK-APIKEYS-015-mintable-sk-mcp-service-credential.md), which is the canonical body: least-privilege subset of `sk_live_` (no `POST /v1/db/connect`, so `nlqdb_connect_database` 403s by design — that is the intended capability boundary, not a bug), per-host revocable, surfaced as `mcp` so headless adoption is measurable, and deliberately **not** revoked by "sign out everywhere" (which supersedes `SK-APIKEYS-006`). The cross-surface sweep landed 2026-07-28: the npm README, `docs.nlqdb.com/{mcp,agent-memory}`, `stdio.ts`'s no-key hint and `tools.ts`'s error actions all name `sk_mcp_` now, and `tools.ts`'s `connect_requires_account` branch deliberately names `sk_live_` only — an MCP key can never satisfy it.
- **Tool errors never surface "an error occurred" for a known status — Resolved 2026-08-08.** `tools.ts mapSdkError` had branches for only ~13 of the SDK's `ApiErrorCode` literals; the rest (incl. `db_not_found`, `db_unreachable`, `db_misconfigured`, `schema_unavailable`, `invalid_body`) fell through to the generic bucket, so an agent remembering before it had provisioned a memory DB got the opaque *"An unexpected error occurred → email support"* instead of the create/list hint ([`GLOBAL-012`](../../decisions/GLOBAL-012-one-sentence-errors.md) violation). The map is now exhaustive over `ApiErrorCode`, **compile-time-guarded** (`AssertNever<UnmappedErrorCodes>` — a new status that isn't mapped fails `tsc`, not the agent), and covered by an anti-regression sweep over `KNOWN_ERROR_CODES`. Root cause was drift: the map was a hand-maintained subset with no type link to the SDK union.

- **`GLOBAL-003` gap — hosted-premium *subscribe* is web-only this slice.** The `model` preset (`auto|fast|best`, `SK-PREMIUM-014`) already rides MCP; only the subscribe/checkout affordance is missing, so MCP tool copy keeps "coming soon" for hosted premium until a headless-friendly upgrade path lands.

## Happy path walkthrough

End-user flow (install paths, in-LLM tool calls, preferences-DB
example) lives at [`docs.nlqdb.com/mcp/`](https://docs.nlqdb.com/mcp/).
The Jordan-the-Agent-Builder narrative is in
[`docs/research/personas.md` §P2](../../research/personas.md).
