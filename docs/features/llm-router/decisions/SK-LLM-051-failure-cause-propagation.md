# SK-LLM-051 — A planning failure carries its bounded cause: reason, lane, provider, model

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md).

- **Decision:** `llm_failed` carries
  `{ reason: FailoverReason, lane: "free"|"byollm"|"premium"|"frontier", provider?, model? }`.
  `apps/api/src/ask/llm-cause.ts` reads the cause the router already computed —
  `AllProvidersFailedError.attempts` for a chain, `ProviderError.reason` for a
  single-provider lane, `NoConfiguredProvidersError` as `not_configured` — and
  `resolveAskRouter` returns the lane descriptor alongside the router.
  **Bounded values only:** the enum, an AI-Gateway upstream slug, and the model
  id the user pinned. Raw provider messages never cross the boundary.
- **Core value:** Bullet-proof, Effortless UX
- **Why:** The cause existed at the throw site and was thrown away one frame
  later. Production, 2026-08-17: a BYOLLM model `luna` with a fake API key
  returned a provider 401; the router typed it `auth_denied` (`SK-LLM-039`);
  `orchestrate.ts` returned bare `{status:"llm_failed"}`; the user read
  *"Couldn't generate a plan — try rephrasing."* Rephrasing cannot fix a rejected
  key, and nothing in the response pointed at the key. With the cause attached,
  the same failure renders *"Your openrouter API key was rejected — check the key
  at …/app/keys, or switch the model back to auto."*
  The lane is what makes the copy correct rather than merely specific: an
  `auth_denied` on the user's own key is theirs to fix (`user_config`, 409, not
  retryable); the same reason on a platform lane is ours (`operator`, 503). And a
  free-chain exhaustion must never say "rephrase" — it is not a goal problem, so
  it renders *"The planning models are unavailable right now — try again in a
  minute."*
  When a chain exhausts with mixed reasons, `auth_denied` / `not_configured` win
  over transient ones: if any leg is locked out, "try again in a minute" is a lie
  the user acts on for free.
- **Consequence in code:** `OrchestrateDeps.lane` is optional, so tests and
  internal callers stay lane-agnostic and the copy falls back to the neutral
  branch. Copy for every `(lane, reason)` combination lives in the
  `@nlqdb/errors` registry (`SK-ERR-001`) and is asserted there, including a test
  that the 2026-08-17 shape never says "rephrase". Full provider detail stays on
  the `llm.plan` span (`SK-LLM-006`) exactly as before.
- **Alternatives rejected:**
  - **Pass the provider's error message through.** It can contain the API key
    itself or prompt fragments — the reason the original security comment in
    `orchestrate.ts` discarded everything.
  - **A separate error code per cause (`llm_auth_denied`, …).** Multiplies the
    code set by the lane count for no gain; params are exactly the axis that
    varies.
  - **Infer the cause on the surface from the HTTP status.** 502 cannot
    distinguish a dead key from a provider blip — which is precisely how the
    incident's three wasted client retries happened.
