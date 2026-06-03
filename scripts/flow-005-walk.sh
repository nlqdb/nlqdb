#!/usr/bin/env bash
# nlqdb — agent-runnable FLOW-005 MCP discovery + auth-wall walker
# (FLOW-005 in docs/research/automated-icp-validation-plan-verification.md).
#
# Walks the SK-MCP-* protected-resource handshake to the maximum depth
# that needs zero credentials — the only steps every MCP client (Claude
# Desktop, Cursor, Cline, ChatGPT desktop, the MCP inspector) hits
# *before* it asks the user for an `sk_mcp_*` key:
#
#   1. GET /.well-known/oauth-protected-resource (RFC 9728 root variant)
#      — 200, `resource` advertises the canonical MCP URL.
#   2. GET /.well-known/oauth-protected-resource/mcp (RFC 9728 resource-
#      scoped variant) — 200, `resource` carries the /mcp path suffix.
#   3. GET /.well-known/oauth-authorization-server (RFC 8414) — 200,
#      `issuer` + `authorization_endpoint` + `token_endpoint` all present.
#   4. POST /mcp `initialize` JSON-RPC without auth → 401 with a
#      `WWW-Authenticate: Bearer realm=*, resource_metadata=*, error="invalid_token"`
#      challenge. The `resource_metadata` URL must match step 2.
#   5. POST /mcp `tools/list` JSON-RPC without auth → 401 with the same
#      challenge shape (proves the wall isn't method-specific).
#
# Steps 1-3 are the precondition of the inspector handshake in the
# verification mirror's walkthrough step 1; steps 4-5 prove the
# auth-wall is intact AND that the RFC 9728 challenge carries enough
# metadata for an unconfigured MCP client to begin OAuth discovery.
# A regression in any of these breaks every MCP client silently.
#
# Steps 6+ of the FLOW-005 walkthrough (tools/list with a valid bearer,
# create_database, ask, run) still require an `sk_mcp_*` key — they
# stay in the verification mirror for the credentialed walk.
#
# Why this is a real e2e walker and not just discovery:
#   the control+wall pair makes it a regression detector. If the auth
#   wall ever returns anything other than 401-with-challenge (e.g. 200
#   on an unauthenticated `tools/list`, or 401 without the RFC 9728
#   `resource_metadata` field), the walker fails loudly — even if the
#   discovery endpoints still 200.
#
# Usage:
#   bash scripts/flow-005-walk.sh
#   NLQDB_MCP_URL=https://mcp.preview.nlqdb.com bash scripts/flow-005-walk.sh
#   FLOW_005_OUT=tools/stranger-test/results/flow-005-cron.json \
#     bash scripts/flow-005-walk.sh
#
# Side effects: none. Five HTTP requests, no state, no credentials.
#
# Exit codes:
#   0  passed (every assertion green)
#   1  failed at a definite step (state in JSON)
#   2  prereq missing (missing curl / jq)
#   3  blocked upstream (transport / DNS / TLS)

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

MCP_URL="${NLQDB_MCP_URL:-https://mcp.nlqdb.com}"
TIMEOUT_S="${FLOW_005_TIMEOUT_S:-15}"
UTC_STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
OUT_PATH="${FLOW_005_OUT:-tools/stranger-test/results/flow-005-$UTC_STAMP.json}"

# --- display helpers (mirror scripts/flow-004-walk.sh) --------------------

say()  { printf '\n\033[1;34m== %s ==\033[0m\n' "$*"; }
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
fail() { printf '  \033[1;31m✗\033[0m %s  — %s\n' "$1" "$2"; }

# Writes a single outcome JSON line. Uniform shape across success/failure
# so the daily acquisition-health.yml summary can read `.state` without
# care for which step bailed out.
write_outcome() {
  local state="$1" notes="$2"
  jq -nc \
    --arg utc "$UTC_STAMP" \
    --arg state "$state" \
    --arg base "$MCP_URL" \
    --arg notes "$notes" \
    --argjson total_wall_s "${TOTAL_WALL_S:-0}" \
    --argjson checks_passed "${CHECKS_PASSED:-0}" \
    --argjson checks_failed "${CHECKS_FAILED:-0}" \
    --arg discovery_ok "${DISCOVERY_OK:-false}" \
    --arg auth_wall_ok "${AUTH_WALL_OK:-false}" \
    --arg challenge_url_matches "${CHALLENGE_URL_MATCHES:-false}" \
    '{utc:$utc, flow:"FLOW-005", base_url:$base,
      state:$state, total_wall_s:$total_wall_s,
      checks_passed:$checks_passed, checks_failed:$checks_failed,
      discovery_ok:($discovery_ok=="true"),
      auth_wall_ok:($auth_wall_ok=="true"),
      challenge_url_matches:($challenge_url_matches=="true"),
      notes:$notes}' \
    > "$OUT_PATH"
}

# --- prerequisite check ---------------------------------------------------

for cmd in curl jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "prereq" "missing '$cmd' — install before running"
    exit 2
  fi
done

mkdir -p "$(dirname "$OUT_PATH")"

T_START=$(date +%s)
CHECKS_PASSED=0
CHECKS_FAILED=0
DISCOVERY_OK="false"
AUTH_WALL_OK="false"
CHALLENGE_URL_MATCHES="false"
EXPECTED_CHALLENGE_URL="$MCP_URL/.well-known/oauth-protected-resource/mcp"
DISCOVERY_PASS_COUNT=0
WALL_PASS_COUNT=0

assert_pass() { CHECKS_PASSED=$((CHECKS_PASSED + 1)); ok "$1"; }
assert_fail() { CHECKS_FAILED=$((CHECKS_FAILED + 1)); fail "$1" "$2"; }

# --- step 1: RFC 9728 protected-resource (root) ---------------------------

say "FLOW-005 step 1 — GET $MCP_URL/.well-known/oauth-protected-resource"
PR_TMP="$(mktemp -t nlqdb-flow-005.XXXXXX)"
PR_STATUS="$(curl -sS --max-time "$TIMEOUT_S" -o "$PR_TMP" -w '%{http_code}' \
  -H "Accept: application/json" \
  "$MCP_URL/.well-known/oauth-protected-resource" 2>/dev/null || true)"
if [[ "$PR_STATUS" == "200" ]] && jq -e '.resource' "$PR_TMP" >/dev/null 2>&1; then
  PR_RESOURCE="$(jq -r '.resource' "$PR_TMP")"
  if [[ "$PR_RESOURCE" == "$MCP_URL" ]]; then
    assert_pass "RFC 9728 root resource-metadata advertises resource=$MCP_URL"
    DISCOVERY_PASS_COUNT=$((DISCOVERY_PASS_COUNT + 1))
  else
    assert_fail "RFC 9728 root resource-metadata" "resource=$PR_RESOURCE (expected $MCP_URL)"
  fi
else
  assert_fail "RFC 9728 root resource-metadata" "HTTP $PR_STATUS or missing 'resource' field"
fi
rm -f "$PR_TMP"

# --- step 2: RFC 9728 protected-resource (scoped /mcp variant) ------------

say "FLOW-005 step 2 — GET $EXPECTED_CHALLENGE_URL (resource-scoped variant)"
SCOPED_TMP="$(mktemp -t nlqdb-flow-005.XXXXXX)"
SCOPED_STATUS="$(curl -sS --max-time "$TIMEOUT_S" -o "$SCOPED_TMP" -w '%{http_code}' \
  -H "Accept: application/json" \
  "$EXPECTED_CHALLENGE_URL" 2>/dev/null || true)"
if [[ "$SCOPED_STATUS" == "200" ]] && jq -e '.resource' "$SCOPED_TMP" >/dev/null 2>&1; then
  SCOPED_RESOURCE="$(jq -r '.resource' "$SCOPED_TMP")"
  if [[ "$SCOPED_RESOURCE" == "$MCP_URL/mcp" ]]; then
    assert_pass "RFC 9728 scoped resource-metadata advertises resource=$MCP_URL/mcp"
    DISCOVERY_PASS_COUNT=$((DISCOVERY_PASS_COUNT + 1))
  else
    assert_fail "RFC 9728 scoped resource-metadata" "resource=$SCOPED_RESOURCE (expected $MCP_URL/mcp)"
  fi
else
  assert_fail "RFC 9728 scoped resource-metadata" "HTTP $SCOPED_STATUS or missing 'resource' field"
fi
rm -f "$SCOPED_TMP"

# --- step 3: RFC 8414 authorization-server metadata -----------------------

say "FLOW-005 step 3 — GET $MCP_URL/.well-known/oauth-authorization-server"
AS_TMP="$(mktemp -t nlqdb-flow-005.XXXXXX)"
AS_STATUS="$(curl -sS --max-time "$TIMEOUT_S" -o "$AS_TMP" -w '%{http_code}' \
  -H "Accept: application/json" \
  "$MCP_URL/.well-known/oauth-authorization-server" 2>/dev/null || true)"
if [[ "$AS_STATUS" == "200" ]] \
    && jq -e '.issuer' "$AS_TMP" >/dev/null 2>&1 \
    && jq -e '.authorization_endpoint' "$AS_TMP" >/dev/null 2>&1 \
    && jq -e '.token_endpoint' "$AS_TMP" >/dev/null 2>&1; then
  assert_pass "RFC 8414 AS metadata carries issuer + authorization_endpoint + token_endpoint"
  DISCOVERY_PASS_COUNT=$((DISCOVERY_PASS_COUNT + 1))
else
  assert_fail "RFC 8414 AS metadata" "HTTP $AS_STATUS or missing issuer/authorization/token endpoint"
fi
rm -f "$AS_TMP"

if (( DISCOVERY_PASS_COUNT == 3 )); then
  DISCOVERY_OK="true"
fi

# --- step 4: POST /mcp initialize — unauthenticated must 401 + challenge --

say "FLOW-005 step 4 — POST $MCP_URL/mcp initialize (must 401 + WWW-Authenticate)"
INIT_HDR="$(mktemp -t nlqdb-flow-005-hdr.XXXXXX)"
INIT_BODY="$(mktemp -t nlqdb-flow-005-body.XXXXXX)"
INIT_PAYLOAD='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"flow-005-walker","version":"1.0"}}}'
INIT_STATUS="$(curl -sS --max-time "$TIMEOUT_S" -D "$INIT_HDR" -o "$INIT_BODY" -w '%{http_code}' \
  -X POST "$MCP_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d "$INIT_PAYLOAD" 2>/dev/null || true)"
INIT_AUTH="$(grep -i '^www-authenticate:' "$INIT_HDR" 2>/dev/null | head -1 | sed 's/^[Ww][Ww][Ww]-[Aa]uthenticate:[[:space:]]*//' | tr -d '\r\n')"
INIT_CHALLENGE_URL="$(printf '%s' "$INIT_AUTH" | grep -oE 'resource_metadata="[^"]+"' | head -1 | sed 's/^resource_metadata="//; s/"$//')"

if [[ "$INIT_STATUS" == "401" ]] \
    && [[ "$INIT_AUTH" == Bearer* ]] \
    && [[ "$INIT_AUTH" == *"resource_metadata="* ]] \
    && [[ "$INIT_AUTH" == *"error=\"invalid_token\""* ]]; then
  assert_pass "initialize 401 with Bearer + resource_metadata + error=\"invalid_token\""
  WALL_PASS_COUNT=$((WALL_PASS_COUNT + 1))
  if [[ "$INIT_CHALLENGE_URL" == "$EXPECTED_CHALLENGE_URL" ]]; then
    assert_pass "  challenge resource_metadata URL matches scoped discovery (RFC 9728 §5.1)"
    CHALLENGE_URL_MATCHES="true"
  else
    assert_fail "  challenge resource_metadata URL" \
      "got '$INIT_CHALLENGE_URL' (expected '$EXPECTED_CHALLENGE_URL')"
  fi
else
  assert_fail "initialize auth wall" \
    "HTTP $INIT_STATUS, WWW-Authenticate=${INIT_AUTH:-<missing>}"
fi
rm -f "$INIT_HDR" "$INIT_BODY"

# --- step 5: POST /mcp tools/list — same challenge shape ------------------

say "FLOW-005 step 5 — POST $MCP_URL/mcp tools/list (must 401 + same challenge)"
TL_HDR="$(mktemp -t nlqdb-flow-005-hdr.XXXXXX)"
TL_BODY="$(mktemp -t nlqdb-flow-005-body.XXXXXX)"
TL_PAYLOAD='{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
TL_STATUS="$(curl -sS --max-time "$TIMEOUT_S" -D "$TL_HDR" -o "$TL_BODY" -w '%{http_code}' \
  -X POST "$MCP_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d "$TL_PAYLOAD" 2>/dev/null || true)"
TL_AUTH="$(grep -i '^www-authenticate:' "$TL_HDR" 2>/dev/null | head -1 | sed 's/^[Ww][Ww][Ww]-[Aa]uthenticate:[[:space:]]*//' | tr -d '\r\n')"

if [[ "$TL_STATUS" == "401" ]] \
    && [[ "$TL_AUTH" == Bearer* ]] \
    && [[ "$TL_AUTH" == *"resource_metadata="* ]] \
    && [[ "$TL_AUTH" == *"error=\"invalid_token\""* ]]; then
  assert_pass "tools/list 401 with the same Bearer + resource_metadata challenge"
  WALL_PASS_COUNT=$((WALL_PASS_COUNT + 1))
else
  assert_fail "tools/list auth wall" \
    "HTTP $TL_STATUS, WWW-Authenticate=${TL_AUTH:-<missing>}"
fi
rm -f "$TL_HDR" "$TL_BODY"

if (( WALL_PASS_COUNT == 2 )); then
  AUTH_WALL_OK="true"
fi

# --- summary --------------------------------------------------------------

TOTAL_WALL_S=$(( $(date +%s) - T_START ))

echo ""
if (( CHECKS_FAILED == 0 )); then
  write_outcome "passed" "discovery + auth-wall + challenge URL all green ($CHECKS_PASSED/$CHECKS_PASSED checks in ${TOTAL_WALL_S}s)"
  ok "FLOW-005 step 5 PASS — discovery green, auth-wall returns RFC 9728 challenge"
  ok "outcome JSON written to $OUT_PATH"
  echo ""
  printf '  \033[1;32m✓\033[0m flow-005 walk passed in %ds (%d/%d checks)\n' \
    "$TOTAL_WALL_S" "$CHECKS_PASSED" "$((CHECKS_PASSED + CHECKS_FAILED))"
  exit 0
fi

# Pick the most descriptive state label. Discovery failures point at the
# Worker / route regression; auth-wall failures point at the mcp-server
# regression. Same SK-* triage shape as flow-004-walk.sh.
if [[ "$DISCOVERY_OK" != "true" ]]; then
  state="failed discovery"
elif [[ "$AUTH_WALL_OK" != "true" ]]; then
  state="failed auth wall"
else
  state="failed challenge URL"
fi

write_outcome "$state" "$CHECKS_FAILED check(s) failed; see stdout for the first failed assertion"
echo ""
printf '  \033[1;31m✗\033[0m flow-005 walk %s — %d/%d checks failed against %s\n' \
  "$state" "$CHECKS_FAILED" "$((CHECKS_PASSED + CHECKS_FAILED))" "$MCP_URL"
exit 1
