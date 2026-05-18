#!/usr/bin/env bash
# nlqdb — one-shot bootstrap for apps/mcp first-deploy prerequisites.
#
# What this does:
#   1. Provisions the `OAUTH_KV` namespace via `wrangler kv namespace
#      create OAUTH_KV` (idempotent — re-running prints the existing
#      id rather than re-creating).
#   2. Patches `apps/mcp/wrangler.toml` in place, replacing
#      `REPLACE_WITH_PROVISIONED_OAUTH_KV_ID` with the real id.
#
# Why a script (not CI): the KV namespace id is a one-time provision
# that has to land in source control before any deploy runs. CI
# cannot do it safely — a fresh runner has no way to tell "namespace
# exists, reuse" from "first run, create" without state, and racing
# parallel runs would risk multiple namespaces.
#
# Usage:
#   ./scripts/bootstrap-mcp.sh
#
# Requirements:
#   - CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID exported (or in
#     `.envrc` — direnv users get them for free).
#   - bun installed (calls `bunx wrangler`).
#
# After this script runs successfully, commit the wrangler.toml diff
# and merge — deploy-mcp.yml takes over from there.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WRANGLER_TOML="$REPO_ROOT/apps/mcp/wrangler.toml"
PLACEHOLDER="REPLACE_WITH_PROVISIONED_OAUTH_KV_ID"

if [ ! -f "$WRANGLER_TOML" ]; then
  echo "error: $WRANGLER_TOML not found" >&2
  exit 1
fi

if ! grep -q "$PLACEHOLDER" "$WRANGLER_TOML"; then
  echo "info: $WRANGLER_TOML already has a provisioned OAUTH_KV id — nothing to do."
  exit 0
fi

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN must be set (source .envrc or export it)}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID must be set (source .envrc or export it)}"

echo "→ Creating (or finding) OAUTH_KV namespace..."

# `wrangler kv namespace create` is idempotent at the API layer when
# the same title is requested — Cloudflare returns the existing id.
# But wrangler's CLI exits non-zero if the response shape isn't
# exactly "created" (older wrangler 4.x versions did), so prefer the
# explicit list-then-create flow.
#
# Title that wrangler generates by default: `<worker-name>-<binding>`.
# Our worker is `nlqdb-mcp-server`, binding is `OAUTH_KV`, so the
# title is `nlqdb-mcp-server-OAUTH_KV`.
TITLE="nlqdb-mcp-server-OAUTH_KV"

EXISTING_ID=$(cd "$REPO_ROOT" && bunx wrangler kv namespace list 2>/dev/null \
  | jq -r --arg t "$TITLE" '.[] | select(.title == $t) | .id' \
  | head -n1 || true)

if [ -n "${EXISTING_ID:-}" ]; then
  echo "  reusing existing namespace: $EXISTING_ID"
  KV_ID="$EXISTING_ID"
else
  echo "  creating new namespace: $TITLE"
  CREATE_OUTPUT=$(cd "$REPO_ROOT/apps/mcp" && bunx wrangler kv namespace create OAUTH_KV 2>&1)
  echo "$CREATE_OUTPUT"
  # wrangler 4.x output line: `id = "abc123..."` — extract the quoted id.
  KV_ID=$(echo "$CREATE_OUTPUT" | grep -oE 'id = "[a-f0-9]+"' | head -n1 | cut -d'"' -f2 || true)
  if [ -z "${KV_ID:-}" ]; then
    echo "error: could not parse KV namespace id from wrangler output above" >&2
    exit 1
  fi
fi

echo "→ Patching $WRANGLER_TOML..."
# `sed -i ''` is the macOS BSD form; `sed -i` is GNU. Detect and pick.
if sed --version >/dev/null 2>&1; then
  sed -i "s/$PLACEHOLDER/$KV_ID/" "$WRANGLER_TOML"
else
  sed -i '' "s/$PLACEHOLDER/$KV_ID/" "$WRANGLER_TOML"
fi

echo "✓ Done. Diff:"
echo
(cd "$REPO_ROOT" && git --no-pager diff -- apps/mcp/wrangler.toml || true)
echo
echo "Next steps:"
echo "  git add apps/mcp/wrangler.toml"
echo "  git commit -m 'bootstrap: provision OAUTH_KV namespace for apps/mcp'"
echo "  (merge to main → deploy-mcp.yml provisions mcp.nlqdb.com DNS + cert on first run)"
