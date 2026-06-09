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
#      `feature_gated` (the SK-GATE-007 regression signature). On a 200,
#      parse the AskResult body and record first-value *quality*
#      (SK-STRG-006): result status, row count, engine confidence, model,
#      and whether the answer is SELECT-backed — so the walk proves the
#      invited stranger got a real answer, not a blank 200.
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
#
# Composition seam (SK-STRG-004): set `FLOW_004_INVITE_OUT=<path>` to also
# write the raw invite code to that path (mode 600) after step 3. Used by
# `scripts/stranger-test-invited.sh` to mint an invite and hand it to the
# Playwright walker. Caller MUST read-and-delete immediately — codes are
# single-use, 30-day TTL, and bypass the SK-GATE-007 closure.
#
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
    --arg first_value_kind "${FIRST_VALUE_KIND:-unknown}" \
    --arg result_status "${RESULT_STATUS:-}" \
    --arg answer_model "${ANSWER_MODEL:-}" \
    --arg first_value_quality "${FIRST_VALUE_QUALITY:-unknown}" \
    --arg sql_is_select "${SQL_IS_SELECT:-false}" \
    --arg notes "$notes" \
    --argjson email_latency_s "${EMAIL_LATENCY_S:-0}" \
    --argjson total_wall_s "${TOTAL_WALL_S:-0}" \
    --argjson ask_status "${ASK_STATUS:-0}" \
    --argjson control_status "${CTRL_STATUS:-0}" \
    --argjson row_count "${ROW_COUNT:-0}" \
    --argjson table_count "${TABLE_COUNT:-0}" \
    --argjson answer_confidence "${CONFIDENCE:-0}" \
    '{utc:$utc, flow:"FLOW-004", base_url:$base, mail_tm_domain:$domain,
      state:$state, gate_bypassed:($gate_bypassed=="true"),
      control_blocked:$control_blocked,
      email_latency_s:$email_latency_s, total_wall_s:$total_wall_s,
      ask_status:$ask_status, ask_error_status:$ask_err_status,
      control_status:$control_status, control_error_status:$control_err_status,
      first_value_kind:$first_value_kind, result_status:$result_status,
      row_count:$row_count, table_count:$table_count,
      answer_confidence:$answer_confidence, answer_model:$answer_model,
      sql_is_select:($sql_is_select=="true"),
      first_value_quality:$first_value_quality,
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
# SK-STRG-006 — first-value *quality* of the invited stranger's HTTP 200,
# not just reachability. Defaulted so every exit path emits a uniform JSON.
FIRST_VALUE_KIND="unknown"
RESULT_STATUS=""
ROW_COUNT=0
TABLE_COUNT=0
CONFIDENCE=0
ANSWER_MODEL=""
SQL_IS_SELECT="false"
FIRST_VALUE_QUALITY="unknown"

# Trap is registered BEFORE any mail.tm side effect so a token-failure or
# Ctrl-C between account-create and token-fetch still cleans up. The trap
# refreshes the JWT inline if MTM_TOKEN is empty — accounts are unique per
# walk so the password is the only handle we keep.
# shellcheck disable=SC2317  # body is invoked via `trap cleanup EXIT`
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
ok "mail.tm inbox provisioned: $(redact "$EMAIL") @${EMAIL##*@}"

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

# SK-STRG-004 composition seam — hand the raw code to a sibling walker
# (e.g. stranger-test-invited.sh) via a mode-600 sidecar file. Gated on
# an explicit env var so the default behaviour stays "code never leaves
# this script."
if [[ -n "${FLOW_004_INVITE_OUT:-}" ]]; then
  mkdir -p "$(dirname "$FLOW_004_INVITE_OUT")"
  ( umask 077 && printf '%s' "$INVITE_CODE" > "$FLOW_004_INVITE_OUT" )
  note "invite code written to $FLOW_004_INVITE_OUT (mode 600) for composition"
fi

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
elif [[ "$ASK_STATUS" == "0" ]]; then
  # curl never got a response — DNS, TCP, TLS, or timeout failure. We
  # can't claim the gate was bypassed because we never reached it.
  WALK_STATE="blocked upstream"
  WALK_NOTE="invite probe — curl returned no HTTP response (network / TLS / timeout)"
  fail "FLOW-004 step 5" "curl returned no HTTP response on the invite probe"
elif [[ "$ASK_ERR_STATUS" == "feature_gated" ]]; then
  WALK_STATE="failed step 5"
  WALK_NOTE="invite HTTP $ASK_STATUS still feature_gated — SK-GATE-007 regression (control was correctly blocked)"
  fail "FLOW-004 step 5" "/v1/ask returned feature_gated WITH invite header — SK-GATE-007 regression"
elif [[ "$ASK_STATUS" == "200" ]]; then
  GATE_BYPASSED="true"
  WALK_STATE="passed"
  # SK-STRG-006 — assert first-value *quality*, not just reachability.
  # `/v1/ask` returns one of two shapes (apps/api/src/index.ts): a
  # `create` envelope (the invited stranger has 0 DBs, so the goal
  # provisions one) or a `query` AskResult. Parse whichever arrived so
  # the walk proves the stranger got real first-value — a seeded DB or a
  # SELECT-backed answer — not a blank 200. Quality is recorded, never
  # fatal (a 0-row query on a fresh DB is legitimate); it annotates the
  # note, not the pass/fail state. SQL is read only to classify SELECT;
  # it is never logged (could echo schema identifiers).
  FIRST_VALUE_KIND="$(printf '%s' "$ASK_BODY_CONTENT" | jq -r 'if .kind=="create" then "create" elif .status=="ok" then "query" else "unknown" end' 2>/dev/null || echo unknown)"
  if [[ "$FIRST_VALUE_KIND" == "create" ]]; then
    # First-value = a provisioned, populated DB. Quality = the DB is real
    # (dbId + schema) AND seeded (≥1 sample row across its tables).
    RESULT_STATUS="create"
    CREATE_DB="$(printf '%s' "$ASK_BODY_CONTENT" | jq -r '.db // ""' 2>/dev/null || true)"
    CREATE_SCHEMA="$(printf '%s' "$ASK_BODY_CONTENT" | jq -r '.schemaName // ""' 2>/dev/null || true)"
    ANSWER_MODEL="$(printf '%s' "$ASK_BODY_CONTENT" | jq -r '.engine // ""' 2>/dev/null || true)"
    ROW_COUNT="$(printf '%s' "$ASK_BODY_CONTENT" | jq -r '(.sampleRows // []) | length' 2>/dev/null || echo 0)"
    TABLE_COUNT="$(printf '%s' "$ASK_BODY_CONTENT" | jq -r '[(.sampleRows // [])[].table] | unique | length' 2>/dev/null || echo 0)"
    [[ "$ROW_COUNT" =~ ^[0-9]+$ ]] || ROW_COUNT=0
    [[ "$TABLE_COUNT" =~ ^[0-9]+$ ]] || TABLE_COUNT=0
    if [[ -n "$CREATE_DB" && -n "$CREATE_SCHEMA" && "$ROW_COUNT" -ge 1 ]]; then
      FIRST_VALUE_QUALITY="ok"
    else
      # SK-STRG-007: an un-seeded `create` (the SK-HDC-018 fallback) is not
      # first-value, so record it in `.state` (exit code stays 0 below).
      FIRST_VALUE_QUALITY="degraded"
      WALK_STATE="passed_degraded"
    fi
    unset CREATE_DB CREATE_SCHEMA
    WALK_NOTE="control blocked (feature_gated); invite HTTP 200, first-value=$FIRST_VALUE_QUALITY (kind=create, ${TABLE_COUNT} tables, ${ROW_COUNT} sample rows, engine=$ANSWER_MODEL) — gate honoured X-Invite-Code"
    ok "FLOW-004 step 5 PASS — invite HTTP 200; first-value=$FIRST_VALUE_QUALITY (kind=create, ${TABLE_COUNT} tables seeded with ${ROW_COUNT} sample rows, engine=$ANSWER_MODEL)"
  else
    # First-value = a query answer. Quality = ok-status + SELECT-backed.
    # else: a `query` AskResult (status=ok) or an unclassifiable 200
    # (kind=unknown) — both graded here; quality requires ok-status +
    # SELECT-backed SQL, so an `unknown` shape lands `degraded`.
    RESULT_STATUS="$(printf '%s' "$ASK_BODY_CONTENT" | jq -r '.status // ""' 2>/dev/null || true)"
    ROW_COUNT="$(printf '%s' "$ASK_BODY_CONTENT" | jq -r '.rowCount // 0' 2>/dev/null || echo 0)"
    ANSWER_MODEL="$(printf '%s' "$ASK_BODY_CONTENT" | jq -r '.trace.model // ""' 2>/dev/null || true)"
    CONFIDENCE="$(printf '%s' "$ASK_BODY_CONTENT" | jq -r '.trace.confidence // 0' 2>/dev/null || echo 0)"
    query_sql="$(printf '%s' "$ASK_BODY_CONTENT" | jq -r '.trace.sql // ""' 2>/dev/null || true)"
    [[ "$ROW_COUNT" =~ ^[0-9]+$ ]] || ROW_COUNT=0
    [[ "$CONFIDENCE" =~ ^[0-9]+([.][0-9]+)?$ ]] || CONFIDENCE=0
    if printf '%s' "$query_sql" | grep -qiE '^[[:space:]]*(with|select)'; then SQL_IS_SELECT="true"; else SQL_IS_SELECT="false"; fi
    unset query_sql
    if [[ "$RESULT_STATUS" == "ok" && "$SQL_IS_SELECT" == "true" ]]; then
      FIRST_VALUE_QUALITY="ok"
    else
      FIRST_VALUE_QUALITY="degraded"
    fi
    WALK_NOTE="control blocked (feature_gated); invite HTTP 200, first-value=$FIRST_VALUE_QUALITY (kind=$FIRST_VALUE_KIND, status=$RESULT_STATUS rows=$ROW_COUNT conf=$CONFIDENCE) — gate honoured X-Invite-Code"
    ok "FLOW-004 step 5 PASS — invite HTTP 200; first-value=$FIRST_VALUE_QUALITY (kind=$FIRST_VALUE_KIND, status=$RESULT_STATUS, rows=$ROW_COUNT, confidence=$CONFIDENCE, model=$ANSWER_MODEL)"
  fi
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
  passed_degraded)
    # SK-STRG-007: gate-bypass passed (exit 0); first-value degraded in `.state`.
    printf '\n  \033[1;33m!\033[0m FLOW-004 gate-bypass passed in %ss but first-value DEGRADED — invited stranger got an un-seeded DB (%s)\n' "$TOTAL_WALL_S" "$WALK_NOTE"
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
