#!/usr/bin/env bash
# Phase 2 exit-gate criterion (docs/phase-plan.md): "MCP installed in 3+
# distinct host apps." The data has been in D1 all along — sk_mcp keys
# carry a per-host claim (`mcp_host`, SK-MCP-004) and the principal
# middleware stamps `last_used_at` on real calls — so the gate needs a
# pinned query, not new telemetry. This is that query; the /daily
# scorecard (row #16) reads its summary lines.
#
# Split reported honestly, matching the row #4 method:
#   - "installed"  = an active (non-revoked) grant exists for the host
#   - "used"       = at least one grant answered an authenticated call
#   - stranger     = tenant email outside the founder/company/test set
#     (the same exclusion list the scorecard funnel rows pin)
#
# Needs the daily-loop Cloudflare credentials (wrangler remote D1).
set -euo pipefail
cd "$(dirname "$0")/../apps/api"

EXCLUDED_EMAILS="'omer.hochman@gmail.com','hi@nlqdb.com','omer@salfati.group','omer.hochman@bigpanda.io','test@example.com','e2e-test@preview.dev','browser-test@preview.dev','debug@example.com','myuser@example.com'"

bunx wrangler d1 execute nlqdb-app --remote --json --command "
SELECT k.mcp_host,
  COUNT(*) AS grants,
  SUM(CASE WHEN k.last_used_at IS NOT NULL THEN 1 ELSE 0 END) AS used_grants,
  MAX(CASE WHEN u.email IS NOT NULL AND u.email IN (${EXCLUDED_EMAILS}) THEN 1 ELSE 0 END) AS founder_or_test,
  MAX(datetime(k.last_used_at,'unixepoch')) AS last_used
FROM api_keys k LEFT JOIN user u ON u.id = k.tenant_id
WHERE k.key_type = 'sk_mcp' AND k.revoked_at IS NULL
GROUP BY k.mcp_host ORDER BY k.mcp_host" |
  python3 -c "
import json, sys
rows = json.load(sys.stdin)[0]['results']
for r in rows:
    who = 'founder/test' if r['founder_or_test'] else 'stranger'
    print(f\"{r['mcp_host']}: grants {r['grants']}, used {r['used_grants']}, {who}, last_used {r['last_used']}\")
installed = len(rows)
stranger_installed = sum(1 for r in rows if not r['founder_or_test'])
stranger_used = sum(1 for r in rows if not r['founder_or_test'] and r['used_grants'])
print(f'HOSTS_INSTALLED_ANY={installed}')
print(f'HOSTS_INSTALLED_STRANGER={stranger_installed}')
print(f'HOSTS_USED_STRANGER={stranger_used}')
print('GATE (3+ distinct stranger host apps):', 'PASS' if stranger_installed >= 3 else 'FAIL')
"
