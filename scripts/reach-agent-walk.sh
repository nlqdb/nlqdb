#!/usr/bin/env bash
# nlqdb — R-06 coding-agent walker (reach track measurement backbone).
#
# Drops a cold Claude Code session into a scratch agent-app fixture with the
# prompt a builder hands their coding agent at pivot stage 0/1 — "add
# persistent per-user memory to this app, web-search for the best option" —
# and grades whether the agent surfaces nlqdb, reaches the one-command MCP
# setup string, and (blocked by the SK-PIVOT-010 authed connect) completes a
# first read/write. Measures the falsifiable claim the whole reach track makes.
#
# Non-deterministic by design (live web search); the JSON outcome records what
# happened this walk, not a pass/fail gate. Needs the `claude` CLI on PATH with
# working credentials; a cold session is one nested agent run (~1-4 min).
#
# Usage:
#   bash scripts/reach-agent-walk.sh
#   REACH_AGENT_MODEL=claude-sonnet-5 bash scripts/reach-agent-walk.sh
#   REACH_AGENT_OUT=tools/stranger-test/results/reach-agent-cron.json \
#     bash scripts/reach-agent-walk.sh
#
# Side effects: spawns one nested `claude -p` session in a temp dir (no repo
# mutation — read-only + web tools only); writes one JSON artifact. Exit 0 the
# walk produced a graded outcome · 2 the harness could not drive the session.

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

ARGS=()
if [[ -n "${REACH_AGENT_OUT:-}" ]]; then
  ARGS+=(--out "$REACH_AGENT_OUT")
fi
if [[ -n "${REACH_AGENT_MODEL:-}" ]]; then
  ARGS+=(--model "$REACH_AGENT_MODEL")
fi

exec bun tools/stranger-test/src/reach-agent-walk.ts "${ARGS[@]}"
