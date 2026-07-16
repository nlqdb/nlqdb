#!/usr/bin/env bash
# nlqdb — mirror the founder-side canary OAuth credentials from .envrc to
# the `nlqdb-api-canary` Worker's own secret store. Idempotent (wrangler
# secret put overwrites). Never logs values; only secret names + lengths +
# OK/skip status.
#
# WHY a separate script (not mirror-secrets-gha.sh / -workers.sh):
# nothing in CI consumes these — the canary Worker is the sole destination,
# so they are deliberately NOT in the GHA mirror set. And the canary Worker
# has its OWN secret store distinct from prod's, so the prod-app mirror
# (mirror-secrets-workers.sh remote api → nlqdb-api) can't reach it either.
#
# NAME MAPPING (SK-AUTH-008): the founder's one `.envrc` holds BOTH the prod
# and canary OAuth pairs, so the canary halves carry a `CANARY_` prefix to
# tell the pairs apart on the founder's side. But per SK-AUTH-008 each Worker
# has its own secret store keyed by the SAME prod-slot names — Better Auth on
# the canary Worker (NODE_ENV=canary) reads `GOOGLE_CLIENT_ID`, not a
# canary-prefixed name. So this script maps founder-side CANARY_* → prod-slot:
#
#   CANARY_GOOGLE_CLIENT_ID          → GOOGLE_CLIENT_ID
#   CANARY_GOOGLE_CLIENT_SECRET      → GOOGLE_CLIENT_SECRET
#   CANARY_OAUTH_GITHUB_CLIENT_ID    → OAUTH_GITHUB_CLIENT_ID
#   CANARY_OAUTH_GITHUB_CLIENT_SECRET→ OAUTH_GITHUB_CLIENT_SECRET
#
# Unset CANARY_* names are skipped cleanly, so the script works with whatever
# subset of providers is registered; the live verification below only probes
# providers whose pair was present.
#
# Run on the founder's machine after registering the canary OAuth client(s)
# and adding the CANARY_* values to .envrc. See docs/runbook.md §4.
#
# Prereqs: bunx (install bun — https://bun.sh), a wrangler login with access
# to the `nlqdb-api-canary` Worker (CLOUDFLARE_API_TOKEN in .envrc, or
# `wrangler login`).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

APP_DIR="apps/api"
CANARY_HOST="https://nlqdb-api-canary.omer-hochman.workers.dev"

say()  { printf '\n\033[1;34m== %s ==\033[0m\n' "$*"; }
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
fail() { printf '  \033[1;31m✗\033[0m %s — %s\n' "$1" "$2"; }
skip() { printf '  \033[2m· skip %s (not set in .envrc)\033[0m\n' "$*"; }

# --- preflight ----------------------------------------------------------
[[ -f .envrc ]] || { fail "preflight" ".envrc not found at $REPO_ROOT — run scripts/bootstrap-dev.sh first"; exit 1; }
[[ -d "$APP_DIR" ]] || { fail "preflight" "$APP_DIR not found"; exit 1; }
command -v bunx >/dev/null 2>&1 || { fail "preflight" "bunx not installed — install bun (https://bun.sh)"; exit 1; }
command -v curl >/dev/null 2>&1 || { fail "preflight" "curl not installed"; exit 1; }

# Source .envrc without echoing.
set -a
# shellcheck disable=SC1091
source .envrc
set +a

# --- founder-side CANARY_* → canary Worker prod-slot name --------------
# Left = founder .envrc name, right = the name in the canary Worker's own
# secret store (SK-AUTH-008: prod-slot names, no canary prefix).
declare -a SOURCES=(
  CANARY_GOOGLE_CLIENT_ID
  CANARY_GOOGLE_CLIENT_SECRET
  CANARY_OAUTH_GITHUB_CLIENT_ID
  CANARY_OAUTH_GITHUB_CLIENT_SECRET
)
declare -a TARGETS=(
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  OAUTH_GITHUB_CLIENT_ID
  OAUTH_GITHUB_CLIENT_SECRET
)

say "Mirroring .envrc CANARY_* → nlqdb-api-canary Worker secret store"

# Defensive minimum: a real secret below this length is almost certainly
# truncation or .envrc corruption, not a real value. Mirrors the floor in
# mirror-secrets-gha.sh / -workers.sh — refuse rather than overwrite a
# working Worker secret with garbage.
SUSPICIOUSLY_SHORT=4

set_count=0
skip_count=0
fail_count=0
suspicious_count=0

for i in "${!SOURCES[@]}"; do
  src="${SOURCES[$i]}"
  target="${TARGETS[$i]}"
  val="${!src:-}"
  if [[ -z "$val" ]]; then
    skip "$src → $target"
    skip_count=$((skip_count + 1))
    continue
  fi
  # Refuse a value shorter than the floor — catches truncation / .envrc stubs.
  if [[ ${#val} -lt $SUSPICIOUSLY_SHORT ]]; then
    fail "$src" "value is only ${#val} chars — refusing to push (looks truncated; check .envrc)"
    suspicious_count=$((suspicious_count + 1))
    continue
  fi
  # Refuse an unexpanded shell reference — a single-quoted export NAME='$OTHER'
  # in .envrc (observed on CF_AI_TOKEN, 2026-06-10). Same guard as the sibling
  # mirror scripts.
  if [[ "$val" == \$* ]]; then
    fail "$src" "value starts with '\$' — looks like an unexpanded reference (fix .envrc quoting)"
    suspicious_count=$((suspicious_count + 1))
    continue
  fi
  # Stdin keeps the value out of argv / ps / shell history. Run from apps/api
  # so --config resolves wrangler.canary.toml (Worker nlqdb-api-canary).
  if printf '%s' "$val" | (cd "$APP_DIR" && bunx wrangler secret put "$target" --config wrangler.canary.toml) >/dev/null 2>&1; then
    ok "$src → $target (${#val} chars)"
    set_count=$((set_count + 1))
  else
    fail "$src → $target" "wrangler secret put failed — check CLOUDFLARE_API_TOKEN scope / wrangler login for nlqdb-api-canary"
    fail_count=$((fail_count + 1))
  fi
done

echo ""
say "Done"
ok "$set_count secret(s) mirrored to nlqdb-api-canary"
[[ $skip_count -gt 0 ]] && printf '  \033[2m· %d skipped (empty in .envrc — GitHub canary App not registered yet ⇒ expected)\033[0m\n' "$skip_count"
[[ $suspicious_count -gt 0 ]] && printf '  \033[1;31m✗ %d refused (value < %d chars — looks truncated)\033[0m\n' "$suspicious_count" "$SUSPICIOUSLY_SHORT"
[[ $fail_count -gt 0 ]] && printf '  \033[1;31m✗ %d failed — check wrangler auth for nlqdb-api-canary\033[0m\n' "$fail_count"
[[ $fail_count -gt 0 || $suspicious_count -gt 0 ]] && exit 1

# --- live verification (non-secret) -------------------------------------
# Confirms the canary Worker is up and that Better Auth now has a real Google
# provider configured. Neither probe sends or prints any secret value.
say "Live verification against $CANARY_HOST"

# 1. Health — the SK-AUTH-017 real-IdP API gate should answer 200.
health_status=$(curl -s -o /dev/null -w '%{http_code}' -m 15 "$CANARY_HOST/v1/health" 2>/dev/null || echo "000")
if [[ "$health_status" == "200" ]]; then
  ok "health: GET /v1/health → 200"
else
  fail "health" "GET /v1/health → HTTP $health_status (expected 200)"
fi

# 2. Google sign-in leg — Better Auth's POST /api/auth/sign-in/social returns
#    a JSON body with the provider authorization URL when the provider is
#    configured (e.g. {"url":"https://accounts.google.com/o/oauth2/...","redirect":true}).
#    An unconfigured provider errors instead, with no accounts.google.com URL.
social_body=$(curl -s -m 15 \
  -H "Content-Type: application/json" \
  -d '{"provider":"google","callbackURL":"/"}' \
  "$CANARY_HOST/api/auth/sign-in/social" 2>/dev/null || echo "")
if echo "$social_body" | grep -q 'accounts\.google\.com'; then
  ok "google sign-in: POST /api/auth/sign-in/social returns a google auth URL — PASS"
else
  fail "google sign-in" "no accounts.google.com URL in response — provider not configured on canary — FAIL"
  fail_count=$((fail_count + 1))
fi

# 3. GitHub sign-in leg — same probe, only when the pair was mirrored.
if [[ -n "${CANARY_OAUTH_GITHUB_CLIENT_ID:-}" ]]; then
  social_body=$(curl -s -m 15 \
    -H "Content-Type: application/json" \
    -d '{"provider":"github","callbackURL":"/"}' \
    "$CANARY_HOST/api/auth/sign-in/social" 2>/dev/null || echo "")
  if echo "$social_body" | grep -q 'github\.com/login/oauth'; then
    ok "github sign-in: POST /api/auth/sign-in/social returns a github auth URL — PASS"
  else
    fail "github sign-in" "no github.com/login/oauth URL in response — provider not configured on canary — FAIL"
    fail_count=$((fail_count + 1))
  fi
fi

echo ""
[[ $fail_count -gt 0 ]] && exit 1
exit 0
