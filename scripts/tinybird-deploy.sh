#!/usr/bin/env bash
# Deploy the checked-in Tinybird Forward project (infrastructure/tinybird)
# to Tinybird Cloud: provisions / evolves the Data Sources defined by the
# datafiles in datasources/*.datasource (SK-EVENTS-009).
#
# This workspace runs Tinybird Forward — Data Sources can ONLY be created
# or altered through a deployment, never the classic /v0/datasources API.
# Run this once per fresh workspace BEFORE the events-worker's
# TINYBIRD_TOKEN secret is flipped on, or the query_log sink ack-and-drops
# every ask.completed row (SK-EVENTS-005).
#
# Requires the workspace admin token (DATASOURCES:CREATE) — NOT the
# DATASOURCE:APPEND token the worker runs with:
#   TINYBIRD_TOKEN     — admin token (required)
#   TINYBIRD_API_BASE  — regional API host (optional; EU gateway default)
#
# Pass --check for a dry-run validation that applies nothing.
set -euo pipefail

: "${TINYBIRD_TOKEN:?set TINYBIRD_TOKEN (workspace admin token)}"
HOST="${TINYBIRD_API_BASE:-https://api.tinybird.co}"
PROJECT="$(cd "$(dirname "$0")/.." && pwd)/infrastructure/tinybird"

if ! command -v tb >/dev/null 2>&1; then
  curl -sS https://tinybird.co | sh
  export PATH="$HOME/.local/bin:$PATH"
fi

# Default to a fully non-interactive promote; callers can override (e.g.
# `tinybird-deploy.sh --check`). `yes` answers the untracked-folder prompt
# (the git root is the repo, not the project subdir).
args=("$@")
if [ ${#args[@]} -eq 0 ]; then
  args=(--wait --auto)
fi

cd "$PROJECT"
yes | tb --cloud --host "$HOST" --token "$TINYBIRD_TOKEN" deploy "${args[@]}"
