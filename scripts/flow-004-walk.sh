#!/usr/bin/env bash
# nlqdb — agent-runnable §1.4 first-value end-to-end walker
# (FLOW-004 in docs/research/automated-icp-validation-plan-verification.md).
#
# Walks an anonymous stranger to a real 200 on `/v1/ask`:
#
#   1. POST /v1/ask with `Authorization: Bearer anon_<uuid>` — assert the
#      response is HTTP 200. On a 200, parse the AskResult body and record
#      first-value *quality* (SK-STRG-006): result status, row count, engine
#      confidence, model, and whether the answer is SELECT-backed — so the
#      walk proves the stranger got a real answer, not a blank 200.
#
# What this proves end-to-end (no human in the loop): the path a real
# stranger takes from landing to first-value works.
#
# Usage:
#   bash scripts/flow-004-walk.sh                              # default 5-min timeout
#   FLOW_004_TIMEOUT_S=180 bash scripts/flow-004-walk.sh       # tighter
#   NLQDB_BASE_URL=https://preview.nlqdb.com bash scripts/flow-004-walk.sh
#
# Output JSON: tools/stranger-test/results/flow-004-<utc>.json (gitignored).
#
# Exit codes:
#   0  passed (invite-less /v1/ask 200 with real first-value)
#   1  failed at a definite step (state in JSON)
#   2  prereq missing
#   3  partial (/v1/ask non-200 downstream)

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

BASE_URL="${NLQDB_BASE_URL:-https://app.nlqdb.com}"
GOAL="${FLOW_004_GOAL:-a meal planner for couples}"

UTC_STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
OUT_PATH="${FLOW_004_OUT:-tools/stranger-test/results/flow-004-$UTC_STAMP.json}"

# --- display helpers (mirror scripts/verify-flows.sh) ----------------------

say()  { printf '\n\033[1;34m== %s ==\033[0m\n' "$*"; }
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
fail() { printf '  \033[1;31m✗\033[0m %s  — %s\n' "$1" "$2"; }
note() { printf '  \033[2m· %s\033[0m\n' "$*"; }

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
    --arg ask_err_status "${ASK_ERR_STATUS:-}" \
    --arg first_value_kind "${FIRST_VALUE_KIND:-unknown}" \
    --arg result_status "${RESULT_STATUS:-}" \
    --arg answer_model "${ANSWER_MODEL:-}" \
    --arg first_value_quality "${FIRST_VALUE_QUALITY:-unknown}" \
    --arg sql_is_select "${SQL_IS_SELECT:-false}" \
    --arg notes "$notes" \
    --argjson total_wall_s "${TOTAL_WALL_S:-0}" \
    --argjson ask_status "${ASK_STATUS:-0}" \
    --argjson row_count "${ROW_COUNT:-0}" \
    --argjson table_count "${TABLE_COUNT:-0}" \
    --argjson answer_confidence "${CONFIDENCE:-0}" \
    '{utc:$utc, flow:"FLOW-004", base_url:$base,
      state:$state,
      total_wall_s:$total_wall_s,
      ask_status:$ask_status, ask_error_status:$ask_err_status,
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
TOTAL_WALL_S=0
ASK_STATUS=0
ASK_ERR_STATUS=""
# SK-STRG-006 — first-value *quality* of the stranger's HTTP 200, not just
# reachability. Defaulted so every exit path emits a uniform JSON.
FIRST_VALUE_KIND="unknown"
RESULT_STATUS=""
ROW_COUNT=0
TABLE_COUNT=0
CONFIDENCE=0
ANSWER_MODEL=""
SQL_IS_SELECT="false"
FIRST_VALUE_QUALITY="unknown"

# --- step 1: POST /v1/ask — must succeed ----------------------------------

say "FLOW-004 step 1 — POST $BASE_URL/v1/ask (anonymous)"

T_START=$(date +%s)
UUID="$(cat /proc/sys/kernel/random/uuid 2>/dev/null || openssl rand -hex 16 | sed 's/^\(.\{8\}\)\(.\{4\}\)\(.\{4\}\)\(.\{4\}\)/\1-\2-\3-\4-/')"
ANON_TOKEN="anon_${UUID}"
ASK_BODY="$(jq -nc --arg g "$GOAL" '{goal:$g}')"

ASK_STATUS="$(curl -sS --max-time 60 -o /tmp/flow-004-ask-body.$$ -w '%{http_code}' \
  -X POST "$BASE_URL/v1/ask" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANON_TOKEN" \
  -d "$ASK_BODY" 2>/dev/null || true)"
ASK_STATUS="${ASK_STATUS:-0}"
ASK_BODY_CONTENT="$(cat /tmp/flow-004-ask-body.$$ 2>/dev/null || true)"
rm -f /tmp/flow-004-ask-body.$$

# Parse `error.status` only if the body is JSON; treat anything else as opaque.
ASK_ERR_STATUS="$(printf '%s' "$ASK_BODY_CONTENT" | jq -r '.error.status // empty' 2>/dev/null || true)"

WALK_STATE="failed"
WALK_NOTE=""

if [[ "$ASK_STATUS" == "0" ]]; then
  # curl never got a response — DNS, TCP, TLS, or timeout failure.
  WALK_STATE="blocked upstream"
  WALK_NOTE="/v1/ask — curl returned no HTTP response (network / TLS / timeout)"
  fail "FLOW-004 step 1" "curl returned no HTTP response on the /v1/ask probe"
elif [[ "$ASK_STATUS" == "200" ]]; then
  WALK_STATE="passed"
  # SK-STRG-006 — assert first-value *quality*, not just reachability.
  # `/v1/ask` returns one of two shapes (apps/api/src/index.ts): a
  # `create` envelope (the stranger has 0 DBs, so the goal provisions one)
  # or a `query` AskResult. Parse whichever arrived so the walk proves the
  # stranger got real first-value — a seeded DB or a SELECT-backed answer —
  # not a blank 200. Quality is recorded, never fatal (a 0-row query on a
  # fresh DB is legitimate); it annotates the note, not the pass/fail state.
  # SQL is read only to classify SELECT; it is never logged (could echo
  # schema identifiers).
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
    WALK_NOTE="/v1/ask HTTP 200, first-value=$FIRST_VALUE_QUALITY (kind=create, ${TABLE_COUNT} tables, ${ROW_COUNT} sample rows, engine=$ANSWER_MODEL)"
    ok "FLOW-004 step 1 PASS — /v1/ask HTTP 200; first-value=$FIRST_VALUE_QUALITY (kind=create, ${TABLE_COUNT} tables seeded with ${ROW_COUNT} sample rows, engine=$ANSWER_MODEL)"
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
    WALK_NOTE="/v1/ask HTTP 200, first-value=$FIRST_VALUE_QUALITY (kind=$FIRST_VALUE_KIND, status=$RESULT_STATUS rows=$ROW_COUNT conf=$CONFIDENCE)"
    ok "FLOW-004 step 1 PASS — /v1/ask HTTP 200; first-value=$FIRST_VALUE_QUALITY (kind=$FIRST_VALUE_KIND, status=$RESULT_STATUS, rows=$ROW_COUNT, confidence=$CONFIDENCE, model=$ANSWER_MODEL)"
  fi
else
  WALK_STATE="partial"
  WALK_NOTE="/v1/ask HTTP $ASK_STATUS error.status=$ASK_ERR_STATUS — non-200 downstream"
  note "FLOW-004 step 1 PARTIAL — /v1/ask HTTP $ASK_STATUS (NOT 200)"
fi

T_END=$(date +%s)
TOTAL_WALL_S=$(( T_END - T_START ))

# --- write outcome JSON ---------------------------------------------------

write_outcome "$WALK_STATE" "$WALK_NOTE"
ok "outcome JSON written to $OUT_PATH"

case "$WALK_STATE" in
  passed)
    printf '\n  \033[1;32m✓\033[0m FLOW-004 walk passed in %ss (/v1/ask 200 + real first-value)\n' "$TOTAL_WALL_S"
    exit 0
    ;;
  passed_degraded)
    # SK-STRG-007: /v1/ask 200 (exit 0); first-value degraded in `.state`.
    printf '\n  \033[1;33m!\033[0m FLOW-004 passed in %ss but first-value DEGRADED — stranger got an un-seeded DB (%s)\n' "$TOTAL_WALL_S" "$WALK_NOTE"
    exit 0
    ;;
  partial)
    printf '\n  \033[1;33m!\033[0m FLOW-004 partial in %ss (%s)\n' "$TOTAL_WALL_S" "$WALK_NOTE"
    exit 3
    ;;
  *)
    printf '\n  \033[1;31m✗\033[0m FLOW-004 walk failed in %ss (%s)\n' "$TOTAL_WALL_S" "$WALK_NOTE"
    exit 1
    ;;
esac
