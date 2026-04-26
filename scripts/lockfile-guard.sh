#!/usr/bin/env bash
# Per-package dependency allow-list enforcement.
#
# Reads .github/lockfile-allowlist.json and asserts none of the
# `forbidden` package names appear in the named workspace's
# `dependencies` or `devDependencies` (package.json — direct deps
# only). Direct-dep coverage catches the common case (someone PRs
# `import { Pool } from "pg"` in @nlqdb/llm and bun adds pg to its
# dependencies). Transitive auditing is a future tightening.
#
# Run locally: ./scripts/lockfile-guard.sh
# Wired into CI in .github/workflows/ci.yml.

set -euo pipefail

ALLOWLIST=".github/lockfile-allowlist.json"

if [[ ! -f "$ALLOWLIST" ]]; then
  echo "❌ $ALLOWLIST missing"
  exit 1
fi

violations=0

# shellcheck disable=SC2016
while IFS= read -r entry; do
  pkg_name=$(jq -r '.name' <<<"$entry")
  pkg_path=$(jq -r '.path' <<<"$entry")
  pkg_json="$pkg_path/package.json"

  if [[ ! -f "$pkg_json" ]]; then
    echo "⚠️  $pkg_json missing — skipping"
    continue
  fi

  while IFS= read -r dep; do
    [[ -z "$dep" ]] && continue
    if jq -e --arg d "$dep" '(.dependencies // {}) | has($d)' "$pkg_json" >/dev/null; then
      echo "❌ $pkg_name has forbidden dependency: $dep"
      violations=$((violations + 1))
    fi
    if jq -e --arg d "$dep" '(.devDependencies // {}) | has($d)' "$pkg_json" >/dev/null; then
      echo "❌ $pkg_name has forbidden devDependency: $dep"
      violations=$((violations + 1))
    fi
  done < <(jq -r '.forbidden[]?' <<<"$entry")
done < <(jq -c '.workspaces[]' "$ALLOWLIST")

if [[ $violations -gt 0 ]]; then
  echo ""
  echo "Total violations: $violations"
  echo "Edit $ALLOWLIST or remove the forbidden dep."
  exit 1
fi

echo "✅ all workspace packages clean — no forbidden direct deps"
