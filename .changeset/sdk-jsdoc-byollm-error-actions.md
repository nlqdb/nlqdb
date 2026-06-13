---
"@nlqdb/sdk": patch
---

Document the full public surface and make BYOLLM validation errors actionable.

- Every `NlqClient` method, `createClient`, and `NlqdbApiError` now carry JSDoc
  (endpoint summary, response discriminator, retry/idempotency behaviour, key
  error codes, and auth requirements) so it surfaces in IDE hover and to coding
  agents.
- `byollm` construction errors now name the next action (e.g. "…must not
  contain control characters — re-paste the key without hidden CR/LF
  characters.") per GLOBAL-012.
- README clarifies the `err.code` vs `err.message` discipline: branch on
  `err.code`, treat `err.message` as debug text.

No behaviour change beyond the validation message text.
