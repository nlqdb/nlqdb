#!/usr/bin/env bash
# Deploy all dashboards in ops/grafana/dashboards/ to Grafana Cloud.
# Called from CI on merge to main. Also safe to run locally.
#
# Required env vars:
#   GRAFANA_DASHBOARD_TOKEN  — service account token with Editor role
#   GRAFANA_URL              — e.g. https://nlqdb.grafana.net
set -euo pipefail

: "${GRAFANA_DASHBOARD_TOKEN:?GRAFANA_DASHBOARD_TOKEN must be set}"
: "${GRAFANA_URL:?GRAFANA_URL must be set}"

DASHBOARDS_DIR="$(cd "$(dirname "$0")/dashboards" && pwd)"
failed=0

for f in "$DASHBOARDS_DIR"/nlqdb-*.json; do
  name=$(basename "$f")
  response=$(curl -s -w "\n%{http_code}" \
    -X POST "$GRAFANA_URL/api/dashboards/db" \
    -H "Authorization: Bearer $GRAFANA_DASHBOARD_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"dashboard\": $(cat "$f"), \"overwrite\": true, \"folderId\": 0}")
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | head -1)
  status=$(echo "$body" | jq -r '.status // "unknown"' 2>/dev/null || echo "parse-error")
  if [[ "$http_code" == "200" && "$status" == "success" ]]; then
    echo "✓ $name"
  else
    echo "✗ $name — HTTP $http_code: $body" >&2
    failed=1
  fi
done

exit $failed
