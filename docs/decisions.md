# Decisions Log — `GLOBAL-NNN`

Cross-cutting decisions that govern more than one feature. Every skill that
is affected by one of these GLOBALs **copies the decision verbatim** into
its own `SKILL.md`, with a `Source:` line pointing back to the anchor here
(see `docs/skill-conventions.md` §5).

This file is the canonical source. If you change a GLOBAL here, you must
update every skill that copies it in the same PR. To find duplicates:

```bash
grep -rn 'GLOBAL-NNN' .claude/skills/
```

Format of every block follows `docs/skill-conventions.md` §4 — the five
fields (Decision / Core value / Why / Consequence / Alternatives) are
mandatory. Core values are cited by name from `docs/architecture.md` §0.

## Index

| ID | Title | Primary surface(s) | Status |
|----|-------|---------------------|--------|
| GLOBAL-001 | SDK is the only HTTP client | every surface | active |
| GLOBAL-002 | Behavior parity across surfaces | every surface | active |
| GLOBAL-003 | New capabilities ship to all surfaces in one PR | every surface | active |
| GLOBAL-004 | Schemas only widen | schema-inference, plan-cache, db-adapter | active |
| GLOBAL-005 | Every mutation accepts `Idempotency-Key` | every mutating endpoint | active |
| GLOBAL-006 | Plans content-addressed by `(schema_hash, query_hash)` | plan-cache, ask-pipeline | active |
| GLOBAL-007 | No login wall before first value | auth, web-app, cli, ask-pipeline | active |
| GLOBAL-008 | One Better Auth identity across all surfaces | auth, cli, mcp, web-app | active |
| GLOBAL-009 | Tokens refresh silently — never surface a 401 | auth, sdk, cli, mcp | active |
| GLOBAL-010 | Credentials live in OS keychain; `NLQDB_API_KEY` is the CI escape hatch | cli, mcp, api-keys | active |
| GLOBAL-011 | Honest latency — show the live trace; never spinner-lie | web-app, ask-pipeline, observability | active |
| GLOBAL-012 | Errors are one sentence with the next action | every surface | active |
| GLOBAL-013 | $0/month for the free tier; Workers free-tier bundle ≤ 3 MiB compressed | every package | active |
| GLOBAL-014 | OTel span on every external call (DB, LLM, HTTP, queue) | observability, every surface | active |
| GLOBAL-015 | Power users always have an escape hatch (raw SQL/Mongo/connection string) | db-adapter, ask-pipeline, cli | active |
| GLOBAL-016 | Reach for small mature packages before DIY; hard-pass on RC on the critical path | every package — baseline | active |
| GLOBAL-017 | Two endpoints, two CLI verbs, one chat box — one way to do each thing | every surface | active |
| GLOBAL-018 | Revocation is instant and visible across devices | auth, api-keys | active |
| GLOBAL-019 | Free + Open Source core (Apache-2.0); Cloud is convenience, not a moat | every package — baseline | active |
| GLOBAL-020 | No "pick a region", no config files in the first 60s | web-app, cli, ask-pipeline | active |

---

## GLOBAL-001 — SDK is the only HTTP client

- **Decision:** Every nlqdb surface (`apps/web`, `cli/`, `packages/mcp`,
  `packages/elements`) consumes `@nlqdb/sdk`. No raw `fetch('/v1/...')`
  outside `packages/sdk/`.
- **Core value:** Simple, Bullet-proof
- **Why:** Surfaces drift when each owns their HTTP client — auth-header
  semantics, retry policy, error shape, idempotency handling end up with
  subtle differences. One client means one place to fix bugs and one
  place to add new endpoints. It is also the precondition for
  `GLOBAL-002` (behavior parity).
- **Consequence in code:** Lint/CI rejects `fetch()` calls referencing
  `/v1/` outside `packages/sdk/`. A new endpoint lands as an SDK method
  first; surfaces consume it after.
- **Alternatives rejected:**
  - Per-surface clients with shared types — types diverge subtly,
    especially around error envelopes and retry semantics.
  - Generated clients (OpenAPI / typed-fetch codegen) — generator quirks
    plus a runtime surface duplication; not worth the build-time cost.

## GLOBAL-002 — Behavior parity across surfaces

- **Decision:** Every surface (HTTP API, SDK, CLI, MCP, elements, web)
  presents the same auth modes, error shape, idempotency semantics, and
  rate-limit signaling. Surface-specific UX wrapping (CLI prompts vs.
  browser modals vs. MCP tool errors) is allowed; semantics are not.
- **Core value:** Bullet-proof, Effortless UX
- **Why:** Users and agents move between surfaces (CLI in dev, MCP in
  their IDE, web for sharing). If a 429 means "back off 1 s" in CLI but
  "give up" in MCP, behavior is unpredictable. Parity is what makes the
  multi-surface story credible.
- **Consequence in code:** Every error code, every header
  (`Idempotency-Key`, `X-RateLimit-*`, `Authorization`), and every
  status-mapping rule is defined once in `packages/sdk/` and re-used.
- **Alternatives rejected:**
  - Surface-specific error shapes — each surface team optimizes locally
    and the surfaces drift.
  - "Best effort" parity — degrades to no parity inside a year.

## GLOBAL-003 — New capabilities ship to all surfaces in one PR

- **Decision:** A capability isn't "done" until SDK + CLI + MCP + elements
  all expose it. The PR that adds the capability adds it to every surface,
  or annotates the affected skills with a tracked gap under *Open
  questions*.
- **Core value:** Simple ("one way to do each thing")
- **Why:** If a feature ships only on web, web becomes the "real" product
  and the others become legacy. nlqdb is one product surfaced four ways;
  the surfaces must move together.
- **Consequence in code:** PR template includes a capability-parity
  checklist. Reviews block on missing-surface boxes unless the
  corresponding skill is updated with a tracked gap.
- **Alternatives rejected:**
  - "Surfaces catch up later" — never happens.
  - "Web-first, others on demand" — creates a hierarchy of surfaces,
    contradicts `GLOBAL-002`.

## GLOBAL-004 — Schemas only widen

- **Decision:** Once a column or field is observed in a query plan, it
  stays in the schema fingerprint. Schemas grow; they don't shrink. The
  `schema_hash` is monotonically widened, never branched on a "schema
  mismatch" path.
- **Core value:** Bullet-proof, Simple
- **Why:** Branching on schema mismatch creates a combinatorial explosion
  of plan-cache keys, and every replanning is a chance to regress.
  Widening is monotonic and safe — old plans remain valid against
  widened schemas because the fields they reference still exist.
- **Consequence in code:** `schema_hash` is computed over observed-fields
  sorted by name; adding fields is append-only. `plan-cache` keys remain
  valid across widening; replanning is only triggered when an observed
  field disappears (which we treat as a hard-stop event, not a normal
  branch).
- **Alternatives rejected:**
  - Versioned schemas — more keys, more plans, more bugs.
  - Re-plan on any schema change — breaks `GLOBAL-006` (content-addressed
    cache).

## GLOBAL-005 — Every mutation accepts `Idempotency-Key`

- **Decision:** Every state-changing endpoint (HTTP, SDK, CLI, MCP)
  accepts an optional `Idempotency-Key` header. Mutations are recorded
  keyed by `(user_id, idempotency_key)` so retries return the original
  response body byte-for-byte.
- **Core value:** Bullet-proof, Honest latency
- **Why:** Networks fail. Workers retry. Without idempotency, retries
  duplicate writes (double-charge, double-emit, double-record). This is
  non-negotiable for any system that bills, emits events, or mutates
  state on behalf of an agent that can itself retry.
- **Consequence in code:** Every `POST` / `PATCH` / `DELETE` in the API
  layer reads `Idempotency-Key`, dedupes by `(user_id, key)` against a
  bounded-TTL store, and returns the recorded response on a hit. SDK
  helpers auto-generate keys for retried calls.
- **Alternatives rejected:**
  - Server-side dedup by content hash — misses semantic duplicates
    (same intent, different timestamp / nonce / client clock).
  - Client retries without keys — dangerous on any critical path; banned
    by review.

## GLOBAL-006 — Plans content-addressed by `(schema_hash, query_hash)`

- **Decision:** A query plan's cache key is the pair
  `(schema_hash, query_hash)`. There is no time-based invalidation, no
  "cache version," no manual flush. If the inputs match, the plan
  matches.
- **Core value:** Fast, Simple, Bullet-proof
- **Why:** Cache invalidation is the second-hardest problem in
  computer science; we side-step it by making every cache key
  derive entirely from the inputs that determine the output. Combined
  with `GLOBAL-004`, this guarantees plans are stable under benign
  schema growth.
- **Consequence in code:** `plan-cache` writes are keyed by
  `(schema_hash, query_hash)`; reads are exact-match only. Anything
  that wants to "force a new plan" must change `query_hash` (e.g., a
  pin or a hint), not invalidate the cache. LLM-generated plans are
  the only writers; humans pinning a plan write to the same store.
- **Alternatives rejected:**
  - TTL-based caches — wastes the 99% case where the inputs are
    unchanged, plus introduces flakiness around the boundary.
  - Versioned plans tied to schema versions — would force
    `GLOBAL-004` to branch.

## GLOBAL-007 — No login wall before first value

- **Decision:** A first-time visitor — on the web, in the CLI, or via an
  MCP-aware client — gets to a working answer before being asked to sign
  in. Anonymous mode is the default first-touch experience.
- **Core value:** Free, Effortless UX, Goal-first
- **Why:** Login walls kill the activation funnel. Our pitch is "a
  database you talk to" — not "create an account, verify email, choose
  a region, then talk." We can ask for the email after the user has
  already had a `wow`.
- **Consequence in code:** `apps/web` boots into a usable demo without
  a session. CLI's first `nlq ask` accepts an anonymous device, which
  later attaches to a Better Auth identity on first sign-in. The API
  has an explicit anonymous-mode rate-limit tier.
- **Alternatives rejected:**
  - Required signup with "free trial" framing — measurably worse for
    activation.
  - Auth-deferred-but-persistent — same effect as a wall, just delayed
    by one screen.

## GLOBAL-008 — One Better Auth identity across all surfaces

- **Decision:** A user has exactly one identity, managed by Better Auth.
  CLI, MCP, web, and SDK all authenticate through that identity (via
  bearer / cookie / device-flow). No surface owns its own auth store.
- **Core value:** Seamless auth, Simple, Bullet-proof
- **Why:** Multi-surface products fragment when each surface owns its
  own identity model — a user signs in to web but the CLI doesn't know,
  or the MCP key isn't tied to the same human. One identity model means
  one revocation surface (`GLOBAL-018`), one rate-limit surface, one
  audit log.
- **Consequence in code:** `packages/auth-internal` is the only thing
  that talks to Better Auth. Every other surface consumes its
  primitives. CLI's device-flow auth and MCP's host-scoped keys both
  resolve to a single `user_id`.
- **Alternatives rejected:**
  - Per-surface identity systems — fragmented audit trails, fragmented
    revocation, no cross-surface session continuity.
  - Bring-your-own-IdP only — punts the problem to operators; bad
    default for the free tier.

## GLOBAL-009 — Tokens refresh silently — never surface a 401

- **Decision:** When a token expires, the SDK refreshes it transparently
  before any user-visible failure. A 401 reaching the surface (web
  banner, CLI error, MCP tool error) is a bug, not a normal flow.
- **Core value:** Seamless auth, Effortless UX, Bullet-proof
- **Why:** Auth failures interrupt the user's actual goal. If the
  refresh path is reliable, the user never has to think about tokens.
  A user-visible 401 is a regression — file a bug.
- **Consequence in code:** `packages/sdk` wraps fetch with a
  refresh-on-401 retry that uses the refresh token. CLI and MCP rely on
  this same logic; they don't implement their own refresh. The web
  app's `useSession` hook auto-refreshes ahead of expiry where the
  expiry is observable.
- **Alternatives rejected:**
  - Force re-login on expiry — kills long-running CLI / agent sessions.
  - Aggressive proactive refresh on every call — wastes the auth
    server's budget.

## GLOBAL-010 — Credentials live in the OS keychain; `NLQDB_API_KEY` is the CI escape hatch

- **Decision:** Long-lived credentials (CLI tokens, MCP host keys) live
  in the OS keychain (Keychain on macOS, libsecret on Linux,
  Credential Manager on Windows). The only env-var path is
  `NLQDB_API_KEY`, used in CI / containerized environments where a
  keychain is unavailable.
- **Core value:** Seamless auth, Bullet-proof
- **Why:** Keychain storage means credentials survive reboots, are
  encrypted at rest by the OS, and don't leak into shell history /
  ps output / env-dump screenshots. The single env-var fallback is
  the explicit, auditable escape hatch — it doesn't quietly become
  the default.
- **Consequence in code:** `cli/` and `packages/mcp` use a small
  keychain abstraction; tokens are written there on first sign-in.
  When the keychain is missing (CI, Docker), `NLQDB_API_KEY` is read
  with a one-line message that names the env-var explicitly. No
  config-file fallback, no `~/.nlqdb/credentials.json`.
- **Alternatives rejected:**
  - Plain config-file storage in `~/.nlqdb/` — leaks via cloud
    backups / dotfile syncs.
  - Required env vars — bad UX on a developer laptop.

## GLOBAL-011 — Honest latency — show the live trace; never spinner-lie

- **Decision:** When a request is in flight, surfaces show what is
  actually happening (cache lookup, plan, allowlist, exec, summarize)
  with real timings — not a generic spinner. If a step takes long, we
  say what step.
- **Core value:** Honest latency, Effortless UX
- **Why:** A spinner that hides progress trains users to assume the
  worst. A live trace shows exactly where time goes and turns
  perceived latency into legible, cacheable, debuggable information.
  It also makes us better at performance because we *see* every slow
  step.
- **Consequence in code:** `apps/web` streams trace events from the
  ask-pipeline (or polls the OTel-exposed step state) and renders
  them in order. CLI's TTY mode prints each step as it completes.
  The SDK exposes an `onTrace` hook for surfaces to consume.
- **Alternatives rejected:**
  - Generic spinner with "this is taking longer than usual" — gives
    no information.
  - Hide latency below a threshold — users notice anyway, and lose
    trust when the threshold is wrong.

## GLOBAL-012 — Errors are one sentence with the next action

- **Decision:** Every user-facing error message is one sentence and
  contains an actionable next step. No stack traces in the surface.
  No "an error occurred." No multi-paragraph debug dumps.
- **Core value:** Effortless UX, Honest latency, Simple
- **Why:** Error messages are a UI surface. Long error messages train
  users not to read them; vague ones train users not to trust them.
  One sentence with a next action is read, understood, and acted on.
- **Consequence in code:** Every `throw` / `error()` call in user-
  facing paths returns a `code` (machine-readable) + `message` (one
  sentence) + `action` (what to do). Surfaces render `message` and
  optionally a CTA derived from `action`. Stack traces go to OTel
  spans, not to the user.
- **Alternatives rejected:**
  - Surface the underlying exception — leaks internals, scares users.
  - Generic "something went wrong" — prevents the user from helping
    themselves.

## GLOBAL-013 — $0/month for the free tier; Workers free-tier bundle ≤ 3 MiB compressed

- **Decision:** The free tier runs on Cloudflare Workers free plan,
  Neon free plan, and other zero-cost services. The deployed Worker
  bundle stays under 3 MiB compressed (Cloudflare's hard limit on the
  free plan is 3 MiB, paid is 10 MiB).
- **Core value:** Free, Bullet-proof
- **Why:** "Free forever" is the activation hook. If our infra cost
  per free user is non-zero, the runway turns into a wall. The 3 MiB
  ceiling is a real constraint that shapes dependency choices.
- **Consequence in code:** Every dependency is checked against bundle
  budget before adoption (`bun run build && wrangler deploy --dry-run`).
  Heavy deps (parsers, big crypto libs, full AI SDKs) are forbidden
  on the Workers path; equivalent functionality goes through HTTP
  to a cheaper backend or via tree-shakable submodules.
- **Alternatives rejected:**
  - "Free trial" with a card — kills activation.
  - Bigger bundle with paid plan default — locks us out of the
    Workers free plan, which is the actual product story.

## GLOBAL-014 — OTel span on every external call (DB, LLM, HTTP, queue)

- **Decision:** Every call that crosses a process boundary — DB query,
  LLM call, outbound HTTP, queue enqueue/dequeue — is wrapped in an
  OpenTelemetry span with the canonical attributes from
  `docs/performance.md` §3 (the span / metric / label catalog).
- **Core value:** Honest latency, Bullet-proof, Fast
- **Why:** Without spans on every external call, we can't answer "why
  is this request slow," "is the LLM the bottleneck," or "did this
  retry actually go to the DB twice." The catalog enforces consistent
  attribute names so dashboards and queries don't fragment.
- **Consequence in code:** `packages/otel` exposes the wrapper helpers;
  all DB / LLM / HTTP / queue clients in the codebase route through
  them. New external calls without a span fail review. Span names,
  attributes, and metrics match the catalog (no ad-hoc names).
- **Alternatives rejected:**
  - Sample only slow requests — loses the baseline distribution.
  - Per-team conventions — fragments the dashboards within a quarter.

## GLOBAL-015 — Power users always have an escape hatch

- **Decision:** Every layer that turns natural language into something
  executable — `/v1/ask` → SQL, plan-cache → plan, db-adapter → query
  — exposes the underlying primitive directly. A power user can
  bypass the LLM and run raw SQL / Mongo / connection-string queries.
- **Core value:** Creative, Bullet-proof, Goal-first
- **Why:** Anyone who outgrows the conversational interface must not
  hit a wall. The product loses credibility (and users) if "the LLM
  decided" is the only path to the data. The escape hatch is also
  the thing that makes the LLM safe — humans can verify and fix.
- **Consequence in code:** `/v1/run` (raw query) sits next to
  `/v1/ask` (NL query). CLI's `nlq run` runs raw SQL. The plan
  surfaced from `/v1/ask` is editable and re-runnable. Connection
  strings are exposed for users on plans that can self-host the DB.
- **Alternatives rejected:**
  - LLM-only API — fine for demos, fatal for production users.
  - Hide raw access behind enterprise tier — blocks the OSS
    contributor path and contradicts `GLOBAL-019`.

## GLOBAL-016 — Reach for small mature packages before DIY; hard-pass on RC on the critical path

- **Decision:** Before writing a primitive (auth, idempotency store,
  retry logic, queue, OTel exporter), check for a small, mature,
  actively-maintained package. If one exists, adopt it. Reject any
  RC / alpha / pre-1.0 dependency on a critical path unless the
  alternative is writing it ourselves.
- **Core value:** Bullet-proof, Simple, Free
- **Why:** Small, focused libraries that have been maintained for
  years are usually more reliable than the version of the same thing
  we'd write next quarter. RCs on the critical path become tech debt
  the moment the upstream stalls — and they always stall.
- **Consequence in code:** Dependency reviews check (a) maintenance
  cadence (releases in the last 6 months), (b) ecosystem (downloads,
  issues), (c) bundle weight (`GLOBAL-013`), (d) license. Reviews
  reject pre-1.0 deps unless explicitly justified in the PR.
- **Alternatives rejected:**
  - "Write it ourselves, it'll be better" — measurably untrue across
    auth, retry, ORM, queue.
  - "Adopt the newest thing" — RC churn poisons the critical path.

## GLOBAL-017 — Two endpoints, two CLI verbs, one chat box — one way to do each thing

- **Decision:** The HTTP API exposes two primary endpoints (`/v1/ask`,
  `/v1/run`). The CLI exposes two primary verbs (`nlq ask`, `nlq run`).
  The web app exposes one chat box. There is exactly one way to
  perform each conceptual operation; no aliases, no shadow endpoints.
- **Core value:** Simple, Effortless UX
- **Why:** Surface area is the enemy of learnability. If a user can
  do X "via two endpoints" or "via three commands," they spend energy
  on which one to pick instead of on their goal. A small canonical
  surface keeps docs short and behavior consistent.
- **Consequence in code:** New conceptual operations require a
  decision: extend an existing endpoint/verb, or introduce a third
  one (which requires explicit justification). No aliases. The CLI
  may have helpers (`nlq init`, `nlq login`) — but the *operations
  on data* are the two verbs.
- **Alternatives rejected:**
  - REST resource explosion (`/v1/queries`, `/v1/runs`, `/v1/plans`)
    — bigger surface, more docs, more inconsistency.
  - Multiple aliased CLI verbs — every alias becomes a new way to
    misuse the tool.

## GLOBAL-018 — Revocation is instant and visible across devices

- **Decision:** Revoking a token, API key, or session takes effect on
  the next request — no caching window, no propagation delay. The
  user sees, in every active surface, that the credential is gone.
- **Core value:** Bullet-proof, Seamless auth, Effortless UX
- **Why:** Revocation that "eventually" propagates is a security
  hole. A user pressing "sign out everywhere" or rotating an API key
  expects immediate effect — across web, CLI, MCP, and any agent
  with the credential. Anything less and the feature has lied.
- **Consequence in code:** Token/key validation hits the auth
  service on every request (or against a sub-second-stale cache);
  revoked credentials return a clear, recoverable error
  (`GLOBAL-012`). Surfaces show a banner / message naming the
  revocation. Tests cover "revoke from web → CLI 401 on next call."
- **Alternatives rejected:**
  - Long-lived JWTs with no revocation list — revocation becomes a
    lie.
  - Soft revocation (mark, sweep later) — same problem, slower.

## GLOBAL-019 — Free + Open Source core (Apache-2.0); Cloud is convenience, not a moat

- **Decision:** The core engine, CLI, MCP, SDKs, elements, and
  reference implementations are Apache-2.0 licensed. The hosted
  Cloud offering exists for convenience (zero-config, managed) — it
  is not a moat. Anyone can self-host.
- **Core value:** Free, Open source
- **Why:** "Open core" with a closed Cloud-only feature set destroys
  trust and limits the contributor base. The OSS-first stance is the
  reason the developer audience picks us; if Cloud were the moat we'd
  be a different product. Cloud earns its keep by being effortless,
  not by being the only option.
- **Consequence in code:** No Cloud-only features in the critical
  path. Every API the Cloud uses is documented and reachable from a
  self-host. License headers stay Apache-2.0. PRs that introduce
  hard Cloud-only paths require explicit re-architecture to keep the
  self-host viable.
- **Alternatives rejected:**
  - Open-core with proprietary advanced features — fragments the
    audience and shrinks the contributor pool.
  - AGPL — incompatible with the embedded-SDK story.

## GLOBAL-020 — No "pick a region", no config files in the first 60s

- **Decision:** First-time use — `npx nlq ask`, opening the web app,
  installing the MCP — completes without any config file, region
  picker, project ID, or environment variable. The path to first
  value is conversational and zero-config.
- **Core value:** Effortless UX, Free, Goal-first
- **Why:** Every required input before first value drops the funnel.
  Users who pick a region are already deciding to commit; we want
  them to decide *after* they've seen value, not before. Defaults
  are good, asked-for defaults are bad.
- **Consequence in code:** CLI's first invocation works against a
  default anonymous device on a default region. Web app boots
  against a demo dataset. MCP install does host detection
  (`packages/mcp/install.ts`) — no JSON the user has to write. Any
  PR that adds a required input to first-touch is rejected.
- **Alternatives rejected:**
  - "Sensible-default config file generated on first run" — still a
    file, still confusing, drifts from the docs.
  - Region picker on signup — half our funnel can't answer it.
