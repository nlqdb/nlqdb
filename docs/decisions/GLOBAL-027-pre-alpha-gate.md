# GLOBAL-027 — Pre-alpha gate: every "do-work" surface blocks until the free chain clears BIRD ≥ 65% AND Spider ≥ 75%

- **Decision:** Until the free LLM chain (the strict-$0 path from
  [`GLOBAL-026`](./GLOBAL-026-llm-strategy-byollm-hosted-premium.md))
  clears **two simultaneous thresholds on the
  [`quality-eval`](../features/quality-eval/FEATURE.md) harness** —
  BIRD-dev execution-accuracy ≥ 0.65 **AND** Spider 2.0-lite
  execution-accuracy ≥ 0.75 — every "do-work" entry point on every
  surface returns HTTP 403 with `{error.status: "feature_gated"}` and a
  live progress payload. The gated endpoints are exactly four:
  `POST /v1/ask`, `POST /v1/run`, `POST /v1/databases`, and
  `POST /v1/chat/messages`. Every surface that produces user work
  (SDK · CLI · MCP · `<nlq-data>` · web hero / chat) inherits the gate
  through them. Two bypass paths, checked in order before the gate
  fires:
  1. **Design-partner allowlist** — KV set
     `gate:user:<principal.id>`. Carries the account-tenant for
     `user` / `sk_live` / `sk_mcp` / `pk_live` principals, never set
     for `anon`. Maintained via `wrangler kv key put`.
  2. **Invite code** — `X-Invite-Code: <code>` request header looked
     up in KV `gate:invite:<sha256(code).slice(0,32)>`. Codes are
     never stored plaintext; lookup is constant-time relative to the
     client by always issuing the KV read on a present header.
     Works for anon AND authed callers, so design partners can hand a
     code to a teammate without provisioning them an account.

  Open-state is computed in pure code from a typed constants module
  (`apps/api/src/gate/eval-baseline.ts`) shaped exactly like a
  `LaneSummary` slice of [`SK-QUAL-002`](../features/quality-eval/FEATURE.md)'s
  `EvalReport`. An eval run PRs an update to that file when
  it lands a new report; no runtime KV / D1 read for the threshold
  itself (the file IS the contract). When both thresholds clear the
  middleware short-circuits to `next()` with zero extra IO, and the
  gate is removed from the route chain in a follow-up PR.

  Error envelope (matches [`GLOBAL-012`](./GLOBAL-012-one-sentence-errors.md)
  — one sentence + the next action — and the existing structured-
  error pattern from [`apps/api/src/anon-global-cap.ts`](../../apps/api/src/anon-global-cap.ts)):

  ```jsonc
  {
    "error": {
      "status": "feature_gated",
      "message": "nlqdb is pre-alpha — join the waitlist for early access.",
      "action": "Join the waitlist",
      "waitlist_url": "https://nlqdb.com/#waitlist",
      "gate": {
        "bird_accuracy": 0.522,
        "spider_accuracy": 0.17,
        "bird_target": 0.65,
        "spider_target": 0.75,
        "measured_at": "2026-06-12T07:30:09.249Z"
      }
    }
  }
  ```

  `gate.{bird,spider}_accuracy` are `number | null`; `null` means a
  lane hasn't been measured yet (it renders honestly as "not yet
  measured"). As of the 2026-06-12 first complete canonical runs both
  lanes carry measured values (BIRD 0.522, Spider 0.17) and both stay
  below target. Surfaces render the pair as a
  progress bar.

- **Core value:** Bullet-proof, Honest latency, Goal-first

- **Why:**
  - **Bad NL→SQL at scale kills the "great on free LLMs" thesis.**
    [`GLOBAL-026`](./GLOBAL-026-llm-strategy-byollm-hosted-premium.md)
    bets the company on free-chain quality compounding with frontier
    models; shipping a public surface at the current free-chain BIRD
    execution-accuracy (0.522 as of 2026-06-12,
    `eval-baseline.ts`) burns that narrative on impressions we can't
    recover. The gate buys time
    to land the scaffolding (planner, validator, plan-cache, retrieval,
    trust UX) before strangers form an opinion.
  - **Cmd+G is security-by-obscurity.** The keyboard-chord reveal in
    `apps/web/src/components/Topnav.astro` hid the form from drive-by
    visitors but didn't gate the API; anyone who watched the network
    tab could POST `/v1/ask` directly. A server-side gate is the
    correct primitive and supersedes Cmd+G entirely.
  - **Waitlist demand-signal is more valuable than the closed surface.**
    Per [`GLOBAL-024`](./GLOBAL-024-demand-signal-telemetry.md), every
    "not yet" path fires a typed event. A `feature.requested.early_access`
    emit on every gated request gives us a true denominator (intent ×
    surface × principal kind) we don't get from a hidden UI.
  - **Two thresholds, not one, force generalization.** BIRD alone
    rewards memorization of its 11 SQLite schemas; Spider alone
    rewards prompt-shape pattern-matching. Requiring both pushes the
    engine work toward generalization rather than benchmark-fitting.
  - **Why a flat-file threshold, not live KV.** Adding a KV read on
    every request to fetch the threshold creates a new external
    dependency on the hottest path. The cron rate (weekly) is
    incompatible with the request rate (per-call); a typed constants
    module updated by PR is both faster and reviewable.
  - **Why the bypass design.** Two orthogonal bypass keys —
    `gate:user:*` (long-lived, per-account, revocable) and
    `gate:invite:*` (long-lived shared secret, revocable by deleting
    the KV key) — cover the two paths design partners actually take:
    "we onboarded this person via account" and "we sent them an
    invite link before they had an account". One mechanism would
    force every design partner through a sign-up flow before they can
    smoke-test the API, which contradicts
    [`GLOBAL-007`](./GLOBAL-007-no-login-wall.md) (no login wall
    before first value).

- **Consequence in code:**
  - `apps/api/src/gate/` is the canonical owning module
    ([`GLOBAL-021`](./GLOBAL-021-external-system-ownership.md)):
    `eval-baseline.ts` (typed constants), `check.ts` (pure decision
    function), `middleware.ts` (Hono middleware), `__tests__/`.
  - `apps/api/src/index.ts` mounts the middleware on the four "do-work"
    routes in order: `requirePrincipal` → `gatePreAlpha` → handler.
    Listing endpoints (`GET /v1/databases`, `GET /v1/keys`,
    `GET /v1/chat/messages`) are untouched — pre-alpha users have no
    work product to list, and the listing surfaces stay honest about
    that.
  - SDK (`packages/sdk/src/index.ts`) adds `"feature_gated"` to
    `ApiErrorCode` and extends `ApiErrorBody` with the optional
    `gate` and `waitlist_url` fields. The retry budget (3 attempts)
    treats `feature_gated` as terminal — it's a 4xx with no retryable
    state. The SDK exposes an `inviteCode` option on `createClient()`
    that adds `X-Invite-Code` to every request.
  - CLI (`cli/internal/api/client.go`) reads `NLQDB_INVITE_CODE` env
    var and surfaces `--invite-code` as a persistent flag; the value
    is sent as `X-Invite-Code` on every call. `renderAPIError`
    renders the gate payload as a one-sentence message + progress
    line + waitlist URL.
  - MCP (`packages/mcp/`) inherits the gate through the SDK. The MCP
    host sees the `feature_gated` body verbatim — design partners
    paste their invite code into the host config's per-server `env`
    map (Cursor / Claude Desktop / VS Code all support this).
  - Web (`apps/web/`): `lib/api.ts` adds `feature_gated` to
    `CreateError`; `CreateForm.tsx` renders the progress bar +
    waitlist CTA when that error lands. The hero form renders
    unconditionally — the **Cmd+G chord and `[data-cmdg-gate]`
    attributes are deleted in this PR** because the server-side gate
    supersedes them.
  - Elements (`packages/elements/`): `fetch.ts` routes 403 through
    `kind: "api"` so the structured body reaches the renderer;
    `render.ts` / `action-render.ts` detect `error.status ===
    "feature_gated"` and emit an inline card with the server's
    message, an `<a href>` to `error.waitlist_url` (http/https
    allowlist), and the live BIRD / Spider lane progress. The
    `<nlq-action>` variant drops the retry button — the gate is not
    transient. See [`SK-ELEM-014`](../features/elements/decisions/SK-ELEM-014-feature-gated-inline-cta.md).
  - One new OTel span `nlqdb.gate.check` per request with attributes
    `gate.outcome` (`pass` | `block`), `gate.bypass_reason`
    (`none` | `allowlist` | `invite_code` | `open`),
    `gate.bird_accuracy`, `gate.spider_accuracy`,
    `principal.kind`. Per [`GLOBAL-014`](./GLOBAL-014-otel-on-external-calls.md)
    no external call is made (KV is in-region, not "external" in the
    span sense), but the span gives us the metric we need for the
    bypass rate KPI.
  - One new typed event `feature.requested.early_access` fires
    fire-and-forget through `ctx.waitUntil` on every gated request
    (per [`GLOBAL-024`](./GLOBAL-024-demand-signal-telemetry.md)).
  - One new feature doc — [`pre-alpha-gate/FEATURE.md`](../features/pre-alpha-gate/FEATURE.md)
    — owns the SK-GATE-NNN namespace. Affected features
    (`anonymous-mode`, `web-app`, `sdk`, `cli`, `mcp-server`,
    `quality-eval`, `ask-pipeline`, `hosted-db-create`, `framework-wrappers`,
    `elements`) add a reference line under `## GLOBALs governing this feature`.

- **Alternatives rejected:**
  - **Keep Cmd+G; gate only at the client.** Doesn't gate the API.
    Anyone who can read the network tab — including LLM crawlers
    indexing public examples — POSTs `/v1/ask` directly. Burns the
    "great on free LLMs" narrative on impressions we never see.
  - **Single-threshold gate (BIRD alone).** Rewards benchmark-fitting
    on the 11 BIRD Mini-Dev schemas; Spider exists precisely to
    measure cross-dialect generalization. Two thresholds is the floor
    cost of an honest open-state declaration.
  - **Live KV read for the threshold on every request.** Adds a hot-
    path dependency on a value that changes weekly. Flat-file
    constants with a cron-issued PR is both faster and reviewable —
    each threshold update gets a diff humans can sanity-check before
    it ships.
  - **One KV namespace for bypass keys (codes only, no per-user
    allowlist).** Forces every design partner through a one-time
    sign-up before they can smoke-test the API; contradicts
    [`GLOBAL-007`](./GLOBAL-007-no-login-wall.md). The dual mechanism
    is one extra `kv.get()` (parallelisable with the code lookup) for
    a strictly better onboarding shape.
  - **Hard-coded list of bypass user IDs in source.** Every allowlist
    change becomes a Worker deploy; revocation is slow. KV is the
    right primitive — instant propagation, no rebuild.
  - **Plaintext invite codes in KV.** A KV listing leak (via a
    misconfigured binding or a compromised wrangler token) hands every
    code to the attacker. Storing `sha256(code).slice(0,32)` keeps the
    secret material owner-side; rotation is `kv key delete` +
    re-issue.
  - **Short / human-friendly invite codes.** NIST SP 800-63B and 2026
    OWASP guidance put the bar for "important account access" at ≥ 80
    bits of entropy (≈ 14 base64url chars from a CSPRNG). Operators
    issuing codes MUST generate them with `crypto.randomBytes(16)` or
    equivalent — short slogans like `NLQDB-2026` are guessable and
    fail the gate's security model. The system doesn't enforce
    server-side length (codes are opaque to it) so this is an
    operator-discipline rule called out in the feature's runbook.
  - **Letting KV exceptions propagate from middleware.** Post the
    June 2026 Cloudflare KV-availability incident, the explicit
    Cloudflare guidance (per
    [`blog.cloudflare.com/workers-kv-restoring-reliability/`](https://blog.cloudflare.com/workers-kv-restoring-reliability/))
    is to catch KV errors in middleware rather than crash the request.
    The gate fails **closed**: a KV outage means we can't prove a
    bypass, so the caller still sees the actionable 403 body (not a
    500), and operators see the failure via the
    `nlqdb.gate.kv_error` span attribute. Crashing-with-500 was the
    pre-hardening behaviour; the post-incident shape is the one that
    keeps the surface intact during a KV blip.
  - **402 Payment Required.** Misleading — there's nothing to pay for
    yet. 403 with a `feature_gated` status is the honest semantic.
  - **401 with `auth_required`.** Conflates the gate with the
    anon-cap soft-promotion path
    ([`SK-ANON-010`](../features/anonymous-mode/FEATURE.md)). Surfaces
    that already special-case `auth_required` would either misroute
    (redirect to sign-in solves nothing) or have to grow a sub-
    discriminant. A distinct status is cheaper to consume.
  - **Gate every route including listings.** A signed-in design
    partner whose account predates the gate would suddenly see their
    own `GET /v1/databases` fail. The gate isn't a quarantine; it's a
    "do-work" stop. Listing-only routes stay open.
  - **Gate at the SDK / CLI layer only.** A third-party who calls
    `/v1/ask` directly with `curl` would bypass it. The only correct
    gate boundary is server-side; clients render the response, they
    don't enforce policy.
  - **Defer the gate until after Phase 2 exit.** The "wait until
    quality is good" path takes the impression hit in the meantime.
    Shipping the gate now and removing it the same day the eval
    crosses is the cheaper sequence.

## Reconciliation with existing decisions

- [`GLOBAL-007`](./GLOBAL-007-no-login-wall.md) — "no login wall
  before first value". The gate is *not* a login wall: an anon caller
  with a valid `X-Invite-Code` clears it without an account. For
  callers without an invite the response is honest pre-alpha state,
  not "sign in to continue". Once the eval crosses, the gate evaporates
  and the rule applies unmodified.
- [`GLOBAL-012`](./GLOBAL-012-one-sentence-errors.md) — the gate body
  is one sentence (`message`) plus the next action (`action`,
  `waitlist_url`).
- [`GLOBAL-014`](./GLOBAL-014-otel-on-external-calls.md) — the
  `nlqdb.gate.check` span is on the in-process middleware itself,
  not an external call. The two KV reads (allowlist + invite) inherit
  the span from the parent route.
- [`GLOBAL-022`](./GLOBAL-022-recoverable-failures-retry-to-success.md)
  — `feature_gated` is **not** recoverable. The SDK retry loop
  treats it as a terminal 4xx alongside `rate_limited` and
  `unauthorized`.
- [`GLOBAL-024`](./GLOBAL-024-demand-signal-telemetry.md) — every
  gated request emits `feature.requested.early_access` so the
  waitlist demand surface gets the same telemetry shape as the other
  "not yet" paths.
- [`GLOBAL-025`](./GLOBAL-025-north-star.md) — the KPI advanced by
  this PR is **UX** (no more accidental impressions of bad NL→SQL)
  and **engine quality** (the gate is the forcing function that
  surfaces the BIRD/Spider numbers to the team weekly). Onboarding
  degrades by definition while the gate is live; the explicit deal is
  that we trade onboarding throughput for narrative integrity until
  the eval crosses. The KPI degradation is bounded in time (the gate
  removes itself when both lanes clear) and the loss is
  instrumentable via the new `gate.outcome=block` span attribute.
- [`GLOBAL-026`](./GLOBAL-026-llm-strategy-byollm-hosted-premium.md)
  — the gate is measured against the **free chain** specifically.
  BYOLLM and hosted-premium are unaffected at the request layer
  (they don't bypass the gate; the gate fires before lane dispatch).
  This is intentional: we're gating the *product*, not just the free
  lane — a paid user querying via BYOLLM still gets a pre-alpha
  product.

## Lifecycle

This GLOBAL is born `active` and ends `superseded` by the same shape
of change that retires Cmd+G: when both eval lanes clear, a follow-up
PR removes the middleware mount, deletes the `apps/api/src/gate/`
module, marks this decision `superseded by GLOBAL-NNN — open beta`,
and the index in `docs/decisions.md` reflects the swap. IDs are
sticky; the file stays.
