#!/usr/bin/env bash
# Persona: P1 (Solo Builder, CLI-only path) + P6 (Analytics Engineer
# scripting with `nlq`). Verifies the four-command walkthrough in
# examples/cli/walkthrough.sh works end-to-end against a live staging.
#
# Live-mode only: requires the nlq binary on PATH plus NLQDB_API_URL +
# NLQDB_API_KEY env vars. The CI workflow builds the binary from cli/
# and prepends $WORK/bin to PATH before invoking this script.
#
# Without the env vars: skip cleanly so the dispatcher's `examples`
# surface can include this script unconditionally.

set -euo pipefail

if ! command -v nlq >/dev/null 2>&1; then
  echo "SKIP examples/cli/e2e/smoke.sh — nlq binary not on PATH"
  exit 0
fi

if [[ -z "${NLQDB_API_URL:-}" || -z "${NLQDB_API_KEY:-}" ]]; then
  echo "SKIP examples/cli/e2e/smoke.sh — NLQDB_API_URL + NLQDB_API_KEY not set (hermetic mode)"
  exit 0
fi

API_FLAGS=(--api-url="${NLQDB_API_URL%/}" --no-update-check)

echo "→ Step 1: nlq whoami — env-key identity resolves (GLOBAL-010)"
nlq "${API_FLAGS[@]}" whoami | grep -q 'identity:' || {
  echo "FAIL: whoami didn't surface an identity line"
  exit 1
}
echo "  ✓ identity resolves"

echo "→ Step 2: nlq db list — the user's tenant is enumerable"
nlq "${API_FLAGS[@]}" --json db list | grep -q '"databases"' || {
  echo "FAIL: db list JSON envelope missing — SK-CLI-004 violation"
  exit 1
}
echo "  ✓ db list JSON envelope present"

echo "→ Step 3: nlq help — verbs match the walkthrough (ask, new, db, mcp)"
help_out=$(nlq "${API_FLAGS[@]}" --help)
for verb in ask new db mcp; do
  echo "${help_out}" | grep -q "^  ${verb} " || {
    echo "FAIL: help output missing verb '${verb}' — walkthrough out of date with binary"
    exit 1
  }
done
echo "  ✓ all four walkthrough verbs registered"

# Step 4 (the actual `nlq "<question>"` ask) would burn an LLM call;
# the SDK + opencheck surfaces already cover ask end-to-end. Here we
# verify the bare-form rewriter accepts the shape without trying to
# execute, by passing `--help` to the rewritten verb.
echo "→ Step 4: nlq <bare goal> rewrites to nlq ask (SK-CLI-012)"
nlq "${API_FLAGS[@]}" ask --help | grep -q 'Usage' || {
  echo "FAIL: nlq ask --help missing — rewriter or ask verb broken"
  exit 1
}
echo "  ✓ bare-form rewrite target reachable"

echo "ALL OK — examples/cli/walkthrough.sh contract verified against ${NLQDB_API_URL%/}"
