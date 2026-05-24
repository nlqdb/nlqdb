#!/usr/bin/env bash
# nlqdb — agent-runnable §1.1 stranger-test from
# docs/research/automated-icp-validation-plan.md.
#
# What this is: a headless-Playwright cron-equivalent that walks the
# deployed FLOW-001 / FLOW-002 / FLOW-003 surfaces with seeded prompts
# rotated across personas, and emits one JSON file per run summarising
# pass/fail/blocked counts plus TTFV p50/p95.
#
# Usage:
#   bash scripts/stranger-test.sh                          # 3 prompts per flow
#   bash scripts/stranger-test.sh --prompts 5              # more breadth
#   bash scripts/stranger-test.sh --flows flow-001         # one flow only
#   NLQDB_BASE_URL=https://preview-xyz.nlqdb.com bash scripts/stranger-test.sh
#
# Exits non-zero if any walked run failed (or was blocked); cron-friendly.
# Output JSON is written to tools/stranger-test/results/walk-<utc>.json
# unless `--out <path>` overrides.

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

OUT_DEFAULT="tools/stranger-test/results/walk-$(date -u +%Y-%m-%dT%H-%M-%SZ).json"

HAS_OUT=0
for a in "$@"; do
  if [[ "$a" == "--out" || "$a" == --out=* ]]; then HAS_OUT=1; fi
done
if (( HAS_OUT == 1 )); then
  exec bun tools/stranger-test/src/runner.ts "$@"
else
  exec bun tools/stranger-test/src/runner.ts "$@" --out "$OUT_DEFAULT"
fi
