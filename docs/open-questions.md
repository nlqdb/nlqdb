# Open questions — human action queue

> The single file the founder reads. Only items that genuinely need a human: actions a human must take, or decisions an agent could not make even after web-research + consulting the codebase's core values. Keep each a very short bullet. Delete a bullet once resolved.

## Blocking for human

- (#297) Configure the `GROQ_API_KEY` repository secret (the app LLM key for the opencheck preview worker). Without it the `E2E (opencheck)` workflow still deploys but every `/v1/ask` + NL db-create call hangs (240s timeout). Set it in repo Settings → Secrets → Actions for the e2e web journey to pass.
