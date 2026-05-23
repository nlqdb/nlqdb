#!/usr/bin/env bash
# nlqdb — agent-runnable curl walks for FLOW-001/002/003 from
# docs/research/automated-icp-validation-plan-verification.md.
#
# What this covers (curl-only, the static no-credential subset of each flow):
#   FLOW-001 step 1+2 (homepage hero)
#   FLOW-002 step 1, 3, 4 (/solve/<slug> + FAQPage/HowTo JSON-LD + honest-limits)
#   FLOW-003 step 1, 2, 4, 9 (/vs/<slug> + h1 + FAQPage JSON-LD + /llms.txt)
# Steps that need a browser, OAuth, or an inbox stay in the verification
# mirror for the Playwright/FLOW-004+ pass; the script prints them as
# `· requires browser` so future agents see them and don't claim a pass.
#
# Mirrors the verify-secrets.sh style: ok / fail / skip per check,
# never prints anything that could leak a secret, exits non-zero on any
# failure so the cron / agent walk fails loudly. Each curl is capped at
# 15s so a stalled CDN can't hang the walk.

set -u

BASE_URL="${NLQDB_BASE_URL:-https://nlqdb.com}"
TIMEOUT_S=15
FAIL_COUNT=0

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

# --- display helpers ----------------------------------------------------

say()  { printf '\n\033[1;34m== %s ==\033[0m\n' "$*"; }
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
fail() { printf '  \033[1;31m✗\033[0m %s  — %s\n' "$1" "$2"; FAIL_COUNT=$((FAIL_COUNT + 1)); }
note() { printf '  \033[2m· %s\033[0m\n' "$*"; }

# Fetches a URL following redirects. On success: prints `ok`, sets
# FETCH_BODY_PATH to the tmp file, returns 0. On failure: prints `fail`
# (which increments FAIL_COUNT in this shell — must NOT be invoked from a
# $(...) subshell or the count is lost), clears FETCH_BODY_PATH, returns 1.
FETCH_BODY_PATH=""
fetch_body() {
  FETCH_BODY_PATH=""
  local label="$1" url="$2"
  local tmp status
  tmp="$(mktemp -t nlqdb-verify-flows.XXXXXX)"
  status=$(curl -sSL -m "$TIMEOUT_S" -o "$tmp" -w '%{http_code}' "$url" 2>/dev/null || true)
  if [[ "$status" != "200" ]]; then
    fail "$label" "GET $url (HTTP $status)"
    rm -f "$tmp"
    return 1
  fi
  ok "$label"
  FETCH_BODY_PATH="$tmp"
  return 0
}

# Asserts a grep -E pattern matches the body file at least once.
assert_match() {
  local label="$1" body_file="$2" pattern="$3"
  if grep -qE "$pattern" "$body_file"; then
    ok "$label"
  else
    fail "$label" "pattern not found: $pattern"
  fi
}

# Asserts a 307 → 200 redirect chain exists from a non-trailing-slash URL
# to the trailing-slash variant. Informational: catches the regression
# that bit the 2026-05-23 verification (curl without -L returned 0 bytes).
assert_trailing_slash_redirect() {
  local label="$1" url="$2"
  local redirect status
  status=$(curl -sS -m "$TIMEOUT_S" -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || true)
  redirect=$(curl -sS -m "$TIMEOUT_S" -o /dev/null -w '%{redirect_url}' "$url" 2>/dev/null || true)
  if [[ "$status" == "307" || "$status" == "308" || "$status" == "301" || "$status" == "302" ]]; then
    if [[ "$redirect" == "${url}/" ]]; then
      ok "$label (HTTP $status → $redirect)"
    else
      ok "$label (HTTP $status → $redirect — non-canonical target, still 3xx)"
    fi
  elif [[ "$status" == "200" ]]; then
    note "$label (HTTP 200 — no redirect; surface serves on both slashed/unslashed)"
  else
    fail "$label" "expected 3xx or 200, got HTTP $status"
  fi
}

# --- FLOW-001 — Anonymous-first happy path (steps 1+2) -------------------

say "FLOW-001 — homepage hero (curl-observable subset)"
if fetch_body "FLOW-001 step 1: GET / returns 200" "$BASE_URL/"; then
  assert_match \
    "FLOW-001 step 2: hero <form> placeholder matches /orders|tracker|building/i" \
    "$FETCH_BODY_PATH" \
    'placeholder="[^"]*(orders|tracker|building)[^"]*"'
  rm -f "$FETCH_BODY_PATH"
fi
note "FLOW-001 steps 3-9 require a browser (anon device token, /v1/ask POST, trace toggle, clipboard, follow-up)"

# --- FLOW-002 — Pain-driven AEO inbound (steps 1, 3, 4) ------------------

# The five /solve slugs shipped 2026-05-23 per SK-SOLVE-001 and the three
# /vs slugs from comparison-pages — kept as literal arrays on purpose: a
# drift between this file and apps/web/src/data/{solve,competitors}.ts
# fails the walk loudly, which is the regression detector we want.
SOLVE_SLUGS=(
  "cheap-internal-dashboard"
  "give-ai-agent-persistent-memory"
  "skip-postgres-setup-side-project"
  "natural-language-sql-without-training-data"
  "ship-leaderboard-no-sql"
)

say "FLOW-002 — /solve/<slug> (curl-observable subset, all ${#SOLVE_SLUGS[@]} slugs)"
for slug in "${SOLVE_SLUGS[@]}"; do
  # The deployed CDN serves the static AEO surface at the trailing-slash
  # URL; the unslashed form 307-redirects. Curl-only agents that don't
  # follow redirects see HTTP 307 + 0 bytes — record the redirect once
  # per walk so future verifiers don't re-discover it on every PR.
  assert_trailing_slash_redirect "FLOW-002 redirect probe ($slug)" "$BASE_URL/solve/$slug"
  if fetch_body "FLOW-002 step 1 GET /solve/$slug/ returns 200" "$BASE_URL/solve/$slug/"; then
    assert_match "FLOW-002 step 3 FAQPage JSON-LD present ($slug)"  "$FETCH_BODY_PATH" '"@type":\s*"FAQPage"'
    assert_match "FLOW-002 step 3 HowTo JSON-LD present ($slug)"     "$FETCH_BODY_PATH" '"@type":\s*"HowTo"'
    assert_match "FLOW-002 step 4 honest-limits section present ($slug)" "$FETCH_BODY_PATH" "What nlqdb doesn't do here"
    rm -f "$FETCH_BODY_PATH"
  fi
done
note "FLOW-002 steps 5-9 require a browser (CTA click, draft hydrate, /app/new rehydrate, event spy, first-query)"

# --- FLOW-003 — Comparison-driven inbound (steps 1, 2, 4, 9) -------------

VS_SLUGS=(   "supabase" "vanna"     "mem0" )
VS_TITLES=(  "Supabase" "Vanna AI"  "Mem0" )

say "FLOW-003 — /vs/<slug> (curl-observable subset, all ${#VS_SLUGS[@]} slugs)"
for i in "${!VS_SLUGS[@]}"; do
  slug="${VS_SLUGS[$i]}"
  title="${VS_TITLES[$i]}"
  assert_trailing_slash_redirect "FLOW-003 redirect probe ($slug)" "$BASE_URL/vs/$slug"
  if fetch_body "FLOW-003 step 1 GET /vs/$slug/ returns 200" "$BASE_URL/vs/$slug/"; then
    assert_match "FLOW-003 step 2 <h1> matches 'nlqdb vs $title' ($slug)" "$FETCH_BODY_PATH" "<h1[^>]*>nlqdb vs $title</h1>"
    assert_match "FLOW-003 step 4 FAQPage JSON-LD present ($slug)" "$FETCH_BODY_PATH" '"@type":\s*"FAQPage"'
    rm -f "$FETCH_BODY_PATH"
  fi
done

say "FLOW-003 step 9 — /llms.txt enumerates every vs + solve slug"
if fetch_body "FLOW-003 step 9 GET /llms.txt returns 200" "$BASE_URL/llms.txt"; then
  for slug in "${VS_SLUGS[@]}"; do
    assert_match "  /llms.txt lists vs/$slug" "$FETCH_BODY_PATH" "/vs/$slug"
  done
  for slug in "${SOLVE_SLUGS[@]}"; do
    assert_match "  /llms.txt lists solve/$slug" "$FETCH_BODY_PATH" "/solve/$slug"
  done
  rm -f "$FETCH_BODY_PATH"
fi

# /sitemap.xml as the cheapest smoke test that the marketing-side build
# isn't a partial — 12 URLs today (5 solve + 3 vs + 4 root pages). The
# floor matches the shipped surface; new slugs raise it.
say "Sitemap floor — every shipped slug must appear"
if fetch_body "GET /sitemap.xml returns 200" "$BASE_URL/sitemap.xml"; then
  loc_count=$(grep -oE '<loc>[^<]*</loc>' "$FETCH_BODY_PATH" | wc -l | tr -d ' ')
  if (( loc_count >= 12 )); then
    ok "/sitemap.xml has $loc_count <loc> entries (floor 12)"
  else
    fail "/sitemap.xml" "expected ≥12 <loc> entries, got $loc_count"
  fi
  rm -f "$FETCH_BODY_PATH"
fi

# --- summary ------------------------------------------------------------

echo ""
if (( FAIL_COUNT > 0 )); then
  printf '  \033[1;31m✗\033[0m verify-flows  — %d assertion(s) failed against %s\n' "$FAIL_COUNT" "$BASE_URL"
  exit 1
fi
printf '  \033[1;32m✓\033[0m verify-flows  — all curl-observable assertions passed against %s\n' "$BASE_URL"
