#!/usr/bin/env bash
# nlqdb — provision Cloudflare resources for apps/api and write their
# IDs into apps/api/wrangler.toml. Idempotent: safe to re-run.
#
# Resources (all on free tier through Phase 0):
#   KV namespace  : `nlqdb-cache`   → binding `KV`           (plan + session cache)
#   D1 database   : `nlqdb-app`     → binding `DB`           (users, audit log, app state)
#   Queue         : `nlqdb-events`  → binding `EVENTS_QUEUE` (product events)
#   R2 bucket     : `nlqdb-assets`  → binding `ASSETS`       (Stripe payload archive + future blobs)
#
# R2 service requires a one-time dashboard opt-in (account → R2 → Get
# Started). The script fails with a clear message if R2 hasn't been
# enabled yet; bucket creation is idempotent once the service is on.
#
# Reads CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID from .envrc.
# Writes resolved IDs back into wrangler.toml in place — those IDs
# are NOT secrets (they're CF-account-scoped public identifiers) and
# committing them keeps `wrangler dev` / CI deterministic.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

WRANGLER_TOML="apps/api/wrangler.toml"

KV_NAMESPACE="nlqdb-cache"
D1_DATABASE="nlqdb-app"
EVENTS_QUEUE="nlqdb-events"
R2_BUCKET="nlqdb-assets"

# --- display helpers ----------------------------------------------------

# Note: helper functions write to stderr because some are called inside
# `$(...)` capture sites (ensure_kv / ensure_d1 echo their resolved ID
# on stdout; their progress messages must not pollute that capture).
say()  { printf '\n\033[1;34m== %s ==\033[0m\n' "$*" >&2; }
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*" >&2; }
fail() { printf '  \033[1;31m✗\033[0m %s — %s\n' "$1" "$2" >&2; exit 1; }
info() { printf '  \033[2m· %s\033[0m\n' "$*" >&2; }

# --- preflight ----------------------------------------------------------

[[ -f .envrc ]] || fail "preflight" ".envrc not found at $REPO_ROOT — run scripts/bootstrap-dev.sh first"
[[ -f "$WRANGLER_TOML" ]] || fail "preflight" "$WRANGLER_TOML not found"
command -v wrangler >/dev/null 2>&1 || fail "preflight" "wrangler not installed — run scripts/bootstrap-dev.sh first"
command -v jq >/dev/null 2>&1 || fail "preflight" "jq not installed — run scripts/bootstrap-dev.sh first"
command -v python3 >/dev/null 2>&1 || fail "preflight" "python3 not installed — needed for in-place TOML edit"

# Source .envrc without echoing values.
set -a
# shellcheck disable=SC1091
source .envrc
set +a

[[ -n "${CLOUDFLARE_API_TOKEN:-}" ]] || fail "preflight" "CLOUDFLARE_API_TOKEN not set in .envrc"
[[ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]] || fail "preflight" "CLOUDFLARE_ACCOUNT_ID not set in .envrc"

# --- resolvers (list-then-create pattern → idempotent) ------------------

# get_kv_id <name>  → echoes namespace ID (empty string if not found)
get_kv_id() {
  wrangler kv namespace list 2>/dev/null \
    | jq -r --arg n "$1" '.[] | select(.title == $n) | .id' \
    | head -n1
}

# get_d1_id <name>  → echoes database UUID (empty string if not found)
get_d1_id() {
  wrangler d1 list --json 2>/dev/null \
    | jq -r --arg n "$1" '.[] | select(.name == $n) | .uuid' \
    | head -n1
}

# queue_exists <name>  → exit 0 if found, 1 otherwise. `wrangler queues
# list` returns a human-formatted table on stdout (no `--json` flag in
# wrangler 4.x), so we grep its output. The grep is anchored on the
# expected name token to avoid matching prefixes (`nlqdb-events` won't
# false-match if a future `nlqdb-events-dlq` lands).
queue_exists() {
  wrangler queues list 2>/dev/null \
    | grep -E "(^|[[:space:]│|])$1([[:space:]│|]|$)" >/dev/null
}

ensure_kv() {
  local name="$1" id
  id=$(get_kv_id "$name")
  if [[ -n "$id" ]]; then
    info "$name already exists ($id)"
  else
    wrangler kv namespace create "$name" >/dev/null
    id=$(get_kv_id "$name")
    [[ -n "$id" ]] || fail "$name" "created but list still doesn't show it"
    info "$name created ($id)"
  fi
  echo "$id"
}

ensure_d1() {
  local name="$1" id
  id=$(get_d1_id "$name")
  if [[ -n "$id" ]]; then
    info "$name already exists ($id)"
  else
    wrangler d1 create "$name" >/dev/null
    id=$(get_d1_id "$name")
    [[ -n "$id" ]] || fail "$name" "created but list still doesn't show it"
    info "$name created ($id)"
  fi
  echo "$id"
}

# Queues don't have a separate ID — the queue name IS the binding.
# `wrangler queues create` is idempotent in newer wrangler versions but
# still returns non-zero when the queue exists, so we gate creation on
# our own list check.
ensure_queue() {
  local name="$1"
  if queue_exists "$name"; then
    info "$name already exists"
  else
    wrangler queues create "$name" >/dev/null
    queue_exists "$name" || fail "$name" "created but list still doesn't show it"
    info "$name created"
  fi
}

# R2 buckets are name-bound (no ID). `wrangler r2 bucket info` returns
# non-zero when the bucket doesn't exist OR when R2 isn't enabled on the
# account. We try `info` first; on miss, attempt `create`; if that fails
# too, the operator hasn't done the one-time R2 opt-in.
ensure_r2() {
  local name="$1"
  if wrangler r2 bucket info "$name" >/dev/null 2>&1; then
    info "$name already exists"
    return
  fi
  if wrangler r2 bucket create "$name" >/dev/null 2>&1; then
    info "$name created"
    return
  fi
  fail "$name" "R2 not enabled on account — open https://dash.cloudflare.com → R2 → Get Started (one-time click), then re-run this script"
}

# --- update wrangler.toml id field for a given binding ------------------
# Replaces `id = "<old>"` (or empty) inside the [[<block>]] block whose
# `binding = "<binding>"` matches. No-op if the field is already set to
# the desired value.
update_toml_id() {
  local block="$1" binding="$2" id_field="$3" new_value="$4"
  python3 - "$WRANGLER_TOML" "$block" "$binding" "$id_field" "$new_value" <<'PY'
import re, sys
path, block, binding, id_field, new_value = sys.argv[1:]
with open(path) as f:
    text = f.read()

# Find the [[block]] block whose `binding = "<binding>"` matches, then
# replace the `<id_field> = "<...>"` line inside it.
block_re = re.compile(
    rf'(\[\[{re.escape(block)}\]\][^\[]*?binding\s*=\s*"{re.escape(binding)}"[^\[]*?){id_field}\s*=\s*"[^"]*"',
    re.MULTILINE | re.DOTALL,
)
new_text, count = block_re.subn(rf'\g<1>{id_field} = "{new_value}"', text)
if count == 0:
    sys.exit(f'no match for [[{block}]] block with binding="{binding}"')
if new_text != text:
    with open(path, 'w') as f:
        f.write(new_text)
PY
}

# --- main ---------------------------------------------------------------

say "Provisioning Cloudflare resources for apps/api + apps/events-worker"

KV_ID=$(ensure_kv "$KV_NAMESPACE")
D1_ID=$(ensure_d1 "$D1_DATABASE")
ensure_queue "$EVENTS_QUEUE"
ensure_r2 "$R2_BUCKET"

say "Updating $WRANGLER_TOML"

update_toml_id "kv_namespaces"  "KV"     "id"          "$KV_ID"
update_toml_id "d1_databases"   "DB"     "database_id" "$D1_ID"

ok "kv_namespaces.KV.id          → $KV_ID"
ok "d1_databases.DB.database_id  → $D1_ID"
ok "queues.producers.EVENTS_QUEUE → $EVENTS_QUEUE (no id; name-bound)"
ok "r2_buckets.ASSETS.bucket_name → $R2_BUCKET (no id; name-bound)"

say "Verify with: bun --cwd apps/api run build && bun --cwd apps/events-worker run build"
