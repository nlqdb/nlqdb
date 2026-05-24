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
#   5. CONTROL probe — POST /v1/ask with NO invite header (same anon
#      bearer). Must return 4xx with `error.status="feature_gated"`,
#      otherwise the gate is open globally and the walk proves nothing
#      about SK-GATE-007 (BIRD/Spider crossed the threshold).
#   6. POST /v1/ask with `Authorization: Bearer anon_<uuid>` AND
#      `X-Invite-Code: <code>` — assert the response is NOT
#      `feature_gated` (the SK-GATE-007 regression signature).
#
# The control + invite pair is what makes this a real regression detector
# rather than a static "is the API up" check.
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
# Exit codes:
#   0  passed (control blocked + invite 200)
#   1  failed at a definite step (state in JSON; gate did NOT honour invite)
#   2  prereq missing
#   3  partial (gate bypassed by invite but /v1/ask non-200 downstream)
#   4  inconclusive (control NOT blocked — gate appears open globally;
#                    SK-GATE-007 invariant unprovable on this run)

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

# Writes a single outcome JSON line. Always includes the same key set so
# downstream tooling can rely on the shape regardless of which step
# bailed out. `--argjson` rejects empty strings, so numeric fields are
# defaulted to 0 / strings to "" before the call.
write_outcome() {
  local state="$1" notes="$2"
  jq -nc \
    --arg utc "$UTC_STAMP" \
    --arg state "$state" \
    --arg base "$BASE_URL" \
    --arg domain "${DOMAIN:-}" \
    --arg ask_err_status "${ASK_ERR_STATUS:-}" \
    --arg control_err_status "${CTRL_ERR_STATUS:-}" \
    --arg gate_bypassed "${GATE_BYPASSED:-false}" \
    --arg control_blocked "${CONTROL_BLOCKED:-unknown}" \
    --arg notes "$notes" \
    --argjson email_latency_s "${EMAIL_LATENCY_S:-0}" \
    --argjson total_wall_s "${TOTAL_WALL_S:-0}" \
    --argjson ask_status "${ASK_STATUS:-0}" \
    --argjson control_status "${CTRL_STATUS:-0}" \
    '{utc:$utc, flow:"FLOW-004", base_url:$base, mail_tm_domain:$domain,
      state:$state, gate_bypassed:($gate_bypassed=="true"),
      control_blocked:$control_blocked,
      email_latency_s:$email_latency_s, total_wall_s:$total_wall_s,
      ask_status:$ask_status, ask_error_status:$ask_err_status,
      control_status:$control_status, control_error_status:$control_err_status,
      notes:$notes}' \
    > "$OUT_PATH"
}

# --- prerequisite check ---------------------------------------------------

for cmd in curl jq openssl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "prereq" "missing '$cmd' — install before running"
    exit 2
  fi
done

mkdir -p "$(dirname "$OUT_PATH")"

# Initialise state so a write_outcome from any failure path produces a
# uniform JSON shape (no missing fields).
ACCOUNT_ID=""
MTM_TOKEN=""
DOMAIN=""
EMAIL_LATENCY_S=0
TOTAL_WALL_S=0
ASK_STATUS=0
ASK_ERR_STATUS=""
CTRL_STATUS=0
CTRL_ERR_STATUS=""
GATE_BYPASSED="false"
CONTROL_BLOCKED="unknown"

# Trap is registered BEFORE any mail.tm side effect so a token-failure or
# Ctrl-C between account-create and token-fetch still cleans up. The trap
# refreshes the JWT inline if MTM_TOKEN is empty — accounts are unique per
# walk so the password is the only handle we keep.
cleanup() {
  if [[ -n "$ACCOUNT_ID" ]]; then
    if [[ -z "$MTM_TOKEN" && -n "${EMAIL:-}" && -n "${PASS:-}" ]]; then
      MTM_TOKEN="$(curl -sS --max-time 10 -X POST "$MAIL_TM_BASE/token" \
        -H "Content-Type: application/json" \
        -d "$(jq -nc --arg a "$EMAIL" --arg p "$PASS" '{address:$a,password:$p}')" \
        2>/dev/null | jq -r '.token // empty' 2>/dev/null || true)"
    fi
    if [[ -n "$MTM_TOKEN" ]]; then
      curl -sS --max-time 10 -X DELETE "$MAIL_TM_BASE/accounts/$ACCOUNT_ID" \
        -H "Authorization: Bearer $MTM_TOKEN" >/dev/null 2>&1 || true
    fi
  fi
}
trap cleanup EXIT

# --- step 1: mint mail.tm inbox -------------------------------------------

say "FLOW-004 step 1 — mint mail.tm inbox"

DOMAINS_JSON="$(curl -sS --max-time 15 "$MAIL_TM_BASE/domains" 2>/dev/null || true)"
DOMAIN="$(printf '%s' "$DOMAINS_JSON" | jq -r '."hydra:member" | map(select(.isActive == true and .isPrivate == false)) | .[0].domain // empty')"
if [[ -z "$DOMAIN" ]]; then
  fail "FLOW-004 step 1" "mail.tm GET /domains returned no active public domain"
  write_outcome "blocked upstream" "mail.tm GET /domains returned no active public domain"
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
  write_outcome "blocked upstream" "mail.tm POST /accounts did not return an id"
  exit 1
fi
ok "mail.tm inbox provisioned: $EMAIL"

TOKEN_JSON="$(curl -sS --max-time 15 -X POST "$MAIL_TM_BASE/token" \
  -H "Content-Type: application/json" \
  -d "$(jq -nc --arg a "$EMAIL" --arg p "$PASS" '{address:$a,password:$p}')" 2>/dev/null || true)"
MTM_TOKEN="$(printf '%s' "$TOKEN_JSON" | jq -r '.token // empty')"
if [[ -z "$MTM_TOKEN" ]]; then
  fail "FLOW-004 step 1" "mail.tm POST /token did not return a JWT"
  write_outcome "blocked upstream" "mail.tm POST /token did not return a JWT"
  exit 1
fi
ok "mail.tm bearer token acquired ($(redact "$MTM_TOKEN"))"

# --- step 2: POST /v1/waitlist --------------------------------------------

say "FLOW-004 step 2 — POST $BASE_URL/v1/waitlist"

T_WAITLIST=$(date +%s)
WL_BODY="$(jq -nc --arg e "$EMAIL" '{email:$e, source:"flow-004-walker", persona:"solo-builder"}')"
WL_STATUS="$(curl -sS --max-time 15 -o /tmp/flow-004-wl-body.$$ -w '%{http_code}' \
  -X POST "$BASE_URL/v1/waitlist" \
  -H "Content-Type: application/json" \
  -d "$WL_BODY" 2>/dev/null || true)"
WL_STATUS="${WL_STATUS:-0}"
WL_BODY_CONTENT="$(cat /tmp/flow-004-wl-body.$$ 2>/dev/null || true)"
rm -f /tmp/flow-004-wl-body.$$

if [[ "$WL_STATUS" != "200" ]]; then
  fail "FLOW-004 step 2" "POST /v1/waitlist returned HTTP $WL_STATUS ($(printf '%s' "$WL_BODY_CONTENT" | head -c 200))"
  write_outcome "failed step 2" "POST /v1/waitlist returned HTTP $WL_STATUS"
  exit 1
fi
WL_RECEIVED="$(printf '%s' "$WL_BODY_CONTENT" | jq -r '.received // empty')"
if [[ "$WL_RECEIVED" != "true" ]]; then
  fail "FLOW-004 step 2" "POST /v1/waitlist 200 but body missing {received:true}"
  write_outcome "failed step 2" "POST /v1/waitlist 200 but body missing {received:true}"
  exit 1
fi
ok "POST /v1/waitlist accepted ($WL_STATUS, received=true)"

# --- step 3: poll mail.tm for the invite ----------------------------------

say "FLOW-004 step 3 — poll mail.tm /messages (timeout ${TIMEOUT_S}s, every ${POLL_INTERVAL_S}s)"

INVITE_CODE=""
EMAIL_ARRIVED_AT=""
T_POLL_START=$(date +%s)
DEADLINE=$(( T_POLL_START + TIMEOUT_S ))

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
    # `printf '%s\n%s'` (literal newline) rather than `printf '%b'` on
    # interpolated email bodies — backslash sequences in user-supplied
    # HTML must NOT be re-interpreted by printf.
    INVITE_CODE="$(printf '%s\n%s' "$BODY_TEXT" "$BODY_HTML" | grep -oE 'invite=[A-Za-z0-9_-]{16,}' | head -1 | sed 's/^invite=//')"
    if [[ -n "$INVITE_CODE" ]]; then
      EMAIL_ARRIVED_AT=$(date +%s)
      break
    fi
    note "message $MSG_ID arrived but no invite= param matched — continuing to poll"
  fi
  sleep "$POLL_INTERVAL_S"
done

if [[ -z "$INVITE_CODE" ]]; then
  ELAPSED=$(( $(date +%s) - T_POLL_START ))
  fail "FLOW-004 step 3" "no nlqdb invite email arrived in ${ELAPSED}s (mail.tm spam-filter? Resend outage? waitlist cap?)"
  write_outcome "blocked upstream" "no nlqdb invite email in ${ELAPSED}s"
  exit 1
fi
# Latency is "Resend sent → mail.tm received", isolated from the waitlist
# round-trip (which has its own timer on T_WAITLIST should we ever care).
EMAIL_LATENCY_S=$(( EMAIL_ARRIVED_AT - T_POLL_START ))
ok "invite email arrived in ${EMAIL_LATENCY_S}s, code $(redact "$INVITE_CODE")"

# --- step 4: control probe — /v1/ask WITHOUT invite (must be blocked) ----

say "FLOW-004 step 4 — control: POST $BASE_URL/v1/ask WITHOUT X-Invite-Code"

UUID="$(cat /proc/sys/kernel/random/uuid 2>/dev/null || openssl rand -hex 16 | sed 's/^\(.\{8\}\)\(.\{4\}\)\(.\{4\}\)\(.\{4\}\)/\1-\2-\3-\4-/')"
ANON_TOKEN="anon_${UUID}"
ASK_BODY="$(jq -nc --arg g "$GOAL" '{goal:$g}')"

CTRL_STATUS="$(curl -sS --max-time 60 -o /tmp/flow-004-ctrl-body.$$ -w '%{http_code}' \
  -X POST "$BASE_URL/v1/ask" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANON_TOKEN" \
  -d "$ASK_BODY" 2>/dev/null || true)"
CTRL_STATUS="${CTRL_STATUS:-0}"
CTRL_BODY_CONTENT="$(cat /tmp/flow-004-ctrl-body.$$ 2>/dev/null || true)"
rm -f /tmp/flow-004-ctrl-body.$$
CTRL_ERR_STATUS="$(printf '%s' "$CTRL_BODY_CONTENT" | jq -r '.error.status // empty' 2>/dev/null || true)"

if [[ "$CTRL_ERR_STATUS" == "feature_gated" ]]; then
  CONTROL_BLOCKED="true"
  ok "control returned $CTRL_STATUS feature_gated (gate is doing its job)"
else
  CONTROL_BLOCKED="false"
  note "control returned HTTP $CTRL_STATUS error.status=$CTRL_ERR_STATUS — gate appears OPEN globally; SK-GATE-007 invariant unprovable on this run"
fi

# --- step 5: POST /v1/ask WITH invite — must succeed -----------------

say "FLOW-004 step 5 — invite: POST $BASE_URL/v1/ask WITH X-Invite-Code"

ASK_STATUS="$(curl -sS --max-time 60 -o /tmp/flow-004-ask-body.$$ -w '%{http_code}' \
  -X POST "$BASE_URL/v1/ask" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANON_TOKEN" \
  -H "X-Invite-Code: $INVITE_CODE" \
  -d "$ASK_BODY" 2>/dev/null || true)"
ASK_STATUS="${ASK_STATUS:-0}"
ASK_BODY_CONTENT="$(cat /tmp/flow-004-ask-body.$$ 2>/dev/null || true)"
rm -f /tmp/flow-004-ask-body.$$

# Parse `error.status` only if the body is JSON; treat anything else as
# opaque (we only fail when it looks like the gate block).
ASK_ERR_STATUS="$(printf '%s' "$ASK_BODY_CONTENT" | jq -r '.error.status // empty' 2>/dev/null || true)"

WALK_STATE="failed"
WALK_NOTE=""

# Decision matrix: control × invite. The walker is a regression detector
# only when control is `feature_gated` AND invite is NOT `feature_gated`.
if [[ "$CONTROL_BLOCKED" != "true" ]]; then
  # Gate is open globally; we can't prove SK-GATE-007 honoured the code
  # — both halves of the pair would pass either way.
  WALK_STATE="inconclusive"
  WALK_NOTE="control HTTP $CTRL_STATUS error.status=$CTRL_ERR_STATUS — gate not blocking unbypassed traffic; SK-GATE-007 invariant unprovable"
  note "FLOW-004 INCONCLUSIVE — control was not blocked; cannot prove invite was honoured"
elif [[ "$ASK_ERR_STATUS" == "feature_gated" ]]; then
  WALK_STATE="failed step 5"
  WALK_NOTE="invite HTTP $ASK_STATUS still feature_gated — SK-GATE-007 regression (control was correctly blocked)"
  fail "FLOW-004 step 5" "/v1/ask returned feature_gated WITH invite header — SK-GATE-007 regression"
elif [[ "$ASK_STATUS" == "200" ]]; then
  GATE_BYPASSED="true"
  WALK_STATE="passed"
  WALK_NOTE="control blocked (feature_gated); invite HTTP 200 — gate honoured X-Invite-Code"
  ok "FLOW-004 step 5 PASS — control blocked, invite returned HTTP 200 (gate honoured the code)"
else
  GATE_BYPASSED="true"
  WALK_STATE="partial"
  WALK_NOTE="control blocked; invite HTTP $ASK_STATUS error.status=$ASK_ERR_STATUS — gate bypassed; downstream non-200"
  note "FLOW-004 step 5 PARTIAL — invite HTTP $ASK_STATUS (NOT feature_gated, NOT 200); gate WAS bypassed"
fi

T_END=$(date +%s)
TOTAL_WALL_S=$(( T_END - T_WAITLIST ))

# --- write outcome JSON ---------------------------------------------------

write_outcome "$WALK_STATE" "$WALK_NOTE"
ok "outcome JSON written to $OUT_PATH"

case "$WALK_STATE" in
  passed)
    printf '\n  \033[1;32m✓\033[0m FLOW-004 walk passed in %ss (control blocked + invite 200)\n' "$TOTAL_WALL_S"
    exit 0
    ;;
  partial)
    printf '\n  \033[1;33m!\033[0m FLOW-004 partial in %ss (%s)\n' "$TOTAL_WALL_S" "$WALK_NOTE"
    exit 3
    ;;
  inconclusive)
    printf '\n  \033[1;33m?\033[0m FLOW-004 inconclusive in %ss (%s)\n' "$TOTAL_WALL_S" "$WALK_NOTE"
    exit 4
    ;;
  *)
    printf '\n  \033[1;31m✗\033[0m FLOW-004 walk failed in %ss (%s)\n' "$TOTAL_WALL_S" "$WALK_NOTE"
    exit 1
    ;;
esac
