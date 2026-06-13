# SK-QUAL-014 — A scored `no_sql` row records the HTTP status of each failed leg, not just the failure class

Parent feature: [`quality-eval/FEATURE.md`](../FEATURE.md). Parent decisions:
[`SK-QUAL-013`](./SK-QUAL-013-capacity-honest-budget-stop.md) (the
capacity-vs-failure split this makes diagnosable),
[`SK-LLM-030`](../../llm-router/decisions/SK-LLM-030-rate-limit-aware-failover.md)
(the `FailoverReason` classes the runner persists).

- **Decision:** When a question scores `no_sql` because the whole chain threw
  `AllProvidersFailedError`, the runner persists the per-attempt summary
  **rebuilt from `err.attempts` with each `ProviderError`'s HTTP status
  appended** — `gemini:http_4xx(403)`, not the error's own `gemini:http_4xx`
  message. `tools/eval/src/runner.ts::describeChainFailure` does it; the
  no-status legs (`circuit_open`, `network`) render class-only. Eval-harness
  only — production's user-facing one-sentence error
  ([`GLOBAL-012`](../../decisions/GLOBAL-012-one-sentence-errors.md)) is
  untouched.

- **Core value:** Bullet-proof

- **Why:** The `no_sql` `error` string is the only persisted artifact a
  follow-up run has to diagnose *why* a leg failed, and
  `AllProvidersFailedError.message` lists only `provider:reason`. That class
  conflates the three 4xx causes that need opposite fixes: a `429`
  (quota — wait/raise the cap), a `403` (key/project denied — a config bug,
  excluded from the breaker per `isAuthFailure`), and a `400`
  (bad request — an engine/prompt bug). Spider's 36 `gemini:http_4xx`
  `no_sql` rows (2026-06-12 run) were stuck unbucketable for exactly this
  reason — the "oversized-DDL" read was falsified offline, but the real
  cause sits behind a status code the runner threw away. `ProviderError`
  already carries `.status`; surfacing it is one map.

- **Consequence in code:** `tools/eval/src/runner.ts` —
  `describeChainFailure` (exported via `_testing`) replaces `trimErr` at the
  `no_sql` site; capped at `ERROR_MSG_CAP` (240) like every other `error`.
  Test in `tools/eval/test/resume.test.ts`. No report-schema change (the
  `error` field already exists), so prior baselines stay valid.

- **Alternatives rejected:**
  - **Persist every attempt's full response body.** Blows the 240-char cap
    and re-surfaces the PII the provider already redacts once; the status
    code is the discriminator the buckets need.
  - **Change `AllProvidersFailedError.message` in `packages/llm`.** That
    string is a production error surface (`GLOBAL-012`); widening it for an
    eval-only need couples the two. The runner owns its own persisted detail.
  - **Re-run Spider and read the live spans.** The spans already carry the
    status, but a re-run burns quota for data the next routine run records
    for free once the persisted string carries it.
