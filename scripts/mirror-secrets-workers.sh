#!/usr/bin/env bash
# nlqdb — mirror credentials from .envrc to a Cloudflare Worker
# runtime. Two modes × per-app secret subsets:
#
#   $0 local|remote <app>
#
# where <app> is one of:
#   api            → apps/api          (Worker nlqdb-api)
#   events-worker  → apps/events-worker (Worker nlqdb-events-worker)
#
# Each app declares its own runtime-secret subset in select_secrets()
# below. Adding a new app is one case-arm there + a worker dir on disk.
#
#   local   → write apps/<app>/.dev.vars from .envrc (gitignored,
#              read by `wrangler dev`).
#   remote  → push to the deployed Worker via
#              `wrangler versions secret bulk` (one atomic call,
#              idempotent — overwrites on re-run). The command forks
#              a NEW Worker version from the currently-deployed version
#              with the new secrets applied; this version is NOT
#              auto-deployed. The script prints the new version id and
#              auto-deploys it via `wrangler versions deploy <id>` so
#              the new secrets actually take effect. Use the legacy
#              `wrangler secret bulk` would mutate the latest-uploaded
#              version, which fails (CF API code 10214) whenever a PR
#              preview upload is ahead of the deployed version
#              (`SK-AUTH-014` / `SK-AUTH-018` produce these every PR).
#
# Never logs values; only secret names + lengths + OK/skip status.
#
# `GRAFANA_OTLP_AUTHORIZATION` is computed from
# `GRAFANA_CLOUD_INSTANCE_ID:GRAFANA_CLOUD_API_KEY` (Basic auth) so
# rotation stays on the pair, per IMPLEMENTATION §2.6.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

MODE="${1:-}"
APP="${2:-}"
case "$MODE" in
  local|remote) ;;
  *)
    echo "Usage: $0 local|remote <api|events-worker>" >&2
    echo "  local   write apps/<app>/.dev.vars from .envrc (for wrangler dev)" >&2
    echo "  remote  push to deployed Worker via wrangler secret bulk" >&2
    exit 2
    ;;
esac

case "$APP" in
  api)            APP_DIR="apps/api";           WORKER_NAME="nlqdb-api" ;;
  events-worker)  APP_DIR="apps/events-worker"; WORKER_NAME="nlqdb-events-worker" ;;
  *)
    echo "Usage: $0 local|remote <api|events-worker>" >&2
    echo "  unknown app: '$APP'" >&2
    exit 2
    ;;
esac

say()  { printf '\n\033[1;34m== %s ==\033[0m\n' "$*"; }
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
fail() { printf '  \033[1;31m✗\033[0m %s — %s\n' "$1" "$2"; }
skip() { printf '  \033[2m· skip %s (not set in .envrc)\033[0m\n' "$*"; }

# --- preflight ----------------------------------------------------------
[[ -f .envrc ]] || { fail "preflight" ".envrc not found at $REPO_ROOT — run scripts/bootstrap-dev.sh first"; exit 1; }
[[ -d "$APP_DIR" ]] || { fail "preflight" "$APP_DIR not found"; exit 1; }
command -v jq >/dev/null 2>&1 || { fail "preflight" "jq not installed — brew install jq"; exit 1; }
command -v base64 >/dev/null 2>&1 || { fail "preflight" "base64 not installed (should be in coreutils)"; exit 1; }
if [[ "$MODE" == "remote" ]]; then
  command -v wrangler >/dev/null 2>&1 || { fail "preflight" "wrangler not installed — bun install"; exit 1; }
fi

# Source .envrc without echoing.
set -a
# shellcheck disable=SC1091
source .envrc
set +a

# --- per-app Worker-runtime subset --------------------------------------
# What each app reads from c.env / Cloudflare.Env at request time. Keep
# in sync with the corresponding `apps/<app>/src/env.d.ts`. Secrets for
# slices not yet shipped are deliberately omitted until the slice that
# adds the runtime read.
select_secrets() {
  case "$APP" in
    api)
      SECRETS=(
        BETTER_AUTH_SECRET
        CLOUDFLARE_ACCOUNT_ID
        CF_AI_TOKEN
        DATABASE_URL
        GEMINI_API_KEY
        GROQ_API_KEY
        OPENROUTER_API_KEY
        OAUTH_GITHUB_CLIENT_ID
        OAUTH_GITHUB_CLIENT_SECRET
        OAUTH_GITHUB_CLIENT_ID_DEV
        OAUTH_GITHUB_CLIENT_SECRET_DEV
        GOOGLE_CLIENT_ID
        GOOGLE_CLIENT_SECRET
        GRAFANA_OTLP_ENDPOINT
        STRIPE_WEBHOOK_SECRET
        RESEND_API_KEY
      )
      ;;
    events-worker)
      SECRETS=(
        LOGSNAG_TOKEN
        LOGSNAG_PROJECT
        GRAFANA_OTLP_ENDPOINT
      )
      ;;
  esac
}
select_secrets

# Compute GRAFANA_OTLP_AUTHORIZATION from the instance + key pair.
# .envrc stores them separately for rotation independence; the Worker
# reads the assembled Basic-auth header. Empty string if either half
# is missing — Worker skips OTel install in that case.
GRAFANA_OTLP_AUTHORIZATION=""
if [[ -n "${GRAFANA_CLOUD_INSTANCE_ID:-}" && -n "${GRAFANA_CLOUD_API_KEY:-}" ]]; then
  encoded=$(printf '%s:%s' "$GRAFANA_CLOUD_INSTANCE_ID" "$GRAFANA_CLOUD_API_KEY" | base64 | tr -d '\n')
  # shellcheck disable=SC2034 # read indirectly via "${!name:-}" in the SECRETS loop
  GRAFANA_OTLP_AUTHORIZATION="Basic $encoded"
fi
SECRETS+=(GRAFANA_OTLP_AUTHORIZATION)

# Defensive minimum: anything shorter than this in a real-secret slot
# is almost certainly truncation or .envrc corruption. Refuse to push
# rather than silently overwrite a working Worker secret with garbage.
# Mirrors the floor in mirror-secrets-gha.sh; both scripts source the
# same .envrc and would catch the same incident class together.
SUSPICIOUSLY_SHORT=4

# Collect (name, value) pairs. Empty values get skipped, not pushed —
# pushing an empty string would mask a real value already on the Worker.
declare -a names
declare -a values
set_count=0
skip_count=0
suspicious_count=0
for name in "${SECRETS[@]}"; do
  val="${!name:-}"
  if [[ -z "$val" ]]; then
    skip "$name"
    skip_count=$((skip_count + 1))
    continue
  fi
  if [[ ${#val} -lt $SUSPICIOUSLY_SHORT ]]; then
    fail "$name" "value is only ${#val} chars — refusing to push (looks truncated; check .envrc)"
    suspicious_count=$((suspicious_count + 1))
    continue
  fi
  names+=("$name")
  values+=("$val")
  set_count=$((set_count + 1))
done

if [[ $suspicious_count -gt 0 ]]; then
  echo ""
  fail "preflight" "$suspicious_count secret(s) below ${SUSPICIOUSLY_SHORT}-char floor — aborting before any push to keep Worker state consistent"
  exit 1
fi

# --- local mode ---------------------------------------------------------
if [[ "$MODE" == "local" ]]; then
  say "Writing $APP_DIR/.dev.vars from .envrc"
  out="$APP_DIR/.dev.vars"
  tmp=$(mktemp)
  trap 'rm -f "$tmp"' EXIT
  {
    echo "# Generated by scripts/mirror-secrets-workers.sh local $APP"
    echo "# DO NOT EDIT — re-run the script after .envrc rotation."
    echo "# Gitignored. wrangler dev overlays this on top of [vars] in wrangler.toml."
    echo "NODE_ENV=development"
    for i in "${!names[@]}"; do
      printf '%s=%s\n' "${names[$i]}" "${values[$i]}"
    done
  } > "$tmp"
  mv "$tmp" "$out"
  trap - EXIT
  for name in "${names[@]}"; do
    val="${!name}"
    ok "$name (${#val} chars)"
  done
  echo ""
  say "Done"
  ok "$set_count secrets written to $out (NODE_ENV=development)"
  [[ $skip_count -gt 0 ]] && printf '  \033[2m· %d skipped (empty in .envrc — provision later)\033[0m\n' "$skip_count"
  echo ""
  echo "Run: bun run --cwd $APP_DIR dev"
fi

# --- remote mode --------------------------------------------------------
if [[ "$MODE" == "remote" ]]; then
  say "Pushing to Cloudflare Workers ($WORKER_NAME) via wrangler versions secret bulk"
  # Build JSON via jq's $ARGS.named — values arrive through fd-passed
  # --arg, never through argv. `versions secret bulk` reads the JSON
  # from stdin (no file arg), forks a new Worker version from the
  # currently-deployed version with the new secrets applied, and
  # prints the new version id. Nothing is deployed yet at this point.
  declare -a jq_args
  for i in "${!names[@]}"; do
    jq_args+=(--arg "${names[$i]}" "${values[$i]}")
  done
  json=$(jq -n "${jq_args[@]}" '$ARGS.named')
  upload_log=$(mktemp)
  trap 'rm -f "$upload_log"' EXIT
  if ! printf '%s' "$json" | (cd "$APP_DIR" && wrangler versions secret bulk) >"$upload_log" 2>&1; then
    cat "$upload_log"
    fail "wrangler versions secret bulk" "see error above; check CLOUDFLARE_API_TOKEN scope + wrangler login"
    exit 1
  fi
  cat "$upload_log"
  for name in "${names[@]}"; do
    val="${!name}"
    ok "$name (${#val} chars)"
  done
  # Extract the new version id from wrangler's output. Format (4.87+):
  # "Worker Version ID: <uuid>" on its own line.
  new_version=$(grep -Eo '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' "$upload_log" | tail -1 || true)
  rm -f "$upload_log"
  trap - EXIT
  if [[ -z "$new_version" ]]; then
    fail "version id" "could not parse new Worker version id from wrangler output — deploy manually with 'wrangler versions deploy'"
    exit 1
  fi

  echo ""
  say "Deploying new version ($new_version) via wrangler versions deploy"
  if (cd "$APP_DIR" && wrangler versions deploy "$new_version" --yes --message "secret rotation $(date -u +%Y-%m-%dT%H:%M:%SZ)") >/dev/null 2>&1; then
    ok "deployed $new_version to 100%"
  else
    fail "wrangler versions deploy" "secret-only version uploaded ($new_version) but not promoted; finish with: (cd $APP_DIR && wrangler versions deploy $new_version --yes)"
    exit 1
  fi

  echo ""
  say "Done"
  ok "$set_count secrets pushed and version $new_version deployed to Worker $WORKER_NAME"
  [[ $skip_count -gt 0 ]] && printf '  \033[2m· %d skipped (empty in .envrc — provision later)\033[0m\n' "$skip_count"
  echo ""
  echo "Verify with: (cd $APP_DIR && wrangler secret list)"
fi
