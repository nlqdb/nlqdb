#!/bin/sh
# Extracts the per-version preview URL from wrangler's ND-JSON output
# and writes `PREVIEW_URL=<url>` to $GITHUB_ENV for subsequent steps.
#
# Why this exists: cloudflare/wrangler-action@v3 doesn't populate the
# `deployment-url` step output for `versions upload` (cloudflare/
# wrangler-action#343). The action sets WRANGLER_OUTPUT_DIR in its
# child-process env to a unique temp dir, so we can only read the
# ND-JSON from inside the action's own step — that means via
# `postCommands`. The action's `postCommands` runs each newline-
# separated entry as its own `sh -c`, so multi-line if/fi blocks
# don't work; this script gets called as one line instead.
#
# ND-JSON schema (workers-sdk/packages/wrangler/src/output.ts):
#   { version: 1, type: "version-upload",
#     worker_name, worker_tag, version_id,
#     preview_url, preview_alias_url, timestamp }

set -eu

# Source the directory from `WRANGLER_OUTPUT_FILE_DIRECTORY` (the
# wrangler CLI env var we set ourselves) with a fallback to
# `WRANGLER_OUTPUT_DIR` (the wrangler-action's internal name, kept for
# back-compat in case this script is ever invoked from postCommands).
DIR="${WRANGLER_OUTPUT_FILE_DIRECTORY:-${WRANGLER_OUTPUT_DIR:-}}"
if [ -z "$DIR" ] || [ ! -d "$DIR" ]; then
  echo "wrangler output dir not set or missing — skipping preview-URL capture"
  exit 0
fi

# `cat` reads stdin if the glob doesn't match; redirect stdin from
# /dev/null defensively. `jq -rs` slurps every event into an array;
# `select(.type==...)` filters; `first` takes the head.
URL=$(cat "$DIR"/wrangler-output-*.json </dev/null 2>/dev/null \
  | jq -rs 'map(select(.type=="version-upload")) | first | .preview_url // .preview_alias_url // empty' \
  || true)

if [ -n "$URL" ] && [ "$URL" != "null" ]; then
  echo "PREVIEW_URL=$URL" >> "$GITHUB_ENV"
  echo "Captured preview URL: $URL"
else
  echo "No version-upload event found in $WRANGLER_OUTPUT_DIR; falling back to dashboard pointer"
fi
