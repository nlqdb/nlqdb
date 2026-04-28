#!/bin/sh
# Extracts the per-version preview URL from wrangler's ND-JSON output
# and writes `PREVIEW_URL=<url>` to $GITHUB_ENV for subsequent steps.
#
# Why this exists: cloudflare/wrangler-action@v3 doesn't populate the
# `deployment-url` step output for `versions upload` (cloudflare/
# wrangler-action#343). We bypass the action entirely (see
# preview-{api,web}.yml) and pin `WRANGLER_OUTPUT_FILE_DIRECTORY` to
# a known path so this script can find and parse the ND-JSON in a
# follow-up step.
#
# ND-JSON schema (workers-sdk/packages/wrangler/src/output.ts):
#   { version: 1, type: "version-upload",
#     worker_name, worker_tag, version_id,
#     preview_url, preview_alias_url, timestamp }
#
# Edge cases this script must survive (PR #49 review). Nothing here
# is theoretical — every guard maps to a failure mode the previous
# version of this script hit:
#
#   1. WRANGLER_OUTPUT_FILE_DIRECTORY unset → exit 0; comment step
#                                             falls back to dashboard.
#   2. Directory exists but is empty (no
#      wrangler-output-*.json files)        → URL stays empty.
#   3. ND-JSON parse error inside a file    → jq stderr discarded;
#                                             treat URL as empty.
#   4. No version-upload event in stream    → URL stays empty.
#   5. version-upload event present but
#      preview_url AND preview_alias_url
#      both null/missing                    → URL stays empty (the
#                                             "" fallback in jq).
#   6. Multiple wrangler-output-*.json files
#      (one per wrangler invocation)        → all files streamed,
#                                             slurped into one array,
#                                             first version-upload
#                                             wins.
#   7. jq emits the literal string "null"
#      because raw mode strips null         → guarded explicitly.

set -eu

# Source the directory from `WRANGLER_OUTPUT_FILE_DIRECTORY` (the
# wrangler CLI env var we set ourselves) with a fallback to
# `WRANGLER_OUTPUT_DIR` (the wrangler-action's internal name, kept
# for back-compat in case this script is ever invoked from
# postCommands again).
DIR="${WRANGLER_OUTPUT_FILE_DIRECTORY:-${WRANGLER_OUTPUT_DIR:-}}"
if [ -z "$DIR" ] || [ ! -d "$DIR" ]; then
  echo "wrangler output dir not set or missing — skipping preview-URL capture"
  exit 0
fi

# `find -exec cat {} +` handles the empty-match case cleanly — no
# literal-glob pitfall like `cat $DIR/wrangler-output-*.json` which
# prints "No such file" to stderr when the glob doesn't expand. `+`
# (vs `\;`) batches files into a single cat invocation and preserves
# NDJSON line boundaries.
#
# `2>/dev/null` on jq swallows parse errors so a malformed file
# degrades to "no URL captured" instead of failing the workflow.
#
# jq pipeline:
#   map(select(.type=="version-upload"))   keep events we care about
#   (first // {})                           first matching event, or
#                                           empty object if none
#   (.preview_url
#    // .preview_alias_url
#    // "")                                  prefer preview_url, fall
#                                           back to alias, empty
#                                           string when both missing
#
# `-rs` = raw output, slurp all input into one array. `|| true` on
# the whole pipeline catches the `set -e` trip if find/cat/jq exit
# non-zero (e.g. jq missing in PATH on a stripped runner).
URL=$(find "$DIR" -maxdepth 1 -type f -name 'wrangler-output-*.json' \
        -exec cat {} + 2>/dev/null \
      | jq -rs '
          map(select(.type=="version-upload"))
          | (first // {})
          | (.preview_url // .preview_alias_url // "")
        ' 2>/dev/null \
      || true)

# Guard against empty string AND the literal "null" jq sometimes
# emits in raw mode when the leaf value is null and `// empty`
# wasn't applied at the right point in the pipeline.
if [ -n "${URL:-}" ] && [ "$URL" != "null" ]; then
  echo "PREVIEW_URL=$URL" >> "$GITHUB_ENV"
  echo "Captured preview URL: $URL"
else
  echo "No version-upload event found in $DIR — comment step will fall back to dashboard pointer"
fi
