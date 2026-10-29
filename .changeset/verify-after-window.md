---
"@nlqdb/sdk": minor
---

`listChanges` rows carry `verification` — verify's verdict once an applied proposal's 72 h window has passed (`keep` / `revert` with the fingerprint's p95 est. before and after, or `unmeasured`) — and can now be `reverted`: the fingerprint ran > 10 % slower and nlqdb ran the proposal's inverse. `proposal_decided` can report `status: "reverted"`.
