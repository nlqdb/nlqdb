# SK-LLM-020 — BYOLLM dispatch resolver: pure precedence core, no-fallback chain, fail-loud on a present key

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Implements the
**precedence half** of
[`SK-LLM-016`](./SK-LLM-016-byollm-dispatch.md) (the dispatch-lane
decision), the way [`SK-LLM-019`](./SK-LLM-019-byollm-provider-factory.md)
implemented the provider half. Parent GLOBAL:
[`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md).

- **Decision:** `resolveByollmDispatch`
  (`packages/llm/src/byollm-dispatch.ts`) is a **pure** function that
  takes already-resolved credentials (`override`, `stored`),
  `premiumAvailable`, the gateway coordinates and the userId, and
  returns the chosen lane per `SK-LLM-016`'s precedence — `byollm`
  (with a built `Provider` and the winning `source`), `premium`, or
  `free`. Two shapes are pinned here:
  - **Fail-loud on a present key.** A present BYOLLM credential commits
    to the `byollm` lane. The provider is built eagerly, so a
    structurally-invalid credential throws at construction
    ([`GLOBAL-012`](../../../decisions/GLOBAL-012-one-sentence-errors.md))
    — it is **never** silently demoted to premium/free. `??` (not `||`)
    selects the override so a credential object is never skipped;
    emptiness is the factory's fail-loud concern.
  - **No-fallback chains.** `byollmChains()` returns single-entry
    `["byollm"]` chains for every operation, so the router structurally
    cannot fall through from a failing BYOLLM key to a free provider.
    This makes the "no silent fallback" guarantee a property of the
    chain shape, not of caller discipline.
- **Core value:** Free, Bullet-proof, Effortless UX
- **Why:** The precedence + fail-loud rule is the one
  correctness-critical decision in the BYOLLM feature, and it is pure
  logic — no DB, no header parsing, no KEK, no network. Landing it as a
  standalone unit-tested function (mirroring the `SK-LLM-019` split)
  keeps the surface-bearing slice — header parse, KEK decryption,
  middleware, OTel stamping, all surfaces — free to wire the I/O around
  a core whose behaviour is already proven. Web research confirms the
  shape: the 2026 BYOK best practice (OpenRouter `"only"`, Cloudflare
  pinned key) is "pin one provider, no fallback, fail loud", and the
  rejected anti-pattern is Vercel-style silent fall-through to system
  credentials — exactly `SK-LLM-016`'s rejected alternative.
- **Consequence in code:**
  - `packages/llm/src/byollm-dispatch.ts` — `resolveByollmDispatch`,
    `byollmChains`, and the `ByollmCredential` / `ByollmDispatchInput` /
    `ByollmDispatchResult` / `DispatchLane` types (new).
  - `packages/llm/src/index.ts` — exports the above.
- **Gap (per [`GLOBAL-003`](../../../decisions/GLOBAL-003-all-surfaces-one-pr.md)):**
  Like `SK-LLM-019`, this slice adds no user-callable capability. The
  surface — the `x-nlq-byollm-key` header parse, the
  `api_keys.scope = "byollm"` KEK-encrypted storage + decryption, the
  lane-select middleware that calls `resolveByollmDispatch` and stamps
  `llm.dispatch_lane` / `llm.billed_to` / `llm.byollm_provider`, and
  SDK / CLI / MCP / elements parity — is the **dispatch-wiring** slice
  still tracked in [`SK-LLM-016`](./SK-LLM-016-byollm-dispatch.md)
  *Consequence in code*. `GLOBAL-003` parity is deferred to that PR,
  not violated here.
- **Alternatives rejected:**
  - **Resolve credentials (DB + KEK + header) inside this function.**
    Couples the pure precedence logic to D1, the Workers KEK Secret and
    HTTP header shapes, so it can no longer be unit-tested without
    mocking three I/O layers. The resolver takes resolved credentials;
    the wiring slice owns the I/O.
  - **Add `LLMRouterOptions.dispatchLane`.** `SK-LLM-016` floated a
    lane field on router options, but the router never reads it — the
    lane selects *which* provider list + chain the router is built
    with. A field the router ignores is dead code (`P5`); the resolver
    returns the lane label for the middleware to stamp instead.
  - **Let the wiring slice assemble the byollm chains by hand.** Leaves
    the no-fallback guarantee to caller discipline — one stray
    `[...byollmChain, "openrouter"]` reintroduces the silent fallback.
    `byollmChains()` makes it structural.
  - **Fall through to the next lane on a broken key.** The rejected
    dark pattern from `SK-LLM-016` / `GLOBAL-012`.
