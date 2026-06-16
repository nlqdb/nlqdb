#!/usr/bin/env bash
# nlqdb — funnel measurement puller for the /daily loop step 1.
#
# Why this exists: the daily loop regenerates docs/scorecard.md from the
# live funnel sources, but the canonical stores are reached over different
# transports and the obvious one is firewalled. The managed daily-run
# container blocks outbound Postgres TCP (:5432) — a direct `psql
# "$DATABASE_URL"` hangs and times out — while HTTPS (:443) is open. So
# every source here is pulled over HTTPS:
#
#   • registered users  → Cloudflare D1 `user` table (D1 HTTP query API)
#   • waitlist rows      → Cloudflare D1 `waitlist` table
#   • anon first-answers → Cloudflare D1 `databases.last_queried_at`
#   • invite-valve cap   → Workers KV `wl:invite-cap:<epoch-week>`
#   • Neon reachability  → Neon serverless HTTP `/sql` endpoint (ping)
#
# Canonical-source note: the registered-user count is the D1 `user` table
# (Better Auth), NOT the legacy Neon `users` table — the two disagree (the
# Neon copy carries stranger-test walker rows the gate flow never wrote to
# D1). The scorecard's "real strangers" number is the D1 one.
#
# Bot-filter: a genuine stranger is any email NOT matching $BOT_RX below —
# the stranger-test walker throwaway domains (mail.tm rotations), the
# preview/e2e/test accounts, and the founder/team addresses. Keep this
# regex in sync with the walker email shapes if new ones appear.
#
# Usage:
#   bash scripts/funnel-pull.sh            # human-readable summary
#   bash scripts/funnel-pull.sh --json     # machine-readable JSON
#
# Requires in env (all HTTPS-scoped, already present in the daily run):
#   CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN  (D1 + KV read)
#   DATABASE_URL                                 (Neon HTTP ping, optional)
#
# IDs are read from apps/api/wrangler.toml so they can't drift from deploy.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WRANGLER="$REPO_ROOT/apps/api/wrangler.toml"

JSON_OUT=0
[[ "${1:-}" == "--json" ]] && JSON_OUT=1

: "${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID}"
: "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN}"

# Emails that are NOT genuine strangers: walker throwaway domains,
# preview/e2e/debug/test accounts, and the founder/team. Anything else
# counts as a real outside signup.
BOT_RX='wshu\.net|web-library\.net|mail\.tm|@x\.com|example\.(com|test|dev)|@preview\.dev|javelin|threw_|debug@|e2e|browser-test|^test@|new_email@|salfati\.group|nlqdb\.(com|ai)|omer\.hochman@gmail\.com'

D1_ID="$(sed -n 's/^database_id *= *"\(.*\)"/\1/p' "$WRANGLER" | head -1)"
KV_ID="$(awk '/\[\[kv_namespaces\]\]/{f=1} f&&/^id *=/{gsub(/[" ]/,"",$3); print $3; exit}' "$WRANGLER")"
[[ -n "$D1_ID" ]] || { echo "could not read database_id from $WRANGLER" >&2; exit 2; }
[[ -n "$KV_ID" ]] || { echo "could not read kv namespace id from $WRANGLER" >&2; exit 2; }

CF="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}"

# Run one SQL statement against D1, print the `results` array as JSON.
d1() {
  jq -nc --arg sql "$1" '{sql:$sql}' \
    | curl -sS -m 30 -X POST "${CF}/d1/database/${D1_ID}/query" \
        -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
        -H "Content-Type: application/json" --data @- \
    | jq -e '.result[0].results' 2>/dev/null \
    || { echo "[]"; }
}

kv_get() {
  curl -sS -m 15 "${CF}/storage/kv/namespaces/${KV_ID}/values/$1" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" 2>/dev/null
}

# Split a list of emails into genuine vs bot, given the JSON results array.
count_real() { jq -r '.[].email' <<<"$1" | grep -ivcE "$BOT_RX" || true; }
count_all()  { jq -r 'length' <<<"$1"; }

# --- Registered users (D1 `user`, canonical) ---
USERS_J="$(d1 'SELECT email FROM user')"
USERS_ALL="$(count_all "$USERS_J")"
USERS_REAL="$(count_real "$USERS_J")"

# --- Waitlist (D1 `waitlist`) ---
WL_J="$(d1 'SELECT email FROM waitlist')"
WL_ALL="$(count_all "$WL_J")"
WL_REAL="$(count_real "$WL_J")"

# --- Anon DBs with a recorded first answer (D1 `databases`) ---
DB_J="$(d1 'SELECT COUNT(*) total, SUM(CASE WHEN last_queried_at IS NOT NULL AND last_queried_at>0 THEN 1 ELSE 0 END) answered FROM databases')"
DB_TOTAL="$(jq -r '.[0].total // 0' <<<"$DB_J")"
DB_ANSWERED="$(jq -r '.[0].answered // 0' <<<"$DB_J")"

# --- Invite-valve crossings this week (KV `wl:invite-cap:<epoch-week>`) ---
WEEK=$(( $(date -u +%s) / 604800 ))
INVITE_CUR="$(kv_get "wl:invite-cap:${WEEK}")"; INVITE_CUR="${INVITE_CUR:-0}"
INVITE_PREV="$(kv_get "wl:invite-cap:$((WEEK-1))")"; INVITE_PREV="${INVITE_PREV:-0}"
[[ "$INVITE_CUR" =~ ^[0-9]+$ ]] || INVITE_CUR=0
[[ "$INVITE_PREV" =~ ^[0-9]+$ ]] || INVITE_PREV=0

# --- Neon reachability (HTTP /sql; the legacy `users` table is informational) ---
NEON_OK="skipped"
if [[ -n "${DATABASE_URL:-}" ]]; then
  NEON_HOST="$(sed -E 's#postgresql://[^@]+@([^/]+)/.*#\1#' <<<"$DATABASE_URL")"
  NEON_CODE="$(curl -sS -m 20 -o /dev/null -w '%{http_code}' "https://${NEON_HOST}/sql" \
    -H "Neon-Connection-String: ${DATABASE_URL}" -H "Content-Type: application/json" \
    --data '{"query":"select 1","params":[]}' 2>/dev/null || echo "000")"
  [[ "$NEON_CODE" == "200" ]] && NEON_OK="ok" || NEON_OK="http_${NEON_CODE}"
fi

if [[ "$JSON_OUT" == 1 ]]; then
  jq -nc \
    --argjson users_all "$USERS_ALL" --argjson users_real "$USERS_REAL" \
    --argjson wl_all "$WL_ALL" --argjson wl_real "$WL_REAL" \
    --argjson db_total "$DB_TOTAL" --argjson db_answered "$DB_ANSWERED" \
    --argjson invite_cur "$INVITE_CUR" --argjson invite_prev "$INVITE_PREV" \
    --arg neon "$NEON_OK" --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{pulled_at:$at, users:{total:$users_all, real:$users_real},
      waitlist:{total:$wl_all, real:$wl_real},
      anon_dbs:{total:$db_total, first_answer:$db_answered},
      invite_valve:{week:$invite_cur, prev_week:$invite_prev, cap:200},
      neon_http:$neon}'
  exit 0
fi

cat <<EOF
funnel — pulled $(date -u +%Y-%m-%dT%H:%M:%SZ) (HTTPS sources; bot-filtered)
  registered users (D1 user)        ${USERS_REAL} real / ${USERS_ALL} total
  waitlist rows (D1 waitlist)       ${WL_REAL} real / ${WL_ALL} total
  anon DBs with first answer        ${DB_ANSWERED} / ${DB_TOTAL}
  invite-valve crossings (KV)       ${INVITE_CUR}/wk (prev ${INVITE_PREV}); cap 200
  neon http /sql reachability       ${NEON_OK}
EOF
