#!/usr/bin/env bash
# nlqdb — provision Cloudflare resources for apps/api and write their
# IDs into apps/api/wrangler.toml. Idempotent: safe to re-run.
#
# Resources (all on free tier through Phase 0):
#   KV namespace  : `nlqdb-cache`   → binding `KV`     (plan + session cache)
#   D1 database   : `nlqdb-app`     → binding `DB`     (users, audit log, app state)
#
# R2 (`nlqdb-assets`) is deferred — requires a one-time click to enable
# on the Cloudflare dashboard and isn't on `/v1/ask`'s critical path.
# Will land in a later slice when blob storage is actually exercised.
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

say "Provisioning Cloudflare resources for apps/api"

KV_ID=$(ensure_kv "$KV_NAMESPACE")
D1_ID=$(ensure_d1 "$D1_DATABASE")

say "Updating $WRANGLER_TOML"

update_toml_id "kv_namespaces"  "KV"     "id"          "$KV_ID"
update_toml_id "d1_databases"   "DB"     "database_id" "$D1_ID"

ok "kv_namespaces.KV.id          → $KV_ID"
ok "d1_databases.DB.database_id  → $D1_ID"

say "Verify with: bun --cwd apps/api run build"
