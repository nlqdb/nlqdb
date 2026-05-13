#!/usr/bin/env bash
# nlqdb — mirror .envrc to every remote secret store in one command:
# GitHub Actions + Cloudflare Workers (nlqdb-api + nlqdb-events-worker).
# Each step is independent; one failure doesn't stop the others, and
# the summary at the end shows what passed. For local `.dev.vars` or
# per-target runs, call the per-target scripts directly.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

say()  { printf '\n\033[1;34m== %s ==\033[0m\n' "$*"; }
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
fail() { printf '  \033[1;31m✗\033[0m %s\n' "$*"; }

declare -a results
run_step() {
  local label="$1"; shift
  say "$label"
  if "$@"; then
    results+=("ok|$label")
  else
    results+=("fail|$label")
  fi
}

run_step "GitHub Actions secrets" ./scripts/mirror-secrets-gha.sh
run_step "Worker nlqdb-api"       ./scripts/mirror-secrets-workers.sh remote api
run_step "Worker nlqdb-events-worker" ./scripts/mirror-secrets-workers.sh remote events-worker

echo ""
say "Summary"
fail_count=0
for r in "${results[@]}"; do
  label="${r#*|}"
  if [[ "$r" == ok\|* ]]; then
    ok "$label"
  else
    fail "$label"
    fail_count=$((fail_count + 1))
  fi
done

[[ $fail_count -gt 0 ]] && exit 1
exit 0
