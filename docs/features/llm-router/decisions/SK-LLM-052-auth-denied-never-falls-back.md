# SK-LLM-052 — A paid lane's `auth_denied` fails loud; it never silently serves the free chain

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Narrows
[`SK-PREMIUM-020`](../../premium-tier/decisions/SK-PREMIUM-020-dispatch-fallback.md)'s
lane fallback.

- **Decision:** `withFallbackRouter` re-throws when the premium lane fails with
  `auth_denied`, instead of answering from the free chain. The BYOLLM lane
  already has no fallback by construction (`SK-LLM-016`). Either way, the failure
  is **named in the response** as `llm_failed × auth_denied × <lane>`
  (`SK-LLM-051`), never absorbed.
- **Core value:** Bullet-proof, Honest latency
- **Why:** `SK-PREMIUM-020` exists for a specific fault: an AI-Gateway outage that
  takes the gateway-only premium lane down while the free chain's direct tail
  (`SK-LLM-047`) survives. Serving the free chain there is right — the user gets
  their answer and it is unmetered. A **credential** denial is a different animal:
  it means the paid lane is dead until a human fixes it, and papering over it with
  a working-looking free answer means nobody learns that — not the user who is
  paying, and not us. The fallback would fire on every subsequent request too, so
  the outage could run indefinitely behind green responses. `GLOBAL-023` and
  `SK-LLM-016` both say the same thing from different directions: degrade if you
  must, but never silently.
- **Consequence in code:** `isAuthDenied` inspects `ProviderError.reason` and
  `AllProvidersFailedError.attempts` and is checked in the same guard as the
  caller-abort re-throw. The resulting `llm_failed` is a 503 with
  `recoverability: "operator"` on a platform lane and a 409 with
  `user_config` on the user's own key — so the CLI and the SDK stop retrying it,
  and the copy points at the key rather than at the goal.
- **Alternatives rejected:**
  - **Fall back but stamp the span.** What shipped before, and the 2026-08-17
    incident is the proof it isn't enough: nobody reads a span attribute on a
    request that returned 200.
  - **Fall back and mark the trace.** Better, but a paid user seeing a normal
    answer has no reason to open the trace; the failure has to be the response.
  - **Disable the premium lane after N denials.** A useful future guard, but it
    doesn't answer what *this* request should say, which is the decision here.
