#!/usr/bin/env bash
# nlqdb — FLOW-004 first-value seed-quality probe (SK-STRG-008 in
# docs/features/stranger-test/FEATURE.md).
#
# FLOW-004's own walker (scripts/flow-004-walk.sh) grades first-value
# quality for ONE goal per run (SK-STRG-006/007) and burns one of the
# 200/week SK-GATE-007 invites each time. That makes the doc's
# "first-value seed quality is prompt-variable" claim an anecdote — two
# hand-picked prompts, never a measured rate. This probe converts that
# anecdote into a number: it mints ONE invite, then re-uses it (invite
# codes are validated by KV existence in apps/api/src/gate/bypass.ts, not
# consumed) to issue a `create` ask per goal across a small persona set,
# grades each first-value with the SK-STRG-006 rubric, and reports the
# `seeded_ok_ratio` — the single metric behind the documented engine-quality
# bottleneck (what fraction of invited strangers get a seeded DB, not an
# empty one).
#
# Composition (mirrors scripts/stranger-test-invited.sh, SK-STRG-004):
#   1. scripts/flow-004-walk.sh with FLOW_004_INVITE_OUT=<sidecar> mints +
#      validates the invite end-to-end (control 403 + invite 200) and writes
#      the raw code to a mode-600 sidecar.
#   2. This script reads-and-wipes the code, then loops the goal set.
#
# Each goal uses a FRESH `anon_<uuid>` bearer so /v1/ask provisions a new DB
# (a `create`), the only shape whose seed quality is measurable.
#
# This is a MEASUREMENT, not a regression gate: it exits 0 whenever it
# produced a ratio (even 0/N), matching the SK-STRG-003 operator-loop
# philosophy (no founder-facing failure channel). It is deliberately NOT in
# the daily acquisition-health.yml cron — each run provisions N throwaway
# DBs, so it is agent-on-demand to keep Neon free-tier pressure bounded.
#
# Usage:
#   bash scripts/flow-004-seed-quality.sh                 # default 4-goal set
#   FLOW_SQ_GOALS=$'a budget tracker\na recipe box' \
#     bash scripts/flow-004-seed-quality.sh               # custom goals (one per line)
#   NLQDB_BASE_URL=https://preview.nlqdb.com bash scripts/flow-004-seed-quality.sh
#
# Per-run cost: ONE of the 200/week SK-GATE-007 invites + ONE Resend send +
# (1 + N) throwaway DBs (1 from the mint walk's invite probe, N from the loop).
#
# Output JSON: tools/stranger-test/results/flow-004-seed-quality-<utc>.json
# (gitignored). Shape: {utc, flow, base_url, invite_minted, total, ok,
# degraded, errored, seeded_ok_ratio, goals:[{goal, kind, quality, tables,
# rows, status}], notes}.
#
# Exit codes:
#   0  produced a ratio (measurement complete — even if 0/N seeded)
#   1  could not measure (no goal returned a classifiable create)
#   2  prereq missing (curl/jq), or invite mint failed
#   3  mint walk partial (gate bypassed, downstream non-200)
#   4  mint walk inconclusive (gate appears open globally — seed-quality of an
#      invited stranger is undefined when the gate isn't gating)

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

BASE_URL="${NLQDB_BASE_URL:-https://app.nlqdb.com}"

UTC_STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
RESULTS_DIR="tools/stranger-test/results"
OUT_PATH="${FLOW_SQ_OUT:-$RESULTS_DIR/flow-004-seed-quality-$UTC_STAMP.json}"

# --- display helpers (mirror scripts/flow-004-walk.sh) ---------------------
say()  { printf '\n\033[1;34m== %s ==\033[0m\n' "$*"; }
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[1;33m!\033[0m %s\n' "$*"; }
fail() { printf '  \033[1;31m✗\033[0m %s  — %s\n' "$1" "$2"; }

# Default goal set: four P1 solo-builder "build me X" prompts (create-shaped,
# directly comparable). Override with FLOW_SQ_GOALS (one goal per line).
DEFAULT_GOALS=$'a tiny CRM\na meal planner for couples\na habit tracker for my morning routine\na reading list for my book club'
GOALS_RAW="${FLOW_SQ_GOALS:-$DEFAULT_GOALS}"

# --- prerequisite check ----------------------------------------------------
for cmd in curl jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "prereq" "missing '$cmd' — install before running"
    exit 2
  fi
done

mkdir -p "$RESULTS_DIR"

# Sidecar holding the raw invite code; trap-removed on every exit path.
INVITE_SIDECAR="$RESULTS_DIR/.invite-sq-${UTC_STAMP}-$$.txt"
INVITE_CODE=""

# shellcheck disable=SC2317  # body is invoked via `trap cleanup EXIT INT TERM`
cleanup() {
  if [[ -f "$INVITE_SIDECAR" ]]; then rm -f "$INVITE_SIDECAR"; fi
  INVITE_CODE=""
}
trap cleanup EXIT INT TERM

# --- step 1: mint invite via flow-004-walk.sh ------------------------------
say "Step 1 — mint invite via flow-004-walk.sh"

FLOW_004_OUT="$RESULTS_DIR/flow-004-seed-quality-mint-${UTC_STAMP}.json" \
FLOW_004_INVITE_OUT="$INVITE_SIDECAR" \
  bash scripts/flow-004-walk.sh
MINT_EXIT=$?

if (( MINT_EXIT != 0 )); then
  # Propagate the mint walk's verdict: 2 prereq, 3 partial, 4 inconclusive.
  fail "flow-004-walk.sh exited $MINT_EXIT" "cannot measure seed quality without a verified invite"
  case "$MINT_EXIT" in
    2|3|4) exit "$MINT_EXIT" ;;
    *) exit 2 ;;
  esac
fi

if [[ ! -s "$INVITE_SIDECAR" ]]; then
  fail "invite sidecar missing" "flow-004 exited 0 but produced no code at $INVITE_SIDECAR"
  exit 2
fi

INVITE_CODE="$(cat "$INVITE_SIDECAR")"
rm -f "$INVITE_SIDECAR"

if [[ ! "$INVITE_CODE" =~ ^[A-Za-z0-9_-]{16,128}$ ]]; then
  fail "invite code shape" "did not match /[A-Za-z0-9_-]{16,128}/ (refusing to forward)"
  exit 2
fi
ok "invite minted (${#INVITE_CODE} chars); sidecar wiped"

# --- step 2: probe seed quality per goal -----------------------------------
say "Step 2 — probe first-value seed quality across the goal set"

GOAL_JSON="[]"
TOTAL=0
OK_COUNT=0
DEGRADED_COUNT=0
ERRORED_COUNT=0

while IFS= read -r GOAL; do
  [[ -z "$GOAL" ]] && continue
  TOTAL=$(( TOTAL + 1 ))

  UUID="$(cat /proc/sys/kernel/random/uuid 2>/dev/null || openssl rand -hex 16)"
  ANON_TOKEN="anon_${UUID}"
  ASK_BODY="$(jq -nc --arg g "$GOAL" '{goal:$g}')"

  STATUS="$(curl -sS --max-time 60 -o /tmp/flow-sq-body.$$ -w '%{http_code}' \
    -X POST "$BASE_URL/v1/ask" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ANON_TOKEN" \
    -H "X-Invite-Code: $INVITE_CODE" \
    -d "$ASK_BODY" 2>/dev/null || true)"
  STATUS="${STATUS:-0}"
  BODY="$(cat /tmp/flow-sq-body.$$ 2>/dev/null || true)"
  rm -f /tmp/flow-sq-body.$$

  KIND="unknown"
  QUALITY="errored"
  TABLES=0
  ROWS=0
  if [[ "$STATUS" == "200" ]]; then
    KIND="$(printf '%s' "$BODY" | jq -r 'if .kind=="create" then "create" elif .status=="ok" then "query" else "unknown" end' 2>/dev/null || echo unknown)"
    if [[ "$KIND" == "create" ]]; then
      # Same SK-STRG-006 rubric as flow-004-walk.sh: a real, seeded DB.
      C_DB="$(printf '%s' "$BODY" | jq -r '.db // ""' 2>/dev/null || true)"
      C_SCHEMA="$(printf '%s' "$BODY" | jq -r '.schemaName // ""' 2>/dev/null || true)"
      ROWS="$(printf '%s' "$BODY" | jq -r '(.sampleRows // []) | length' 2>/dev/null || echo 0)"
      TABLES="$(printf '%s' "$BODY" | jq -r '[(.sampleRows // [])[].table] | unique | length' 2>/dev/null || echo 0)"
      [[ "$ROWS" =~ ^[0-9]+$ ]] || ROWS=0
      [[ "$TABLES" =~ ^[0-9]+$ ]] || TABLES=0
      if [[ -n "$C_DB" && -n "$C_SCHEMA" && "$ROWS" -ge 1 ]]; then QUALITY="ok"; else QUALITY="degraded"; fi
      unset C_DB C_SCHEMA
    else
      # A `query` on a fresh principal is unexpected for FLOW-004 (no prior
      # DB); record it as a non-create outcome rather than seed quality.
      QUALITY="degraded"
    fi
  fi

  case "$QUALITY" in
    ok)       OK_COUNT=$(( OK_COUNT + 1 ));       ok "goal seeded OK — $TABLES tables / $ROWS rows" ;;
    degraded) DEGRADED_COUNT=$(( DEGRADED_COUNT + 1 )); warn "goal first-value DEGRADED (kind=$KIND, $TABLES tables / $ROWS rows, http=$STATUS)" ;;
    *)        ERRORED_COUNT=$(( ERRORED_COUNT + 1 )); warn "goal errored (http=$STATUS, kind=$KIND)" ;;
  esac

  GOAL_JSON="$(jq -c \
    --argjson acc "$GOAL_JSON" \
    --arg goal "$GOAL" \
    --arg kind "$KIND" \
    --arg quality "$QUALITY" \
    --argjson tables "$TABLES" \
    --argjson rows "$ROWS" \
    --argjson status "$STATUS" \
    -n '$acc + [{goal:$goal, kind:$kind, quality:$quality, tables:$tables, rows:$rows, status:$status}]')"

  # Gentle pacing so a burst of creates doesn't trip the rate limiter.
  sleep 2
done <<< "$GOALS_RAW"

INVITE_CODE=""

# seeded_ok_ratio is over goals that returned a classifiable create
# (ok + degraded); errored goals (network / non-200) are excluded so an
# upstream blip doesn't masquerade as a seeding failure.
CLASSIFIED=$(( OK_COUNT + DEGRADED_COUNT ))
if (( CLASSIFIED > 0 )); then
  RATIO="$(jq -nc --argjson ok "$OK_COUNT" --argjson n "$CLASSIFIED" '($ok / $n * 100 | round) / 100')"
else
  RATIO="null"
fi

NOTES="seeded_ok_ratio over $CLASSIFIED classified creates: $OK_COUNT ok, $DEGRADED_COUNT degraded, $ERRORED_COUNT errored (of $TOTAL goals)"

jq -nc \
  --arg utc "$UTC_STAMP" \
  --arg base "$BASE_URL" \
  --argjson total "$TOTAL" \
  --argjson ok "$OK_COUNT" \
  --argjson degraded "$DEGRADED_COUNT" \
  --argjson errored "$ERRORED_COUNT" \
  --argjson ratio "$RATIO" \
  --argjson goals "$GOAL_JSON" \
  --arg notes "$NOTES" \
  '{utc:$utc, flow:"FLOW-004", probe:"seed-quality", base_url:$base,
    invite_minted:true, total:$total, ok:$ok, degraded:$degraded,
    errored:$errored, seeded_ok_ratio:$ratio, goals:$goals, notes:$notes}' \
  > "$OUT_PATH"
ok "outcome JSON written to $OUT_PATH"

if (( CLASSIFIED == 0 )); then
  fail "FLOW-004 seed-quality" "no goal returned a classifiable create (all errored) — cannot report a ratio"
  exit 1
fi

printf '\n  \033[1;32m✓\033[0m FLOW-004 seed-quality: %s/%s goals seeded OK (ratio %s)\n' \
  "$OK_COUNT" "$CLASSIFIED" "$RATIO"
exit 0
