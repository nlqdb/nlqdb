#!/usr/bin/env bash
# nlqdb — agent-runnable §1.4 invite-valve end-to-end walker
# (FLOW-004 in docs/research/automated-icp-validation-plan-verification.md).
#
# Walks the SK-GATE-007 release-valve to a real 200 on `/v1/ask`:
#
#   1. mint a throwaway mail.tm inbox (free, no key, 8 QPS limit)
#   2. POST /v1/waitlist with that address (one auto-issued invite)
#   3. poll mail.tm until the Resend invite email lands
#   4. extract the `?invite=<code>` from the email body
#   5. POST /v1/ask with `Authorization: Bearer anon_<uuid>` AND
#      `X-Invite-Code: <code>` — assert the response is NOT
#      `403 feature_gated`
#
# What this proves end-to-end (no human in the loop): the path a real
# stranger takes from waitlist signup to first-value works. The pre-2026-05-24
# verification mirror left FLOW-004 unattempted for lack of an inbox; this
# script removes that blocker by using mail.tm's anonymous bearer-token API.
#
# Usage:
#   bash scripts/flow-004-walk.sh                              # default 5-min timeout
#   FLOW_004_TIMEOUT_S=180 bash scripts/flow-004-walk.sh       # tighter
#   NLQDB_BASE_URL=https://preview.nlqdb.com bash scripts/flow-004-walk.sh
#
# Side effects (real, intentional, capped):
#   • consumes ONE entry of the 200/week waitlist invite cap (SK-GATE-007)
#   • sends ONE Resend email from `hello@nlqdb.com` (3k/mo free tier)
#
# Output JSON: tools/stranger-test/results/flow-004-<utc>.json (gitignored).
# Exits 0 on a passed walk; non-zero on any step failure or block.

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

BASE_URL="${NLQDB_BASE_URL:-https://app.nlqdb.com}"
MAIL_TM_BASE="${MAIL_TM_BASE:-https://api.mail.tm}"
TIMEOUT_S="${FLOW_004_TIMEOUT_S:-300}"
POLL_INTERVAL_S="${FLOW_004_POLL_INTERVAL_S:-10}"
GOAL="${FLOW_004_GOAL:-a meal planner for couples}"

UTC_STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
OUT_PATH="${FLOW_004_OUT:-tools/stranger-test/results/flow-004-$UTC_STAMP.json}"

# --- display helpers (mirror scripts/verify-flows.sh) ----------------------

say()  { printf '\n\033[1;34m== %s ==\033[0m\n' "$*"; }
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
fail() { printf '  \033[1;31m✗\033[0m %s  — %s\n' "$1" "$2"; }
note() { printf '  \033[2m· %s\033[0m\n' "$*"; }

# Print only the first 4 + last 4 chars of a secret; refuse to print
# strings shorter than 12 chars to avoid full-token disclosure when an
# upstream returns an unexpectedly short value.
redact() {
  local s="${1:-}"
  local n=${#s}
  if (( n < 12 )); then printf '<redacted:%dch>' "$n"; else printf '%s..%s' "${s:0:4}" "${s: -4}"; fi
}

# --- prerequisite check ---------------------------------------------------

for cmd in curl jq openssl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "prereq" "missing '$cmd' — install before running"
    exit 2
  fi
done

mkdir -p "$(dirname "$OUT_PATH")"

# --- step 1: mint mail.tm inbox -------------------------------------------

say "FLOW-004 step 1 — mint mail.tm inbox"

DOMAINS_JSON="$(curl -sS --max-time 15 "$MAIL_TM_BASE/domains" 2>/dev/null || true)"
DOMAIN="$(printf '%s' "$DOMAINS_JSON" | jq -r '."hydra:member" | map(select(.isActive == true and .isPrivate == false)) | .[0].domain // empty')"
if [[ -z "$DOMAIN" ]]; then
  fail "FLOW-004 step 1" "mail.tm GET /domains returned no active public domain"
  exit 1
fi
ok "mail.tm public domain available: $DOMAIN"

RAND="$(openssl rand -hex 6)"
EMAIL="nlqdb-flow004-${UTC_STAMP,,}-${RAND}@${DOMAIN}"
EMAIL="$(printf '%s' "$EMAIL" | tr -d ':')"
PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"

ACCOUNT_JSON="$(curl -sS --max-time 15 -X POST "$MAIL_TM_BASE/accounts" \
  -H "Content-Type: application/json" \
  -d "$(jq -nc --arg a "$EMAIL" --arg p "$PASS" '{address:$a,password:$p}')" 2>/dev/null || true)"
ACCOUNT_ID="$(printf '%s' "$ACCOUNT_JSON" | jq -r '.id // empty')"
if [[ -z "$ACCOUNT_ID" ]]; then
  fail "FLOW-004 step 1" "mail.tm POST /accounts did not return an id ($(printf '%s' "$ACCOUNT_JSON" | head -c 200))"
  exit 1
fi
ok "mail.tm inbox provisioned: $EMAIL"

TOKEN_JSON="$(curl -sS --max-time 15 -X POST "$MAIL_TM_BASE/token" \
  -H "Content-Type: application/json" \
  -d "$(jq -nc --arg a "$EMAIL" --arg p "$PASS" '{address:$a,password:$p}')" 2>/dev/null || true)"
MTM_TOKEN="$(printf '%s' "$TOKEN_JSON" | jq -r '.token // empty')"
if [[ -z "$MTM_TOKEN" ]]; then
  fail "FLOW-004 step 1" "mail.tm POST /token did not return a JWT"
  exit 1
fi
ok "mail.tm bearer token acquired ($(redact "$MTM_TOKEN"))"

# Always clean up the mail.tm account so we don't leave zombies on the
# shared free-tier service. Runs on any exit path.
cleanup() {
  curl -sS --max-time 10 -X DELETE "$MAIL_TM_BASE/accounts/$ACCOUNT_ID" \
    -H "Authorization: Bearer $MTM_TOKEN" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# --- step 2: POST /v1/waitlist --------------------------------------------

say "FLOW-004 step 2 — POST $BASE_URL/v1/waitlist"

T0=$(date +%s)
WL_BODY="$(jq -nc --arg e "$EMAIL" '{email:$e, source:"flow-004-walker", persona:"solo-builder"}')"
WL_RESP="$(curl -sS --max-time 15 -o /tmp/flow-004-wl-body.$$ -w '%{http_code}' \
  -X POST "$BASE_URL/v1/waitlist" \
  -H "Content-Type: application/json" \
  -d "$WL_BODY" 2>/dev/null || true)"
WL_STATUS="$WL_RESP"
WL_BODY_CONTENT="$(cat /tmp/flow-004-wl-body.$$ 2>/dev/null || true)"
rm -f /tmp/flow-004-wl-body.$$

if [[ "$WL_STATUS" != "200" ]]; then
  fail "FLOW-004 step 2" "POST /v1/waitlist returned HTTP $WL_STATUS ($(printf '%s' "$WL_BODY_CONTENT" | head -c 200))"
  exit 1
fi
WL_RECEIVED="$(printf '%s' "$WL_BODY_CONTENT" | jq -r '.received // empty')"
if [[ "$WL_RECEIVED" != "true" ]]; then
  fail "FLOW-004 step 2" "POST /v1/waitlist 200 but body missing {received:true}"
  exit 1
fi
ok "POST /v1/waitlist accepted ($WL_STATUS, received=true)"

# --- step 3: poll mail.tm for the invite ----------------------------------

say "FLOW-004 step 3 — poll mail.tm /messages (timeout ${TIMEOUT_S}s, every ${POLL_INTERVAL_S}s)"

INVITE_CODE=""
EMAIL_ARRIVED_AT=""
DEADLINE=$(( T0 + TIMEOUT_S ))

while (( $(date +%s) < DEADLINE )); do
  MSG_LIST="$(curl -sS --max-time 15 \
    -H "Authorization: Bearer $MTM_TOKEN" \
    "$MAIL_TM_BASE/messages" 2>/dev/null || true)"
  MSG_ID="$(printf '%s' "$MSG_LIST" | jq -r '."hydra:member" | map(select(.from.address|test("nlqdb"; "i"))) | .[0].id // empty')"
  if [[ -n "$MSG_ID" ]]; then
    MSG_FULL="$(curl -sS --max-time 15 \
      -H "Authorization: Bearer $MTM_TOKEN" \
      "$MAIL_TM_BASE/messages/$MSG_ID" 2>/dev/null || true)"
    BODY_TEXT="$(printf '%s' "$MSG_FULL" | jq -r '.text // empty')"
    BODY_HTML="$(printf '%s' "$MSG_FULL" | jq -r '.html // empty')"
    BODY_ALL="${BODY_TEXT}\n${BODY_HTML}"
    INVITE_CODE="$(printf '%b' "$BODY_ALL" | grep -oE 'invite=[A-Za-z0-9_-]{16,}' | head -1 | sed 's/^invite=//')"
    if [[ -n "$INVITE_CODE" ]]; then
      EMAIL_ARRIVED_AT=$(date +%s)
      break
    fi
    note "message $MSG_ID arrived but no invite= param matched — continuing to poll"
  fi
  sleep "$POLL_INTERVAL_S"
done

if [[ -z "$INVITE_CODE" ]]; then
  ELAPSED=$(( $(date +%s) - T0 ))
  fail "FLOW-004 step 3" "no nlqdb invite email arrived in ${ELAPSED}s (mail.tm spam-filter? Resend outage? waitlist cap?)"
  # Persist a triage-friendly outcome JSON before bailing.
  jq -nc \
    --arg utc "$UTC_STAMP" \
    --arg state "blocked upstream" \
    --arg notes "no nlqdb invite email in ${ELAPSED}s" \
    --arg base "$BASE_URL" \
    --arg email_dom "$DOMAIN" \
    --argjson elapsed_s "$ELAPSED" \
    '{utc:$utc, base_url:$base, mail_tm_domain:$email_dom, state:$state, elapsed_s:$elapsed_s, notes:$notes}' \
    > "$OUT_PATH"
  exit 1
fi
EMAIL_LATENCY_S=$(( EMAIL_ARRIVED_AT - T0 ))
ok "invite email arrived in ${EMAIL_LATENCY_S}s, code $(redact "$INVITE_CODE")"

# --- step 4: POST /v1/ask with anon bearer + invite code ------------------

say "FLOW-004 step 4 — POST $BASE_URL/v1/ask with X-Invite-Code"

UUID="$(cat /proc/sys/kernel/random/uuid 2>/dev/null || openssl rand -hex 16 | sed 's/^\(.\{8\}\)\(.\{4\}\)\(.\{4\}\)\(.\{4\}\)/\1-\2-\3-\4-/')"
ANON_TOKEN="anon_${UUID}"

ASK_BODY="$(jq -nc --arg g "$GOAL" '{goal:$g}')"
ASK_STATUS="$(curl -sS --max-time 60 -o /tmp/flow-004-ask-body.$$ -w '%{http_code}' \
  -X POST "$BASE_URL/v1/ask" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANON_TOKEN" \
  -H "X-Invite-Code: $INVITE_CODE" \
  -d "$ASK_BODY" 2>/dev/null || true)"
ASK_BODY_CONTENT="$(cat /tmp/flow-004-ask-body.$$ 2>/dev/null || true)"
rm -f /tmp/flow-004-ask-body.$$

# Parse `error.status` only if the body is JSON; treat anything else as
# opaque (we only fail when it looks like the gate block).
ASK_ERR_STATUS="$(printf '%s' "$ASK_BODY_CONTENT" | jq -r '.error.status // empty' 2>/dev/null || true)"

GATE_BYPASSED="false"
WALK_STATE="failed"
WALK_NOTE=""
case "$ASK_STATUS" in
  200)
    GATE_BYPASSED="true"
    WALK_STATE="passed"
    WALK_NOTE="HTTP 200 — gate bypassed, first-value reached"
    ok "FLOW-004 step 4 PASS — /v1/ask returned HTTP 200 (gate bypassed)"
    ;;
  403)
    if [[ "$ASK_ERR_STATUS" == "feature_gated" ]]; then
      WALK_STATE="failed step 4"
      WALK_NOTE="HTTP 403 feature_gated — invite header did not bypass gate (SK-GATE-007 regression)"
      fail "FLOW-004 step 4" "/v1/ask still returned 403 feature_gated WITH invite header — SK-GATE-007 regression"
    else
      GATE_BYPASSED="true"
      WALK_STATE="partial"
      WALK_NOTE="HTTP 403 but error.status=$ASK_ERR_STATUS (NOT feature_gated) — gate bypassed; downstream block"
      note "FLOW-004 step 4 PARTIAL — 403 but error.status=$ASK_ERR_STATUS (NOT feature_gated); gate WAS bypassed"
    fi
    ;;
  *)
    if [[ "$ASK_ERR_STATUS" == "feature_gated" ]]; then
      WALK_STATE="failed step 4"
      WALK_NOTE="HTTP $ASK_STATUS feature_gated — SK-GATE-007 regression"
      fail "FLOW-004 step 4" "/v1/ask returned $ASK_STATUS feature_gated — SK-GATE-007 regression"
    else
      GATE_BYPASSED="true"
      WALK_STATE="partial"
      WALK_NOTE="HTTP $ASK_STATUS error.status=$ASK_ERR_STATUS — gate bypassed; downstream non-200"
      note "FLOW-004 step 4 PARTIAL — HTTP $ASK_STATUS (not 200, not feature_gated); gate WAS bypassed"
    fi
    ;;
esac

T_END=$(date +%s)
TOTAL_WALL_S=$(( T_END - T0 ))

# --- write outcome JSON ---------------------------------------------------

jq -nc \
  --arg utc "$UTC_STAMP" \
  --arg state "$WALK_STATE" \
  --arg base "$BASE_URL" \
  --arg domain "$DOMAIN" \
  --argjson email_latency_s "${EMAIL_LATENCY_S:-0}" \
  --argjson total_wall_s "$TOTAL_WALL_S" \
  --argjson ask_status "$ASK_STATUS" \
  --arg ask_err_status "$ASK_ERR_STATUS" \
  --arg gate_bypassed "$GATE_BYPASSED" \
  --arg notes "$WALK_NOTE" \
  '{utc:$utc, flow:"FLOW-004", base_url:$base, mail_tm_domain:$domain,
    state:$state, gate_bypassed:($gate_bypassed=="true"),
    email_latency_s:$email_latency_s, total_wall_s:$total_wall_s,
    ask_status:$ask_status, ask_error_status:$ask_err_status, notes:$notes}' \
  > "$OUT_PATH"

ok "outcome JSON written to $OUT_PATH"

if [[ "$WALK_STATE" == "passed" ]]; then
  printf '\n  \033[1;32m✓\033[0m FLOW-004 walk passed in %ss (gate bypassed)\n' "$TOTAL_WALL_S"
  exit 0
elif [[ "$WALK_STATE" == "partial" ]]; then
  printf '\n  \033[1;33m!\033[0m FLOW-004 partial in %ss (%s)\n' "$TOTAL_WALL_S" "$WALK_NOTE"
  # Partial = gate bypassed but downstream non-200 (could be free-LLM 5xx).
  # The SK-GATE-007 contract is "gate honoured the code"; downstream
  # health is a separate failure mode. Exit 3 so cron can distinguish.
  exit 3
else
  printf '\n  \033[1;31m✗\033[0m FLOW-004 walk failed in %ss (%s)\n' "$TOTAL_WALL_S" "$WALK_NOTE"
  exit 1
fi
