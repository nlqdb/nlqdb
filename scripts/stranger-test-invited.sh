#!/usr/bin/env bash
# nlqdb — invite-bearing stranger-test (SK-STRG-004 in
# docs/features/stranger-test/FEATURE.md).
#
# Composes the two existing acquisition walkers:
#
#   1. scripts/flow-004-walk.sh        — mints a SK-GATE-007 invite via a
#                                        throwaway mail.tm inbox + waitlist
#                                        signup; emits the raw code into
#                                        a mode-600 sidecar file
#   2. scripts/stranger-test.sh        — Playwright walker for FLOW-001 /
#                                        FLOW-002 / FLOW-003, now invoked
#                                        with --invite-code so the homepage
#                                        captures the code in localStorage
#                                        and the api.ts client forwards
#                                        X-Invite-Code on /v1/ask
#
# What this proves end-to-end: a stranger landing on the deployed surface
# WITH an invite gets a real first-value (HTTP 200) inside the same browser
# session that the §3 acquisition surfaces drive traffic to — not just the
# HTTP-observable subset FLOW-004 already covers. A regression in
# captureInviteFromUrl() (apps/web/src/lib/invite.ts) or in the X-Invite-Code
# header path now fails THIS walker, not the HTML surface checks.
#
# Per-run cost: ONE entry of the 200/week SK-GATE-007 invite cap, ONE Resend
# send (3k/mo free tier) — the invite is re-used across all walked flows.
#
# Usage:
#   bash scripts/stranger-test-invited.sh                          # default
#   bash scripts/stranger-test-invited.sh --flows flow-001         # one flow
#   NLQDB_BASE_URL=https://preview.nlqdb.com bash scripts/stranger-test-invited.sh
#
# Exit codes mirror the underlying walkers:
#   0   passed every walk (gate honoured the code through the browser path)
#   1   one or more walks failed (SK-GATE-007 regression OR static-surface
#       regression — stranger-test JSON carries the per-step trace)
#   2   prereq missing (curl/jq/openssl, or flow-004 prereq)
#   3   FLOW-004 partial (gate bypassed but /v1/ask non-200 downstream)
#   4   FLOW-004 inconclusive (gate appears globally open — invite-bearing
#       walks would also pass even on a SK-GATE-007 regression, so we
#       refuse to claim a green pass without the invariant)
#
# IMPORTANT: arguments after `--` are forwarded to scripts/stranger-test.sh
# unchanged; do NOT pass `--invite-code` here (this script supplies it).

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

# --- display helpers (mirror scripts/verify-flows.sh) ----------------------
say()  { printf '\n\033[1;34m== %s ==\033[0m\n' "$*"; }
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
fail() { printf '  \033[1;31m✗\033[0m %s  — %s\n' "$1" "$2"; }
note() { printf '  \033[2m· %s\033[0m\n' "$*"; }

UTC_STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
RESULTS_DIR="tools/stranger-test/results"
mkdir -p "$RESULTS_DIR"

# Sidecar file holding the raw invite code. Lives in the gitignored results
# dir; trap-removed on any exit path (including SIGINT between mint and
# read). Mode 600 written by flow-004-walk.sh via umask 077; we also unset
# the env var before forwarding to the Playwright runner so a misbehaving
# child can't read the path indirectly. Filename carries the PID so two
# concurrent composers on the same UTC second cannot collide on read.
INVITE_SIDECAR="$RESULTS_DIR/.invite-${UTC_STAMP}-$$.txt"
INVITE_CODE=""

cleanup() {
  if [[ -f "$INVITE_SIDECAR" ]]; then rm -f "$INVITE_SIDECAR"; fi
  # Best-effort scrub of the in-process variable too.
  INVITE_CODE=""
}
trap cleanup EXIT INT TERM

# --- step 1: mint invite via flow-004-walk.sh -----------------------------

say "Step 1 — mint invite via flow-004-walk.sh"

FLOW_004_OUT="$RESULTS_DIR/flow-004-invited-${UTC_STAMP}.json" \
FLOW_004_INVITE_OUT="$INVITE_SIDECAR" \
  bash scripts/flow-004-walk.sh
FLOW_004_EXIT=$?

if (( FLOW_004_EXIT != 0 )); then
  fail "flow-004-walk.sh exited $FLOW_004_EXIT" "see $RESULTS_DIR/flow-004-invited-${UTC_STAMP}.json"
  # 2 = prereq missing, 3 = partial (gate bypassed, downstream non-200),
  # 4 = inconclusive (gate globally open — invite mode would NOT prove
  # SK-GATE-007 either, so we propagate this rather than silently green).
  case "$FLOW_004_EXIT" in
    2|3|4) exit "$FLOW_004_EXIT" ;;
    *) exit 1 ;;
  esac
fi

if [[ ! -s "$INVITE_SIDECAR" ]]; then
  fail "invite sidecar missing" "flow-004 exited 0 but produced no code at $INVITE_SIDECAR"
  exit 1
fi

INVITE_CODE="$(cat "$INVITE_SIDECAR")"
# Remove the file immediately — the code now lives only in shell memory
# for the duration of the bunx invocation below. Re-trap-removed on exit
# in case the read raced anything.
rm -f "$INVITE_SIDECAR"

if [[ ! "$INVITE_CODE" =~ ^[A-Za-z0-9_-]{16,128}$ ]]; then
  fail "invite code shape" "did not match /[A-Za-z0-9_-]{16,128}/ (refusing to forward)"
  exit 1
fi
ok "invite minted (${#INVITE_CODE} chars); sidecar wiped"

# --- step 2: drive stranger-test.sh with the invite -----------------------

say "Step 2 — invite-bearing Playwright walks"

# Pass the code via env so it doesn't appear in the process-table argv
# row of any sibling process inspecting `/proc/<pid>/cmdline`. Unset
# FLOW_004_INVITE_OUT so the child can't read it back.
export NLQDB_INVITE_CODE="$INVITE_CODE"
unset FLOW_004_INVITE_OUT

WALK_OUT="$RESULTS_DIR/walk-invited-${UTC_STAMP}.json"
bash scripts/stranger-test.sh --out "$WALK_OUT" "$@"
STRANGER_EXIT=$?

unset NLQDB_INVITE_CODE
INVITE_CODE=""

# --- outcome ---------------------------------------------------------------

if (( STRANGER_EXIT == 0 )); then
  ok "invite-bearing walks passed — gate honoured the code through the browser path"
  ok "outcome JSON written to $WALK_OUT"
  exit 0
else
  fail "stranger-test.sh exited $STRANGER_EXIT" "see $WALK_OUT"
  exit "$STRANGER_EXIT"
fi
