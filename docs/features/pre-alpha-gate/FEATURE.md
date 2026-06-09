---
name: pre-alpha-gate
description: Server-side feature gate that blocks all "do-work" surfaces until the free LLM chain crosses BIRD ≥ 0.65 AND Spider ≥ 0.75 on the quality-eval harness; bypassed by a per-user allowlist or a request-header invite code.
when-to-load:
  globs:
    - apps/api/src/gate/**
    - apps/api/src/index.ts
    - packages/sdk/src/index.ts
    - cli/internal/api/client.go
    - cli/internal/cmd/*.go
    - apps/web/src/lib/api.ts
    - apps/web/src/components/CreateForm.tsx
  topics: [gate, pre-alpha, waitlist, invite-code, eval-baseline, allowlist]
---

# Feature: Pre-Alpha Gate

**One-liner:** Every "do-work" surface (SDK · CLI · MCP · `<nlq-data>` · web hero / chat) refuses with HTTP 403 `feature_gated` until the free chain clears BIRD ≥ 0.65 AND Spider ≥ 0.75; design-partner allowlist + invite codes bypass.
**Status:** implemented (Slice 1 — closed). The gate is **active** today (BIRD 0.318, Spider not yet measured) and will remove itself when both thresholds clear.
**Contribution to north-star:** UX (zero accidental impressions of bad NL→SQL on strangers) and engine quality (the gate surfaces the weekly BIRD/Spider numbers as a hard product constraint, not a metric). Per [`GLOBAL-025`](../../decisions/GLOBAL-025-north-star.md) the trade is explicit: onboarding throughput degrades while the gate is live; that's the deal until the eval crosses.
**Owners (code):** `apps/api/src/gate/**`, `packages/sdk/src/index.ts` (error code), `cli/internal/{api,cmd}/**` (`--invite-code`), `apps/web/src/{lib,components}/**` (progress bar), `packages/elements/src/{fetch,render,action-render}.ts` (inline CTA per [`SK-ELEM-014`](../elements/decisions/SK-ELEM-014-feature-gated-inline-cta.md)), `apps/docs/src/content/docs/pre-alpha.mdx` + sidebar pin (gate-state page), `examples/{html,curl,cli}/README.md` (one-paragraph callouts that render into the autogen tutorials).
**Cross-refs:** [`GLOBAL-027`](../../decisions/GLOBAL-027-pre-alpha-gate.md) (canonical) · [`quality-eval/FEATURE.md`](../quality-eval/FEATURE.md) (source of the threshold numbers) · [`anonymous-mode/FEATURE.md`](../anonymous-mode/FEATURE.md) (anon gate ordering) · [`web-app/FEATURE.md`](../web-app/FEATURE.md) (Cmd+G removal).

## Touchpoints — read this feature before editing

- `apps/api/src/gate/eval-baseline.ts` — typed constants; an eval run updates via PR
- `apps/api/src/gate/check.ts` — pure decision function (no IO)
- `apps/api/src/gate/middleware.ts` — Hono middleware (mounts after `requirePrincipal`)
- `apps/api/src/index.ts` — `/v1/ask`, `/v1/run`, `POST /v1/databases`, `POST /v1/chat/messages` route definitions
- `packages/sdk/src/index.ts` — `feature_gated` `ApiErrorCode`, `gate` field on `ApiErrorBody`, `inviteCode` client option
- `cli/internal/api/client.go` — `X-Invite-Code` header
- `cli/internal/cmd/{root,ask,run}.go` — `--invite-code` flag, gate error rendering
- `apps/web/src/lib/api.ts` — `feature_gated` discriminant on `CreateError`
- `apps/web/src/components/FeatureGatedView.tsx` — shared progress bar + waitlist CTA
- `apps/web/src/components/CreateForm.tsx` — hero submission failure surface
- `apps/web/src/components/chat/ChatPanel.tsx` — chat reply gated state + render
- `apps/web/src/components/Waitlist.astro` — homepage `#waitlist` anchor target for the CTA
- `packages/elements/src/fetch.ts` — 403 flows through `kind: "api"` so the structured body reaches the renderer
- `packages/elements/src/render.ts` / `action-render.ts` — `<nlq-data>` / `<nlq-action>` render the inline waitlist CTA (see [`SK-ELEM-014`](../elements/decisions/SK-ELEM-014-feature-gated-inline-cta.md))

## Decisions

### SK-GATE-001 — Threshold lives as a typed constants file, not a runtime KV read

- **Decision:** The BIRD/Spider numbers used by `check.ts` come from `apps/api/src/gate/eval-baseline.ts` — a typed module exporting `{ bird_accuracy, spider_accuracy, bird_target, spider_target, measured_at }`. The [`quality-eval`](../quality-eval/FEATURE.md) run amends the file via PR after each successful run; no runtime fetch.
- **Core value:** Fast, Honest latency, Simple
- **Why:** The hot path (`POST /v1/ask`) cannot afford an additional KV round-trip for a value that changes rarely (only when an operator re-runs the eval). A flat-file constant is faster (zero IO) and reviewable (every threshold update is a diff humans can sanity-check before deploy). The freshness gap is acceptable because the gate is a "is the product ready" decision, not a rate limit — a stale "no" is still a correct "no".
- **Consequence in code:** `eval-baseline.ts` is the only place these numbers exist. A test pins the shape so the eval run's PR cannot land a malformed file. `check.ts` reads the module statically; no async, no try/catch.
- **Alternatives rejected:** KV read per request (adds 5–20 ms p50 on the hot path; the gate's freshness needs don't justify the cost); D1 row + cache (more code, same staleness story, more failure modes); GitHub Actions secret injected as a Worker env var (changes require a deploy roundtrip — slower than a PR merge).

### SK-GATE-002 — Two thresholds, ANDed: BIRD ≥ 0.65 AND Spider ≥ 0.75

- **Decision:** The gate is closed unless **both** lanes report a numeric accuracy meeting their target. A `null` lane (Spider, today — Phase 2 slice 3 hasn't shipped per [`SK-QUAL-003`](../quality-eval/FEATURE.md)) counts as "not met". Open-state is `gateState(b) === "open"` ⇔ `b.bird_accuracy >= 0.65 && b.spider_accuracy >= 0.75`.
- **Core value:** Bullet-proof
- **Why:** A single threshold rewards benchmark-fitting. BIRD alone has 11 SQLite schemas the model can memorize patterns of; Spider exists to measure cross-dialect generalization that BIRD's transpilations don't fully cover. Two ANDed thresholds force the engine work toward genuine generalization rather than overfitting to the gate metric.
- **Consequence in code:** The decision function returns a discriminated union `{ kind: "open" } | { kind: "closed"; lanes: {bird: LaneStatus; spider: LaneStatus} }`. The closed branch carries enough state to render the progress bar without a second call.
- **Alternatives rejected:** Single threshold (BIRD only) — overfitting risk; harmonic mean — masks one-sided failure; max-of (open if either crosses) — defeats the dual-evidence purpose; weighted average — opaque to consumers who'd see a single fabricated number.

### SK-GATE-003 — Two bypass paths: per-user allowlist + invite code, checked in parallel, fail-closed on KV outage

- **Decision:** Two KV-backed bypass mechanisms, both checked before the gate fires: (1) `gate:user:<principal.id>` for design-partner accounts (keyed by `principal.id`, which is the account-tenant for `user`/`sk_live`/`sk_mcp`/`pk_live` and never matches an `anon` principal); (2) `gate:invite:<sha256(code).slice(0,32)>` looked up from the `X-Invite-Code` request header (works for any principal kind including `anon`). Both lookups run in parallel via `Promise.all` to keep p50 unchanged. **KV exceptions are caught inside the bypass primitives**: the gate is fail-closed (a KV outage means we can't prove a bypass → caller sees the standard 403 body, not a 500), and the failure surfaces on the span as `nlqdb.gate.kv_error` so operators can correlate with KV health.
- **Core value:** Seamless auth, Goal-first, Effortless UX, Bullet-proof
- **Why:** Design partners arrive via two paths — "we onboarded them via a sign-up flow" (allowlist) and "we sent them an invite link before they signed up" (code). One-mechanism would force every partner through sign-up before first value, which contradicts [`GLOBAL-007`](../../decisions/GLOBAL-007-no-login-wall.md). Two orthogonal keys, one extra parallel KV read, full coverage. The fail-closed posture matches Cloudflare's explicit post-June-2026 KV-incident guidance ([`blog.cloudflare.com/workers-kv-restoring-reliability/`](https://blog.cloudflare.com/workers-kv-restoring-reliability/)) to catch KV exceptions inside middleware rather than let them propagate.
- **Consequence in code:** `middleware.ts` issues both `kv.get` calls in parallel via `Promise.all`. `bypass.ts` wraps both in try/catch and returns a `{hit, error?}` shape so the middleware sees the read outcome AND any KV error. The invite-header check runs unconditionally on every request — even when no header is present — to make the timing channel constant. Codes are stored as their SHA-256 prefix in KV, never plaintext. Invite codes MUST be ≥ 80 bits of entropy (≈ 14 base64url chars from a CSPRNG, e.g. `openssl rand -base64 12 | tr -d '+/=' | head -c 14`) per NIST SP 800-63B / 2026 OWASP guidance — operators issuing slogan-style codes ("NLQDB-2026") undermine the gate's security model.
- **Alternatives rejected:** Sign-in-and-allowlist only (gates anon partners pre-account); single shared password (no per-code revocation); JWT-style signed invite (more code, no offline-revocation knob); per-request signed URLs (couples the bypass to URL state, breaks browser bookmarking); propagating KV errors (returns 500 instead of an actionable 403 during a KV blip).

### SK-GATE-004 — Gate ONLY the four "do-work" routes; listings stay open

- **Decision:** The middleware is mounted on exactly four endpoints: `POST /v1/ask`, `POST /v1/run`, `POST /v1/databases`, `POST /v1/chat/messages`. Listing surfaces (`GET /v1/databases`, `GET /v1/keys`, `GET /v1/chat/messages`, `GET /v1/keys/:hash/status`) and admin surfaces (`/v1/keys` mint/revoke, `/v1/waitlist`, `/v1/anon/adopt`, auth routes) are untouched.
- **Core value:** Simple, Honest latency
- **Why:** Pre-alpha users have nothing to list; closed-but-listable surfaces are honest about that. Conversely, a signed-in design partner whose account predates the gate would suddenly see `GET /v1/databases` fail if we gated everything, which is the wrong message. The gate is a "do-work stop", not a quarantine.
- **Consequence in code:** Hono middleware is wired explicitly per-route, not via a top-level `app.use("/v1/*")`. The `/v1/keys` routes — even though they create resources — are unchanged because they don't *produce work*; a leaked `sk_live_` key still hits the gate at every `/v1/ask` call site, which is where the gate matters.
- **Alternatives rejected:** Gate every `/v1/*` route (breaks listings for design partners on the bypass); gate `/v1/*` then per-route opt-out (inversion of the readable default); gate at orchestrator entry instead of route entry (skips the parse-error fast path; double-charges parse + auth before the gate fires).

### SK-GATE-005 — `feature_gated` is its own error code (not 401 `auth_required`)

- **Decision:** The gate response is HTTP 403 with `{error.status: "feature_gated"}`. Distinct from 401 `auth_required` (used by [`SK-ANON-010`](../anonymous-mode/FEATURE.md) for the global-cap soft-promotion) and from 429 `rate_limited`. The body carries `message`, `action`, `waitlist_url`, and a `gate: { bird_accuracy, spider_accuracy, bird_target, spider_target, measured_at }` block.
- **Core value:** Honest latency, Bullet-proof
- **Why:** 401 implies "auth and retry"; 402 implies "pay and retry"; both are misleading here. 403 with a typed sub-status is the semantic match — "the request is well-formed and you are who you say you are; the resource is conditionally unavailable". Surfaces that already special-case `auth_required` (CreateForm.tsx, the CLI) would either misroute (redirect to sign-in solves nothing) or have to grow a sub-discriminant. Distinct status is cheaper to consume.
- **Consequence in code:** SDK's `ApiErrorCode` union gets `"feature_gated"`; `ApiErrorBody` gains optional `gate` and `waitlist_url` fields. The retry loop in `packages/sdk/src/index.ts::send` returns false from `isRecoverable` for `feature_gated` — it's a terminal 4xx alongside `rate_limited` and `unauthorized`.
- **Alternatives rejected:** 401 `auth_required` with `code: "pre_alpha"` (overloads an auth status; surfaces misroute); 402 Payment Required (no payment is involved); 423 Locked (semantically closer but renderer-hostile — most clients don't handle it); 503 Service Unavailable (suggests transient; misleads retry budgets).

### SK-GATE-006 — `feature.requested.early_access` event on every gated request

- **Decision:** Every gated request fires a typed `feature.requested.early_access` event via the existing `packages/events` pipeline before returning the 403. Fire-and-forget through `ctx.waitUntil` so the response doesn't wait on the queue enqueue.
- **Core value:** Bullet-proof, Honest latency
- **Why:** Per [`GLOBAL-024`](../../decisions/GLOBAL-024-demand-signal-telemetry.md), every "not yet" path emits a typed event. The gate is the largest "not yet" surface we'll ever have until the eval clears — the event stream is the only way to size "we should publish, even though the gate is closed" decisions (e.g. a 100× spike from a HN post is a signal to ship faster, not to keep the gate).
- **Consequence in code:** `middleware.ts` imports the existing `buildEventEmitter` from `apps/api/src/ask/build-deps.ts` and emits with `name`, `principalId`, `surface`. Schema lives in `packages/events/src/types.ts` as `FeatureRequestedEarlyAccessEvent`. LogSnag channel: `#north-star` (the same channel quality-eval lands on, so the gate-block rate and the eval delta appear side-by-side in the digest).
- **Alternatives rejected:** Log-only (no aggregation, no Slack alerting); single counter `gate.blocks_total` (no granularity by surface/principal/lane); post-hoc waitlist signups (lossy — most blocked callers won't sign up but they're still the demand we want to measure).

### SK-GATE-007 — Auto-issue one invite code per new waitlist signup, capped at 200/week

- **Decision:** When a new email is inserted into the waitlist for the first time, `POST /v1/waitlist` auto-generates a 128-bit CSPRNG invite code (22-char base64url), writes its SHA-256 prefix to `gate:invite:<hash>` in KV (30-day TTL), and sends the code to the signup email via Resend. A rolling weekly counter at `wl:invite-cap:<epoch-week>` limits issuance to 200 codes per 7-day window. Invite + email are fire-and-forget (`ctx.waitUntil`) so the 200 isn't blocked. Any failure in invite issuance is caught and logged — the signup still succeeds. Duplicate signups receive no code.
- **Core value:** Goal-first, Effortless UX, Bullet-proof
- **Why:** The gate's invite-code bypass (SK-GATE-003) is the only way to reach the product while BIRD/Spider thresholds are unmet. Manual operator issuance meant zero strangers could try the product. Auto-issuance on waitlist signup keeps the gate's spirit (bounded weekly throughput protects free-LLM quota) while converting every waitlist entry into a real product trial. 200/week ≈ 10k invites/year, far below the free-chain ceiling.
- **Consequence in code:** `apps/api/src/waitlist-invite.ts` owns `generateInviteCode`, `tryIssueInvite`, and `buildInviteEmail`. `waitlist.ts:WaitlistDeps` gains optional `emailSender` and `inviteCap` fields; when `emailSender` is present the invite chain runs via `Promise.all` alongside the events emit. `apps/web/src/lib/invite.ts` reads `?invite=<code>` site-wide via `Base.astro` (so press-launch URLs into `/solve/` and `/vs/` capture too), writes it to `localStorage["nlqdb_invite"]`, and strips the param; `apps/web/src/lib/api.ts` attaches it as the `X-Invite-Code` header on every `/v1/ask`. Because `nlqdb.com` POSTs cross-origin to `app.nlqdb.com`, `x-invite-code` MUST be in `credentialedCors.allowHeaders` or the preflight aborts and invited users 403 — pinned by `test/cors.test.ts` + the `verify-flows.sh` guard.
- **Alternatives rejected:** Manual `wrangler kv key put` per invite (blocks acquisition — requires operator action for every user); unlimited issuance (exhausts free-LLM quota on abuse); time-limited codes shorter than 30 days (a link sat on over a weekend would expire); requiring sign-up before invite (contradicts GLOBAL-007 — login wall before first value).

### SK-GATE-008 — Gate outcomes are a counter metric, not just a span attribute

- **Decision:** Every gate decision increments `nlqdb.gate.checks.total{outcome, bypass_reason, principal_kind}` (in `@nlqdb/otel`) alongside the `nlqdb.gate.check` span attrs. `middleware.ts` writes both through one `recordOutcome` helper.
- **Core value:** Honest latency, Bullet-proof
- **Why:** The funnel — block rate, invite redemptions, brute-force (`invite_invalid`) attempts — is the "is the gate costing us signups" signal, but it lived only on spans, and Tempo caps trace queries at 30 days so the history evaporates. A counter stays queryable in Prometheus indefinitely.
- **Consequence in code:** ≈84 series (2 × 6 × 7), well under the 8 k cardinality budget (`docs/performance.md` §3.3). No PII — `principal_kind` is a kind, not an id.
- **Alternatives rejected:** Span-attr only (the 30-day retention loss that motivated this); per-code KV redemption tally (high-cardinality, deferred — `invite_invalid` already flags brute force); the events pipeline (not landing rows today).

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per
GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list
below names the rules that constrain this feature.

- **GLOBAL-007** — No login wall before first value.
  - *In this feature:* the invite-code path is the bypass that keeps anon callers (no account) able to clear the gate; once eval crosses, the gate evaporates and the rule applies unmodified.
- **GLOBAL-012** — Errors are one sentence with the next action.
  - *In this feature:* `error.message` is one sentence; `error.action` is "Join the waitlist"; `error.waitlist_url` is the next action.
- **GLOBAL-014** — OTel span on every external call.
  - *In this feature:* `nlqdb.gate.check` is a process-local span (no external call); the two KV reads ride the parent route span.
- **GLOBAL-022** — Recoverable failures retry to success.
  - *In this feature:* `feature_gated` is **not** recoverable; SDK / CLI retry loops treat it as terminal.
- **GLOBAL-024** — Demand-signal telemetry on every "not yet" path.
  - *In this feature:* `feature.requested.early_access` fires on every block; see SK-GATE-006.
- **GLOBAL-025** — North-star KPIs.
  - *In this feature:* UX advances (no bad-NL→SQL impressions); onboarding degrades by design while the gate is live. The block rate is the new telemetry surface; the lifted gate is the exit.
- **GLOBAL-027** — Pre-alpha gate. **This feature implements it.**

## Open questions / known unknowns

- **Spider lane shipping** — Loader landed in [`SK-QUAL-007`](../quality-eval/FEATURE.md#sk-qual-007) (slice 3a, 2026-05-19); canonical multi-CSV scorer landed in [`SK-QUAL-008`](../quality-eval/FEATURE.md#sk-qual-008) (slice 3b, 2026-05-19). All 135 `local###` rows are now scoreable via the upstream Spider 2.0 multi-CSV evaluator (column-major comparator + per-instance `condition_cols` / `ignore_order`). First `spider_accuracy` measurement against the full 135-row subset enters `eval-baseline.ts` on the next manual eval run; the gate stays structurally closed until that number clears 0.75 (≥ 102 matches of 135).
- **Allowlist UI** — Today the allowlist is `wrangler kv key put` only. A founder-time tool to bump someone into the allowlist from the dashboard is a Phase 2 nice-to-have; nothing in the data model blocks it.
- **Invite-code expiry** — Auto-issued codes (SK-GATE-007) now carry a 30-day KV TTL. Manually operator-issued codes still have no TTL; rotation remains "delete + re-issue". If time-bounded codes are ever needed, the value side can grow from `"1"` to `{expires_at: number}` without a schema migration.
- **Removal PR** — When both lanes clear, removing the middleware is one file delete + one diff on `index.ts` + one line on `apps/api/src/gate/eval-baseline.ts` that's the trigger. Per [`SK-DOCS-005`](../docs-site/FEATURE.md#sk-docs-005) the same PR also deletes `apps/docs/src/content/docs/pre-alpha.mdx`, the `astro.config.mjs` sidebar pin, and the `<Aside type="caution">` callouts in `index.mdx` / `mcp.mdx` / `reference/http-api.mdx` plus the README callouts in `examples/{html,curl,cli}/`. A placeholder so the small follow-up PR isn't forgotten.
