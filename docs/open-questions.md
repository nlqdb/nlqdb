# Open questions — human action queue

> The single file the founder reads. Only items that genuinely need a human: actions a human must take, or decisions an agent could not make even after web-research + consulting the codebase's core values. Keep each a very short bullet. Delete a bullet once resolved.

## Blocking for human

- (#300) After `deploy-web.yml` ships `apps/web/dist`, run `bash scripts/verify-flows.sh` against `https://nlqdb.com` to confirm `/vs/askyourdatabase/` resolves (pre-deploy it returns the 4 expected 404/floor failures). Post-deploy = inherently after-merge; not a CI gate.
- (#300) `apps/api smoke` CI job is red due to the Neon Free-plan 10-branch quota (HTTP 422 on branch create), not PR content. Prune stale closed-PR Neon branches (`pr-125`, `pr-197`, `pr-208`) so the smoke job can go green; this needs operator access to the Neon project.
- (#296) Confirm prod `events-worker` has `TINYBIRD_TOKEN` set with `DATASOURCE:APPEND` scope and the `query_log` Data Source is live (`scripts/tinybird-deploy.sh`) — PR claims both done/verified, but an agent can't check prod secrets; without them the `ask.completed` sink ack-and-drops every row (SK-EVENTS-009 / SK-EVENTS-005).
