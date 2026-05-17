#!/usr/bin/env bash
# Persona: P6 — Analytics / Observability Engineer running pipelines
# with no SDK, no CLI, just curl. Verifies the three curl recipes in
# examples/curl/README.md against a live staging URL.
#
# Live-mode only: requires NLQDB_API_URL + NLQDB_API_KEY env vars.
# (`gh workflow run e2e-examples.yml` sets both for
# surface=all; surface=examples on its own deploys staging too.)
#
# Behaviour without the env vars: skip cleanly with exit 0 so the
# dispatcher's `examples` surface can include this script in its
# matrix unconditionally.

set -euo pipefail

if [[ -z "${NLQDB_API_URL:-}" || -z "${NLQDB_API_KEY:-}" ]]; then
  echo "SKIP examples/curl/e2e/smoke.sh — NLQDB_API_URL + NLQDB_API_KEY not set (hermetic mode)"
  exit 0
fi

# Trim any trailing slash on the base URL so the path joins cleanly.
BASE_URL="${NLQDB_API_URL%/}"

echo "→ Read path: POST /v1/ask without Idempotency-Key (reads don't need it)"
read_body=$(curl --fail --silent --show-error \
  -H "Authorization: Bearer ${NLQDB_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"goal": "an orders tracker", "ask": "how many orders today"}' \
  "${BASE_URL}/v1/ask")
echo "${read_body}" | grep -q '"trace"' || {
  echo "FAIL: read path response missing trace block — GLOBAL-023 violation"
  exit 1
}
echo "  ✓ trace block present"

echo "→ Write path: POST /v1/ask with Idempotency-Key (mutations require it, GLOBAL-005)"
idem_key=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid)
write_body=$(curl --fail --silent --show-error \
  -H "Authorization: Bearer ${NLQDB_API_KEY}" \
  -H "Idempotency-Key: ${idem_key}" \
  -H "Content-Type: application/json" \
  -d '{"goal": "an orders tracker", "ask": "add an order: alice, latte, 5.50"}' \
  "${BASE_URL}/v1/ask")
echo "${write_body}" | grep -q '"trace"' || {
  echo "FAIL: write path response missing trace block"
  exit 1
}
echo "  ✓ trace block present + Idempotency-Key accepted"

echo "→ Anonymous path: POST /v1/ask with no Authorization header (GLOBAL-007)"
anon_body=$(curl --fail --silent --show-error \
  -H "Content-Type: application/json" \
  -d '{"goal": "an orders tracker", "ask": "how many orders today"}' \
  "${BASE_URL}/v1/ask")
echo "${anon_body}" | grep -q 'anonymous_token\|"trace"' || {
  echo "FAIL: anon path didn't surface an anonymous_token or trace"
  exit 1
}
echo "  ✓ anonymous mode reachable"

echo "ALL OK — examples/curl/README.md three recipes verified against ${BASE_URL}"
