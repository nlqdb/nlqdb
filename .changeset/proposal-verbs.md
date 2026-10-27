---
"@nlqdb/sdk": minor
---

`client.applyProposal(id)` and `client.rejectProposal(id, { reason })` decide a proposal `attach()` returned (`POST /v1/proposals/:id/apply|reject`). Each resolves with who decided it and when; repeating the same verb replays it. New error codes: `proposal_not_found`, `proposal_decided`, `apply_failed`. `listChanges` rows can now be `rejected`.
