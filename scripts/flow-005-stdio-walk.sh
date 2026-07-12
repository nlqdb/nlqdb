#!/usr/bin/env bash
# nlqdb — agent-runnable FLOW-005 local-stdio-transport walker.
#
# Companion to scripts/flow-005-walk.sh: that one walks the *hosted*
# MCP discovery + auth-wall on mcp.nlqdb.com; this one walks the *local
# stdio* transport — the npm-fallback install path from SK-MCP-001 that
# a Claude Desktop / Cursor user runs when they paste a key into the
# host config instead of using the connector URL.
#
# It spawns the real `@nlqdb/mcp` binary and drives a real MCP
# `initialize` + `tools/list` handshake over OS pipes (no mocking, no
# network — both methods are served from the in-memory tool registry),
# then asserts the exact SK-MCP-002 tool catalog an MCP host discovers
# before it can call any tool (EXPECTED_TOOLS in flow-005-stdio.ts is the
# pinned contract; no create_database/ask/run tool — create is implicit
# via nlqdb_query). A regression here silently
# breaks every npm-fallback install. Tool *invocation* (which would
# authenticate) stays in the credentialed verification mirror.
#
# Usage:
#   bash scripts/flow-005-stdio-walk.sh
#   FLOW_005_STDIO_OUT=tools/stranger-test/results/flow-005-stdio-cron.json \
#     bash scripts/flow-005-stdio-walk.sh
#
# Side effects: spawns one short-lived child process; writes one JSON
# artifact. Exit 0 all assertions green · 1 a contract assertion failed
# · 2 the harness could not spawn or handshake.

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

ARGS=()
if [[ -n "${FLOW_005_STDIO_OUT:-}" ]]; then
  ARGS+=(--out "$FLOW_005_STDIO_OUT")
fi

exec bun tools/stranger-test/src/flow-005-stdio.ts "${ARGS[@]}"
