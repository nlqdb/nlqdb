# SK-LLM-020 — BYOLLM lane selector + single-provider lane router

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Implements the
**dispatch-decision half** of
[`SK-LLM-016`](./SK-LLM-016-byollm-dispatch.md) — the pure four-step lane
precedence and the router that runs the chosen BYOLLM lane. Builds on the
provider half, [`SK-LLM-019`](./SK-LLM-019-byollm-provider-factory.md).
Parent GLOBAL:
[`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md).

- **Decision:** `packages/llm/src/byollm-dispatch.ts` adds three pure,
  I/O-free primitives:
  - **`selectDispatchLane(inputs)`** — the single source of truth for
    `SK-LLM-016`'s precedence: per-request header key → account-stored
    key → premium-eligible → free. The caller resolves the credentials
    and premium eligibility and passes them in; this function only
    applies the ordering, returning a discriminated
    `{ lane: "byollm", credential, source } | { lane: "premium" } | { lane: "free" }`.
  - **`buildByollmRouter(opts)`** — wraps `createByollmProvider`
    (`SK-LLM-019`) in a single-provider `LLMRouter` whose every operation
    chains to just `["byollm"]`. **No failover to the free chain**:
    silently re-billing nlqdb and splitting telemetry is exactly what
    `SK-LLM-016` forbids, so a key failure surfaces as the router's
    `AllProvidersFailedError` for the caller to translate into a
    one-sentence error
    ([`GLOBAL-012`](../../../decisions/GLOBAL-012-one-sentence-errors.md)).
    No hedge — `SK-LLM-014` hedging is free-tier-only and there is a
    single provider.
  - **`dispatchLaneAttributes(sel)`** — bounded-cardinality span
    attributes for the chosen lane, value sets pinned by `GLOBAL-026`:
    `llm.dispatch_lane` (`free` / `byollm` / `premium`), `llm.billed_to`
    (`platform` / `byollm` / `metered`), and — byollm lane only —
    `llm.byollm_provider` (the AI Gateway upstream slug, ~5 values,
    **not** the model). The key value is never emitted. Catalogued in
    [`docs/performance.md §3.3`](../../../performance.md).
- **Core value:** Free, Bullet-proof, Effortless UX
- **Why:** The precedence ordering is the one piece of `SK-LLM-016` that
  must never drift between surfaces (HTTP / SDK / CLI / MCP / elements)
  — a header key silently losing to an account key, or a BYOLLM key
  silently falling through to the free chain, is a correctness/trust bug.
  Landing it as a pure function makes it unit-testable in isolation and
  the canonical reference every surface calls, so the apps/api
  dispatch-wiring PR only has to resolve credentials and call it. Keeping
  the package free of header/DB/KEK access preserves
  [`SK-LLM-002`](./SK-LLM-002-single-adapter.md)'s clean adapter boundary.
- **Consequence in code:**
  - `packages/llm/src/byollm-dispatch.ts` — the three primitives (new).
  - `packages/llm/src/index.ts` — exports them + their types.
  - `docs/performance.md §3.3` — three span-only attributes added to the
    cardinality catalog.
- **Gap (per `GLOBAL-003`):** No user-callable capability is added — this
  is internal router plumbing, like `SK-LLM-019`. Credential resolution
  (`x-nlq-byollm-key` header, decrypting `api_keys.scope="byollm"`),
  premium-eligibility computation, the lane-select middleware, and SDK /
  CLI / MCP / elements parity remain the **dispatch-wiring** slice tracked
  in [`SK-LLM-016`](./SK-LLM-016-byollm-dispatch.md) *Consequence in code*.
  `GLOBAL-003` parity is deferred to that PR, not violated here.
- **Alternatives rejected:**
  - **Resolve credentials inside this package.** Needs DB + KEK access;
    couples `@nlqdb/llm` to the API runtime and `api_keys` schema, and
    breaks the pure-adapter boundary. The caller resolves; this selects.
  - **Failover from the BYOLLM lane to the free chain on key error.**
    Silent re-billing + split telemetry — the dark pattern `SK-LLM-016`
    rejects. Fail loud instead.
  - **Inline the precedence in the apps/api middleware.** Would let the
    ordering drift per surface and can't be unit-tested without booting
    the Worker. A pure exported function is the testable single source.
  - **Emit the model on `llm.byollm_provider`.** Unbounded cardinality;
    the model already rides `llm.model` per `SK-LLM-019`. The upstream
    slug is the bounded label.
