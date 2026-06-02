# Open questions — human action queue

> The single file the founder reads. Only items that genuinely need a human: actions a human must take, or decisions an agent could not make even after web-research + consulting the codebase's core values. Keep each a very short bullet. Delete a bullet once resolved.

## Blocking for human

- (#298) Bluesky source picked `api.bsky.app` because `public.api.bsky.app` 403'd from the agent VM (BunnyCDN block); confirm the chosen host actually reaches the AppView from the deployed CF Workers egress (one `wrangler dev` re-probe) — only verifiable from prod egress.
- (#298) Confirm the unauthenticated `api.bsky.app` AppView rate-limit posture holds for the weekly cron from production egress (docs say "generous, no-auth"; cron uses 5 calls/week) — liveness not re-verified from CF egress.
