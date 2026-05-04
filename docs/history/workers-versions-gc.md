# Lessons Learnt — Preview Workers Versions garbage collection

`.github/workflows/preview-{api,web}.yml` uploads a new Workers Version per PR push (`wrangler versions upload`). Cloudflare does **not** TTL these — old versions persist indefinitely on the prod Worker. Active development on a multi-package monorepo accumulates hundreds of orphaned per-version preview URLs per Worker over the course of a year.

This file captures the cleanup procedure so we don't lose it. It is a **followup to ship in its own PR** — no upstream blocker, but the longer it's deferred, the more orphan versions there are to walk on the first run.

---

## Why we don't do it inline today

- The `wrangler` CLI does **not** expose a `versions delete` command (verified against `wrangler@latest` as of PR #81 / May 2026). Cleanup requires a direct call to the Cloudflare API.
- The `nlqdb-api` and `nlqdb-web` Workers each accumulate ~1 version per PR push. For an active branch with rebase-heavy review flow, that's 5–20 versions per merged PR.
- The orphan growth rate is sub-quadratic and we're nowhere near a hard Cloudflare limit, so the GC is operational hygiene, not a fire.

## Cleanup design (when we ship it)

Add a scheduled GitHub Actions workflow (`.github/workflows/cleanup-workers-versions.yml`, weekly cron) that, for each of `nlqdb-api` and `nlqdb-web`:

1. List all versions:
   ```bash
   wrangler versions list --name $WORKER_NAME --json
   ```
2. Filter to versions older than ~14 days **except** the version_id currently promoted to production (read from `wrangler deployments list` — the most recent `deployment` row's `version_id`).
3. Delete each filtered version:
   ```bash
   curl -X DELETE \
     -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
     "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${WORKER_NAME}/versions/${version_id}"
   ```

## Safeguards the workflow must enforce

- **Never delete the currently-promoted production version.** Read the `deployments list` first, capture the active `version_id`, exclude it from the delete loop. Reverse this and a routine cron run takes prod offline.
- **Dry-run mode.** `--dry-run` flag (default true on first deploys) prints the candidate delete list without calling DELETE. Flip to live only after one weekly run has been reviewed.
- **Per-PR pinning override.** Branches with an `experimental/` prefix or labelled `keep-preview` skip GC — long-running preview environments are a real use case (design partner walkthroughs).
- **Concurrency:** `concurrency: workers-versions-gc` so two scheduled runs can't race.
- **Failure handling:** continue-on-error per-version (a single 4xx from CF shouldn't abort the whole sweep). Aggregate failures into a single Slack ping; don't page.

## Required token scopes

`CLOUDFLARE_API_TOKEN` for the workflow needs:
- `Account → Workers Scripts → Edit` (covers `versions delete` via the API).
- `Account → Workers Scripts → Read` (for `versions list`).

These are already in the existing `CLOUDFLARE_API_TOKEN` scope used by deploy workflows (per `docs/history/infrastructure-setup.md §3`); no new token required.

## Source

Carried forward from pre-consolidation `docs/implementation.md §8 — Cross-phase, always-on` (deleted in PR #81 commit `fb6e8c9`). The original framing was "Followup (own PR, post-Phase-1)" — that hasn't changed; promote out of `history/` into a skill or runbook section once the cleanup workflow lands and we have operational signal on its behaviour.
