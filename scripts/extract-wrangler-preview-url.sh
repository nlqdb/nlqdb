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
# Diagnostic dump — without this, "no URL captured" gives no signal
# as to whether files were written, what their extension is, or what
# event types wrangler actually emitted. Print enough context to
# debug from the run log alone (PR #49 spent multiple commits failing
# silently because we couldn't see what the directory contained).
echo "::group::wrangler output directory contents"
ls -la "$DIR" 2>&1 || true
echo "::endgroup::"

# Match wrangler-output-* regardless of extension. Action source
# claims `.json`; older docs say ND-JSON; newer wrangler may emit
# `.ndjson`. Glob on the prefix only so we catch every variant.
FILES=$(find "$DIR" -maxdepth 1 -type f -name 'wrangler-output-*' 2>/dev/null || true)
if [ -z "$FILES" ]; then
  echo "no wrangler-output-* files in $DIR — comment step will fall back to dashboard pointer"
  exit 0
fi

# Dump distinct event types so a future "no URL captured" failure
# shows what wrangler did emit, not just what we hoped for.
echo "::group::distinct event types in wrangler-output-*"
# shellcheck disable=SC2086 # FILES is intentionally word-split
cat $FILES </dev/null 2>/dev/null | jq -rs 'map(.type) | unique' 2>&1 || true
echo "::endgroup::"

# Dump the full version-upload event so we can see whether
# preview_url is populated or undefined. The previous diagnostic
# round (commit 61255bb's run) confirmed the event type IS
# `version-upload` but the wrangler output had no "Worker Preview
# URL:" line — suggesting preview_url is missing in the event.
# This dump lets us verify and adjust the extraction without
# another diagnostic round-trip.
echo "::group::full version-upload event(s)"
# shellcheck disable=SC2086 # FILES is intentionally word-split
cat $FILES </dev/null 2>/dev/null | jq -s 'map(select(.type=="version-upload"))' 2>&1 || true
echo "::endgroup::"

# jq pipeline:
#   map(select(.type=="version-upload" or .type=="deploy"))
#                                          accept both — `versions
#                                          upload` should emit
#                                          `version-upload` per docs,
#                                          but wrangler 4.x may have
#                                          changed and `deploy` is
#                                          the next-most-likely shape.
#   (first // {})                          first matching event, or
#                                          empty object if none.
#   (.preview_url
#    // .preview_alias_url
#    // (.targets[0]? // ""))              prefer preview_url, then
#                                          alias, then `targets[0]`
#                                          (the deploy-event field).
#
# `-rs` = raw output + slurp. `|| true` traps a non-zero pipeline
# exit (e.g. jq missing) under `set -e`.
# Use `preview_url` / `preview_alias_url` from the event ONLY. When
# they're missing (the worker has never been `wrangler deploy`-ed,
# so its workers.dev subdomain isn't provisioned yet), do NOT
# construct a synthetic URL — per Cloudflare docs, until the worker
# is first deployed, NEITHER `<worker>.workers.dev` NOR
# `<version-prefix>-<worker>.workers.dev` actually route. A
# constructed URL would resolve to the "There is nothing here yet"
# placeholder, which is worse than no URL at all.
#
# Caller should fall back to dashboard-pointer message and surface
# the bootstrap-required state.
#   https://developers.cloudflare.com/workers/configuration/previews/
#
# shellcheck disable=SC2086 # FILES is intentionally word-split
EVENT=$(cat $FILES </dev/null 2>/dev/null \
        | jq -rs 'map(select(.type=="version-upload" or .type=="deploy")) | first // {}' \
        2>/dev/null || true)

URL=$(echo "$EVENT" | jq -r '.preview_url // .preview_alias_url // (.targets[0]? // "")' 2>/dev/null || true)

if [ -n "${URL:-}" ] && [ "$URL" != "null" ]; then
  echo "PREVIEW_URL=$URL" >> "$GITHUB_ENV"
  echo "Captured preview URL: $URL"
else
  # Diagnostic: show what fields the event actually has so a future
  # bootstrap-state mismatch surfaces immediately.
  WORKER_NAME=$(echo "$EVENT" | jq -r '.worker_name // "?"' 2>/dev/null || echo "?")
  VERSION_ID=$(echo "$EVENT" | jq -r '.version_id // "?"' 2>/dev/null || echo "?")
  echo "PREVIEW_BOOTSTRAP_NEEDED=1" >> "$GITHUB_ENV"
  echo "preview_url missing in version-upload event for worker=$WORKER_NAME version=$VERSION_ID"
  echo "this happens when the worker has never been \`wrangler deploy\`-ed."
  echo "first deploy provisions the *.workers.dev subdomain; future versions then get URLs."
fi
