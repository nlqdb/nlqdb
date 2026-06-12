#!/usr/bin/env bash
# nlqdb — FLOW-004 first-value seed-quality probe (SK-STRG-008 in
# docs/features/stranger-test/FEATURE.md).
#
# FLOW-004's own walker (scripts/flow-004-walk.sh) grades first-value
# quality for ONE goal per run (SK-STRG-006/007). That makes the doc's
# "first-value seed quality is prompt-variable" claim an anecdote — one
# hand-picked prompt, never a measured rate. This probe converts that
# anecdote into a number: it issues a `create` ask per goal across a small
# persona set (each on a fresh `anon_<uuid>` bearer so /v1/ask provisions a
# new DB), grades each first-value with the SK-STRG-006 rubric, and reports
# the `seeded_ok_ratio` — the single metric behind the documented
# engine-quality bottleneck (what fraction of strangers get a seeded DB,
# not an empty one).
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
# Per-run cost: N throwaway DBs (one per goal).
#
# Output JSON: tools/stranger-test/results/flow-004-seed-quality-<utc>.json
# (gitignored). Shape: {utc, flow, base_url, total, ok, degraded,
# provision_failed, errored, seeded_ok_ratio, goals:[{goal, kind,
# quality, tables, rows, status}], notes}. `provision_failed` counts goals
# whose create 422'd (engine couldn't build the DB); both it and `errored`
# are excluded from seeded_ok_ratio (which grades seed quality of a DB that
# WAS created), but provision_failed is reported separately so a hard
# build failure isn't hidden among upstream blips.
#
# Exit codes:
#   0  produced a ratio (measurement complete — even if 0/N seeded)
#   1  could not measure (no goal returned a classifiable create)
#   2  prereq missing (curl/jq)

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

# Reusable temp file for per-goal response bodies. `mktemp` (not a
# predictable `/tmp/...$$` path) avoids symlink/clobber races on a shared tmp.
BODY_TMP="$(mktemp "${TMPDIR:-/tmp}/flow-sq-body.XXXXXX")"

# shellcheck disable=SC2317  # body is invoked via `trap cleanup EXIT INT TERM`
cleanup() {
  if [[ -n "${BODY_TMP:-}" && -f "$BODY_TMP" ]]; then rm -f "$BODY_TMP"; fi
}
trap cleanup EXIT INT TERM

# --- probe seed quality per goal -------------------------------------------
say "Probe first-value seed quality across the goal set"

GOAL_JSON="[]"
TOTAL=0
OK_COUNT=0
DEGRADED_COUNT=0
PROVISION_FAILED_COUNT=0
ERRORED_COUNT=0

while IFS= read -r GOAL; do
  [[ -z "$GOAL" ]] && continue
  TOTAL=$(( TOTAL + 1 ))

  UUID="$(cat /proc/sys/kernel/random/uuid 2>/dev/null || openssl rand -hex 16)"
  ANON_TOKEN="anon_${UUID}"
  ASK_BODY="$(jq -nc --arg g "$GOAL" '{goal:$g}')"

  # Truncate first: `curl -o` does not clear the file on a connection
  # failure (it emits `000`), so a stale prior body could otherwise be read.
  : > "$BODY_TMP"
  STATUS="$(curl -sS --max-time 60 -o "$BODY_TMP" -w '%{http_code}' \
    -X POST "$BASE_URL/v1/ask" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ANON_TOKEN" \
    -d "$ASK_BODY" 2>/dev/null || true)"
  STATUS="${STATUS:-0}"
  BODY="$(cat "$BODY_TMP" 2>/dev/null || true)"

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
      # A non-`create` 200 (a `query` against a pre-existing DB, or an
      # unclassifiable shape) has no seed quality to grade, so it is excluded
      # from the ratio (counted as `errored`, not `degraded`) — the ratio is
      # over classified creates only, per SK-STRG-008.
      QUALITY="errored"
    fi
  elif [[ "$STATUS" == "422" ]]; then
    # The engine could not build the DB at all — the four DbCreateError kinds
    # that map to 422 in apps/api/src/index.ts formatCreateJsonResponse
    # (infer_failed / compile_failed / ddl_invalid / embed_failed; the API's
    # own `provision_failed` kind is a 500 — a different leg — so it is NOT one
    # of these). A HARDER first-value failure than `degraded`: the stranger
    # got an error, not even an empty DB. Bucketed separately so it
    # stays visible rather than hidden among true upstream blips. Still
    # excluded from seeded_ok_ratio per SK-STRG-008 (the ratio grades the seed
    # quality of a successfully-created DB, not whether the build succeeded).
    EKIND="$(printf '%s' "$BODY" | jq -r '.error.kind // ""' 2>/dev/null || true)"
    case "$EKIND" in
      infer_failed|compile_failed|ddl_invalid|embed_failed) QUALITY="provision_failed"; KIND="$EKIND" ;;
    esac
  fi

  case "$QUALITY" in
    ok)               OK_COUNT=$(( OK_COUNT + 1 ));       ok "goal seeded OK — $TABLES tables / $ROWS rows" ;;
    degraded)         DEGRADED_COUNT=$(( DEGRADED_COUNT + 1 )); warn "goal first-value DEGRADED (kind=$KIND, $TABLES tables / $ROWS rows, http=$STATUS)" ;;
    provision_failed) PROVISION_FAILED_COUNT=$(( PROVISION_FAILED_COUNT + 1 )); warn "goal PROVISION FAILED — engine couldn't build the DB (kind=$KIND, http=$STATUS); excluded from ratio" ;;
    *)                ERRORED_COUNT=$(( ERRORED_COUNT + 1 )); warn "goal not a gradable create — excluded from ratio (http=$STATUS, kind=$KIND)" ;;
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

# seeded_ok_ratio is over goals that returned a classifiable create
# (ok + degraded); everything else is excluded from the ratio so no
# non-seeding outcome masquerades as a seeding failure. The excluded set is
# split into two reported buckets: `provision_failed` (HTTP 422 — the engine
# couldn't build the DB at all; a harder failure than degraded, surfaced so
# it stays visible) and `errored` (true upstream blips — network failures,
# non-create 200s, other non-200s).
CLASSIFIED=$(( OK_COUNT + DEGRADED_COUNT ))
if (( CLASSIFIED > 0 )); then
  RATIO="$(jq -nc --argjson ok "$OK_COUNT" --argjson n "$CLASSIFIED" '($ok / $n * 100 | round) / 100')"
else
  RATIO="null"
fi

NOTES="seeded_ok_ratio over $CLASSIFIED classified creates: $OK_COUNT ok, $DEGRADED_COUNT degraded; excluded — $PROVISION_FAILED_COUNT provision_failed, $ERRORED_COUNT errored (of $TOTAL goals)"

jq -nc \
  --arg utc "$UTC_STAMP" \
  --arg base "$BASE_URL" \
  --argjson total "$TOTAL" \
  --argjson ok "$OK_COUNT" \
  --argjson degraded "$DEGRADED_COUNT" \
  --argjson provision_failed "$PROVISION_FAILED_COUNT" \
  --argjson errored "$ERRORED_COUNT" \
  --argjson ratio "$RATIO" \
  --argjson goals "$GOAL_JSON" \
  --arg notes "$NOTES" \
  '{utc:$utc, flow:"FLOW-004", probe:"seed-quality", base_url:$base,
    total:$total, ok:$ok, degraded:$degraded,
    provision_failed:$provision_failed, errored:$errored,
    seeded_ok_ratio:$ratio, goals:$goals, notes:$notes}' \
  > "$OUT_PATH"
ok "outcome JSON written to $OUT_PATH"

if (( CLASSIFIED == 0 )); then
  fail "FLOW-004 seed-quality" "no goal returned a classifiable create ($PROVISION_FAILED_COUNT provision_failed, $ERRORED_COUNT errored) — cannot report a ratio"
  exit 1
fi

printf '\n  \033[1;32m✓\033[0m FLOW-004 seed-quality: %s/%s goals seeded OK (ratio %s)\n' \
  "$OK_COUNT" "$CLASSIFIED" "$RATIO"
exit 0
