# Gemini free-tier key suspended by a billing leak (2026-06-15 → 06-17)

**Lesson:** "free models only" does **not** guarantee $0. Billing is a
*project-level* setting, so a Cloud Billing account linked to the key's
project bills **every** call — even free models — and Google suspends the
project when the bill goes unpaid. The leak is at the billing-account level,
not the model level, so "we only call `gemini-2.5-flash`" did not protect us.

## What happened

- The shared `GEMINI_API_KEY` project had a **Cloud Billing account linked**.
- A billed project's free allowance is zero (`generate_content_free_tier_requests: 0`),
  so every call billed at paid rates — even `gemini-2.5-flash`, the only model
  the chain calls.
- We **expected $0** (we only ever request "free" models per `GLOBAL-013`), so
  the charge went unnoticed.
- The bill went **unpaid** → Google **suspended the project** →
  `403 PERMISSION_DENIED "your project has been denied access"` on the whole
  gemini-2.5 family. That was the root of the 2026-06-12 Spider
  `gemini:http_4xx` losses and the whole-project denial `SK-LLM-039` parks on.

## Two error signatures, distinguished

- **`403 "project has been denied access"`** (2.5 family) — the suspension.
  The real block.
- **`429 limit: 0`** (`free_tier_requests`) on a *billed* project — the
  billed-project signature (free quota zeroed). A *billing-free* project can
  also show `limit: 0` on `gemini-2.0-flash` for a **separate** reason — that
  model has no free-tier allowance in our region — which is why the new
  (billing-free) key still 429s on 2.0-flash but serves 2.5-flash at 200.

## Fix + prevention

- **Fix:** rotate to a key in a project with **no billing account**. A
  billing-free project can never be charged or suspended — it rate-limits
  (`429`) at the free caps instead. Done 2026-06-17; `gemini-2.5-flash` → 200.
- **Prevention (canonical):** `GLOBAL-013` now requires free-tier provider keys
  to have **no billing account linked**. Verify in the Cloud Console (tracked
  in `blocked-by-human.md` until confirmed). **Never** "fix a denial by linking
  billing" — that both violates `GLOBAL-013` and would not fix a suspension
  (it is an authorization state, not a quota).
- **Watch:** the free key is hammered from CI (datacenter IPs) during evals;
  keep the eval throttle and never link billing to "raise limits".
- **Settled posture (2026-07-01):** always use a free-tier AI Studio key on a
  project with **no billing account** — we do not verify billing state as a
  human task, we simply never link it. Free-tier rate limits (`429`) are
  **expected** and handled by the cost-ordered chain: a 429 maps to
  `rate_limited` (`packages/llm/src/providers/_shared.ts`) and opens Gemini's
  breaker so the router fails over to the next provider (`router.ts` `SK-LLM-030`)
  — never a hard failure. Never link billing (a billed project bills even
  free-model calls, per the 2026-06-15 suspension above).

## References

- [`SK-LLM-039`](../features/llm-router/decisions/SK-LLM-039-auth-denied-reason.md)
  — `auth_denied` classification + provider park (made the denial legible + cheap).
- [`GLOBAL-013`](../decisions/GLOBAL-013-free-tier-bundle-budget.md) — $0 free
  tier; no billing account on free keys.
- [`quality-score-verification-log.md`](../progress/quality-score-verification-log.md)
  (2026-06-17) — the Spider re-run measuring the recovery (0.1704 → 0.1852).
