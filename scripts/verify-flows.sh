#!/usr/bin/env bash
# nlqdb — agent-runnable curl walks for FLOW-001/002/003 from
# docs/research/automated-icp-validation-plan-verification.md.
#
# What this covers (curl-only, the static no-credential subset of each flow):
#   FLOW-001 step 1+2 (homepage hero)
#   FLOW-002 step 1, 3, 4 (/solve/<slug> + FAQPage/HowTo JSON-LD + honest-limits)
#   FLOW-003 step 1, 2, 4, 9 (/vs/<slug> + h1 + FAQPage JSON-LD + /llms.txt)
#   FLOW-005 discovery (mcp.nlqdb.com OAuth metadata — precondition of
#                       the inspector handshake in walkthrough step 1;
#                       step 1's transport + steps 2-7 still need a
#                       real MCP client)
#   FLOW-008 source-health (HN / Reddit / GH / SO / IH / Dev.to / Bluesky / Mastodon — the cron upstreams)
# Steps that need a browser, OAuth, or an inbox stay in the verification
# mirror for the Playwright/FLOW-004+ pass; the script prints them as
# `· requires browser` so future agents see them and don't claim a pass.
#
# Mirrors the verify-secrets.sh style: ok / fail / skip per check,
# never prints anything that could leak a secret, exits non-zero on any
# failure so the cron / agent walk fails loudly. Each curl is capped at
# 15s so a stalled CDN can't hang the walk.

set -u

BASE_URL="${NLQDB_BASE_URL:-https://nlqdb.com}"
TIMEOUT_S=15
FAIL_COUNT=0

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

# --- display helpers ----------------------------------------------------

say()  { printf '\n\033[1;34m== %s ==\033[0m\n' "$*"; }
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
fail() { printf '  \033[1;31m✗\033[0m %s  — %s\n' "$1" "$2"; FAIL_COUNT=$((FAIL_COUNT + 1)); }
note() { printf '  \033[2m· %s\033[0m\n' "$*"; }

# Fetches a URL following redirects. On success: prints `ok`, sets
# FETCH_BODY_PATH to the tmp file, returns 0. On failure: prints `fail`
# (which increments FAIL_COUNT in this shell — must NOT be invoked from a
# $(...) subshell or the count is lost), clears FETCH_BODY_PATH, returns 1.
FETCH_BODY_PATH=""
fetch_body() {
  FETCH_BODY_PATH=""
  local label="$1" url="$2"
  local tmp status
  tmp="$(mktemp -t nlqdb-verify-flows.XXXXXX)"
  status=$(curl -sSL -m "$TIMEOUT_S" -o "$tmp" -w '%{http_code}' "$url" 2>/dev/null || true)
  if [[ "$status" != "200" ]]; then
    fail "$label" "GET $url (HTTP $status)"
    rm -f "$tmp"
    return 1
  fi
  ok "$label"
  FETCH_BODY_PATH="$tmp"
  return 0
}

# Asserts a grep -E pattern matches the body file at least once.
assert_match() {
  local label="$1" body_file="$2" pattern="$3"
  if grep -qE "$pattern" "$body_file"; then
    ok "$label"
  else
    fail "$label" "pattern not found: $pattern"
  fi
}

# Fetch a JSON URL with optional extra curl flags ($4..). On 200 sets
# FETCH_BODY_PATH (caller cleans up). On non-200 prints `fail`/`note`
# based on $3 ("fatal" or "advisory") and returns 1.
#
# Egress-policy aware: the agent's network may sit behind a managed-egress
# proxy that returns 403 + `x-block-reason: hostname_blocked` for any
# upstream the policy doesn't allow. The deployed Worker (the canonical
# probe) doesn't share that block, so we treat the sandbox-egress 403 as
# advisory regardless of the caller's severity choice.
fetch_json() {
  FETCH_BODY_PATH=""
  local label="$1" url="$2" severity="$3"; shift 3
  local tmp hdr status block_reason
  tmp="$(mktemp -t nlqdb-verify-flows.XXXXXX)"
  hdr="$(mktemp -t nlqdb-verify-flows-hdr.XXXXXX)"
  status=$(curl -sSL -m "$TIMEOUT_S" -D "$hdr" -o "$tmp" -w '%{http_code}' "$@" "$url" 2>/dev/null || true)
  block_reason=$(grep -i '^x-block-reason:' "$hdr" 2>/dev/null | head -1 | awk -F': *' '{print $2}' | tr -d '\r\n')
  rm -f "$hdr"
  if [[ "$status" == "200" ]]; then
    ok "$label (HTTP 200)"
    FETCH_BODY_PATH="$tmp"
    return 0
  fi
  if [[ -n "$block_reason" ]]; then
    note "$label (HTTP $status, x-block-reason=$block_reason — sandbox egress; Worker is canonical)"
  elif [[ "$severity" == "advisory" ]]; then
    note "$label (HTTP $status — advisory; not failing the walk)"
  else
    fail "$label" "expected HTTP 200, got $status"
  fi
  rm -f "$tmp"
  return 1
}

# Asserts a 307 → 200 redirect chain exists from a non-trailing-slash URL
# to the trailing-slash variant. Informational: catches the regression
# that bit the 2026-05-23 verification (curl without -L returned 0 bytes).
assert_trailing_slash_redirect() {
  local label="$1" url="$2"
  local redirect status
  status=$(curl -sS -m "$TIMEOUT_S" -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || true)
  redirect=$(curl -sS -m "$TIMEOUT_S" -o /dev/null -w '%{redirect_url}' "$url" 2>/dev/null || true)
  if [[ "$status" == "307" || "$status" == "308" || "$status" == "301" || "$status" == "302" ]]; then
    if [[ "$redirect" == "${url}/" ]]; then
      ok "$label (HTTP $status → $redirect)"
    else
      ok "$label (HTTP $status → $redirect — non-canonical target, still 3xx)"
    fi
  elif [[ "$status" == "200" ]]; then
    note "$label (HTTP 200 — no redirect; surface serves on both slashed/unslashed)"
  else
    fail "$label" "expected 3xx or 200, got HTTP $status"
  fi
}

# --- FLOW-001 — Anonymous-first happy path (steps 1+2) -------------------

say "FLOW-001 — homepage hero (curl-observable subset)"
if fetch_body "FLOW-001 step 1: GET / returns 200" "$BASE_URL/"; then
  assert_match \
    "FLOW-001 step 2: hero <form> placeholder matches /orders|tracker|building/i" \
    "$FETCH_BODY_PATH" \
    'placeholder="[^"]*(orders|tracker|building)[^"]*"'
  rm -f "$FETCH_BODY_PATH"
fi
note "FLOW-001 steps 3-9 require a browser (anon device token, /v1/ask POST, trace toggle, clipboard, follow-up)"

# --- FLOW-002 — Pain-driven AEO inbound (steps 1, 3, 4) ------------------

# The five /solve slugs shipped 2026-05-23 per SK-SOLVE-001 and the three
# /vs slugs from comparison-pages — kept as literal arrays on purpose: a
# drift between this file and apps/web/src/data/{solve,competitors}.ts
# fails the walk loudly, which is the regression detector we want.
SOLVE_SLUGS=(
  "cheap-internal-dashboard"
  "give-ai-agent-persistent-memory"
  "skip-postgres-setup-side-project"
  "natural-language-sql-without-training-data"
  "ship-leaderboard-no-sql"
)

say "FLOW-002 — /solve/<slug> (curl-observable subset, all ${#SOLVE_SLUGS[@]} slugs)"
for slug in "${SOLVE_SLUGS[@]}"; do
  # The deployed CDN serves the static AEO surface at the trailing-slash
  # URL; the unslashed form 307-redirects. Curl-only agents that don't
  # follow redirects see HTTP 307 + 0 bytes — record the redirect once
  # per walk so future verifiers don't re-discover it on every PR.
  assert_trailing_slash_redirect "FLOW-002 redirect probe ($slug)" "$BASE_URL/solve/$slug"
  if fetch_body "FLOW-002 step 1 GET /solve/$slug/ returns 200" "$BASE_URL/solve/$slug/"; then
    assert_match "FLOW-002 step 3 FAQPage JSON-LD present ($slug)"  "$FETCH_BODY_PATH" '"@type":\s*"FAQPage"'
    assert_match "FLOW-002 step 3 HowTo JSON-LD present ($slug)"     "$FETCH_BODY_PATH" '"@type":\s*"HowTo"'
    assert_match "FLOW-002 step 4 honest-limits section present ($slug)" "$FETCH_BODY_PATH" "What nlqdb doesn't do here"
    rm -f "$FETCH_BODY_PATH"
  fi
done
note "FLOW-002 steps 5-9 require a browser (CTA click, draft hydrate, /app/new rehydrate, event spy, first-query)"

# --- FLOW-003 — Comparison-driven inbound (steps 1, 2, 4, 9) -------------

VS_SLUGS=(   "supabase" "vanna"    "mem0" "outerbase" "wrenai"  "askyourdatabase"  )
VS_TITLES=(  "Supabase" "Vanna AI" "Mem0" "Outerbase" "Wren AI" "AskYourDatabase"  )

say "FLOW-003 — /vs/<slug> (curl-observable subset, all ${#VS_SLUGS[@]} slugs)"
for i in "${!VS_SLUGS[@]}"; do
  slug="${VS_SLUGS[$i]}"
  title="${VS_TITLES[$i]}"
  assert_trailing_slash_redirect "FLOW-003 redirect probe ($slug)" "$BASE_URL/vs/$slug"
  if fetch_body "FLOW-003 step 1 GET /vs/$slug/ returns 200" "$BASE_URL/vs/$slug/"; then
    assert_match "FLOW-003 step 2 <h1> matches 'nlqdb vs $title' ($slug)" "$FETCH_BODY_PATH" "<h1[^>]*>nlqdb vs $title</h1>"
    assert_match "FLOW-003 step 4 FAQPage JSON-LD present ($slug)" "$FETCH_BODY_PATH" '"@type":\s*"FAQPage"'
    rm -f "$FETCH_BODY_PATH"
  fi
done

say "FLOW-003 step 9 — /llms.txt enumerates every vs + solve slug"
if fetch_body "FLOW-003 step 9 GET /llms.txt returns 200" "$BASE_URL/llms.txt"; then
  for slug in "${VS_SLUGS[@]}"; do
    assert_match "  /llms.txt lists vs/$slug" "$FETCH_BODY_PATH" "/vs/$slug"
  done
  for slug in "${SOLVE_SLUGS[@]}"; do
    assert_match "  /llms.txt lists solve/$slug" "$FETCH_BODY_PATH" "/solve/$slug"
  done
  rm -f "$FETCH_BODY_PATH"
fi

# /sitemap.xml as the cheapest smoke test that the marketing-side build
# isn't a partial — 15 URLs today = SOLVE_ENTRIES.length (5) + COMPETITORS.length (6)
# + STATIC_ROUTES.length (4: "/", "/manifesto", "/vs", "/solve") per
# apps/web/src/pages/sitemap.xml.ts. The floor is hand-bumped against those data
# files; every new /solve/ or /vs/ slug raises it by one. `>=` means an
# under-bump leaks a regression silently rather than breaking the build.
say "Sitemap floor — every shipped slug must appear"
if fetch_body "GET /sitemap.xml returns 200" "$BASE_URL/sitemap.xml"; then
  loc_count=$(grep -oE '<loc>[^<]*</loc>' "$FETCH_BODY_PATH" | wc -l | tr -d ' ')
  if (( loc_count >= 15 )); then
    ok "/sitemap.xml has $loc_count <loc> entries (floor 15)"
  else
    fail "/sitemap.xml" "expected ≥15 <loc> entries, got $loc_count"
  fi
  rm -f "$FETCH_BODY_PATH"
fi

# --- Site-wide ?invite= capture (SK-GATE-007 / impl plan §3.3 amendment) -

# Press-launch URLs into /solve/<slug> and /vs/<slug> rely on Base.astro's
# bundled `captureInviteFromUrl()` to write the code into localStorage
# before the visitor clicks the CTA. The HTML references the bundle via
# `/_astro/Base.astro_astro_type_script_index_0_lang.<hash>.js`; the
# bundle must in turn contain the `nlqdb_invite` literal (the localStorage
# key invite.ts writes). One probe per surface (homepage + first solve +
# first vs) is enough: same Base.astro, same bundle.

# Bundle-name regex is Astro 5's current convention (`Base.astro_<rollup-tag>.<hash>.js`);
# a major Astro bump that renames the prefix will false-fail this — see the
# inline grep for `nlqdb_invite` (the real wiring assertion). Edit on bump.
say "Site-wide ?invite= capture — Base.astro bundled invite-capture is loaded"
INVITE_CAPTURE_PATHS=( "/" "/solve/${SOLVE_SLUGS[0]}/" "/vs/${VS_SLUGS[0]}/" )
declare -a BASE_BUNDLE_SRCS=()
for path in "${INVITE_CAPTURE_PATHS[@]}"; do
  if fetch_body "Base.astro invite-capture: GET $path" "$BASE_URL$path"; then
    bundle_src=$(grep -oE '/_astro/Base\.astro_[A-Za-z0-9_.-]+\.js' "$FETCH_BODY_PATH" | head -1)
    if [[ -z "$bundle_src" ]]; then
      fail "  Base.astro bundled <script> referenced on $path" "no /_astro/Base.astro_*.js src in HTML — site-wide capture regressed or Astro renamed the bundle prefix"
    else
      ok "  Base.astro bundled <script> referenced on $path"
      BASE_BUNDLE_SRCS+=("$bundle_src")
    fi
    rm -f "$FETCH_BODY_PATH"
  fi
done
# Same bundle across pages — verify once, then follow the `./invite.<hash>.js`
# import out of it to confirm the `nlqdb_invite` localStorage key literal
# survives Astro's minify (rollup keeps the string for `setItem`).
if (( ${#BASE_BUNDLE_SRCS[@]} > 0 )); then
  bundle_src="${BASE_BUNDLE_SRCS[0]}"
  if fetch_body "  Base.astro bundle GET $bundle_src" "$BASE_URL$bundle_src"; then
    invite_chunk=$(grep -oE '\./invite\.[A-Za-z0-9_.-]+\.js' "$FETCH_BODY_PATH" | head -1 | sed 's|^\./||')
    rm -f "$FETCH_BODY_PATH"
    if [[ -z "$invite_chunk" ]]; then
      fail "  Base.astro bundle invite-import" "no ./invite.*.js import — Base.astro <script> regressed or rollup renamed the chunk"
    elif fetch_body "  Base.astro → /_astro/$invite_chunk" "$BASE_URL/_astro/$invite_chunk"; then
      if grep -q 'nlqdb_invite' "$FETCH_BODY_PATH"; then
        ok "  invite-capture chunk preserves nlqdb_invite literal (site-wide capture wired)"
      else
        fail "  invite-capture chunk wiring" "no 'nlqdb_invite' literal — SK-GATE-007 site-wide capture regressed"
      fi
      rm -f "$FETCH_BODY_PATH"
    fi
  fi
  # Confirm every page references the same bundle hash (no Base.astro split
  # across routes — would break the single-source-of-truth assumption).
  uniq_count=$(printf '%s\n' "${BASE_BUNDLE_SRCS[@]}" | sort -u | wc -l | tr -d ' ')
  if (( uniq_count == 1 )); then
    ok "  All ${#BASE_BUNDLE_SRCS[@]} probed pages share the same Base.astro bundle"
  else
    fail "  Base.astro bundle uniqueness" "$uniq_count distinct bundle hashes across pages"
  fi
fi

# --- Invite-valve CORS preflight (SK-GATE-007) --------------------------

# The browser forwards the invite as `X-Invite-Code` on the cross-origin
# `/v1/ask` POST (apps/web/src/lib/api.ts). A custom request header makes
# the browser issue a CORS preflight; if the API's `Access-Control-Allow-
# Headers` omits `x-invite-code` the real fetch is aborted and every
# invited stranger silently 403s — a browser-only failure curl walkers
# miss because curl never preflights (this guard closes that gap). Skipped
# when web + API share an origin (preview/localhost: no preflight at all).
API_URL="${NLQDB_API_URL:-https://app.nlqdb.com}"
WEB_ORIGIN="${BASE_URL%/}"
say "Invite-valve CORS preflight — /v1/ask must allow X-Invite-Code (SK-GATE-007)"
if [[ "$API_URL" == "$WEB_ORIGIN" ]]; then
  note "web + API share origin ($WEB_ORIGIN) — browser issues no preflight; check skipped"
else
  cors_hdrs="$(mktemp -t nlqdb-verify-cors.XXXXXX)"
  cors_status=$(curl -sS -m "$TIMEOUT_S" -D "$cors_hdrs" -o /dev/null -X OPTIONS "$API_URL/v1/ask" \
    -H "Origin: $WEB_ORIGIN" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: content-type,x-invite-code" \
    -w '%{http_code}' 2>/dev/null || true)
  allow_hdrs="$(grep -i '^access-control-allow-headers:' "$cors_hdrs" | tr '[:upper:]' '[:lower:]' || true)"
  rm -f "$cors_hdrs"
  if [[ "$cors_status" != "204" && "$cors_status" != "200" ]]; then
    fail "invite-valve preflight" "OPTIONS $API_URL/v1/ask from $WEB_ORIGIN (HTTP $cors_status)"
  elif [[ "$allow_hdrs" == *x-invite-code* ]]; then
    ok "preflight allows x-invite-code (invited-browser first-value path open)"
  else
    fail "invite-valve preflight" "Access-Control-Allow-Headers omits x-invite-code — invited browser /v1/ask aborts"
  fi
fi

# --- FLOW-005 — MCP discovery (precondition of walkthrough step 1) -------

# The MCP server uses OAuth (RFC 9728 protected-resource + RFC 8414
# authorization-server metadata). The discovery endpoints are
# unauthenticated by design, so an agent VM with no `sk_mcp_*` key can
# still prove (a) the Worker is reachable, (b) it advertises the auth
# surface, (c) the JSON contract is intact. The MCP inspector consumes
# these endpoints during its own handshake — failing them blocks the
# walkthrough's step 1 outright.

MCP_URL="${NLQDB_MCP_URL:-https://mcp.nlqdb.com}"

say "FLOW-005 — MCP discovery (precondition of walkthrough step 1)"
mcp_pr_url="$MCP_URL/.well-known/oauth-protected-resource"
if fetch_json "FLOW-005 discovery: GET /.well-known/oauth-protected-resource" "$mcp_pr_url" fatal \
    -H "Accept: application/json"; then
  if grep -q "\"resource\":\"$MCP_URL\"" "$FETCH_BODY_PATH"; then
    ok "  MCP protected-resource advertises resource=$MCP_URL"
  else
    fail "  MCP protected-resource schema" "resource field missing or does not match $MCP_URL"
  fi
  rm -f "$FETCH_BODY_PATH"
fi
mcp_as_url="$MCP_URL/.well-known/oauth-authorization-server"
if fetch_json "FLOW-005 discovery: GET /.well-known/oauth-authorization-server" "$mcp_as_url" fatal \
    -H "Accept: application/json"; then
  if grep -q "\"issuer\":\"$MCP_URL\"" "$FETCH_BODY_PATH" \
      && grep -q '"authorization_endpoint"' "$FETCH_BODY_PATH" \
      && grep -q '"token_endpoint"' "$FETCH_BODY_PATH"; then
    ok "  MCP AS metadata carries issuer + authorization_endpoint + token_endpoint"
  else
    fail "  MCP AS metadata schema" "issuer/authorization_endpoint/token_endpoint missing"
  fi
  rm -f "$FETCH_BODY_PATH"
fi
note "FLOW-005 walkthrough steps 1-7 (inspector handshake, tools/list, create_database, ask, run) still require an authenticated MCP client and an sk_mcp_* key"

# --- FLOW-008 — Weekly ICP scrape source-health probe --------------------

# Same five upstreams the Mon 06:00 UTC cron in apps/api/src/icp-scrape.ts
# pulls from. Per SK-ICP-007 the probe is best-effort: HN/IH must answer;
# GH is fatal-when-GH_TOKEN-set, else skipped; Reddit + Stack Exchange
# may 403 with `x-block-reason: hostname_blocked` from a managed-egress
# proxy and fetch_json degrades that to an advisory note automatically
# (the Worker's Cloudflare IP is the only canonical probe for those two).

ICP_SEVEN_DAYS_AGO=$(date -u -d '7 days ago' +%s 2>/dev/null || date -u -v-7d +%s)

say "FLOW-008 — weekly ICP scrape source-health probe"

# HN Algolia: > must be %3E (curl sends literal otherwise → 400).
hn_url="https://hn.algolia.com/api/v1/search?query=text+to+sql&tags=story,comment&numericFilters=created_at_i%3E${ICP_SEVEN_DAYS_AGO}&hitsPerPage=10"
if fetch_json "FLOW-008 source HN Algolia /api/v1/search" "$hn_url" fatal; then
  if grep -q '"hits"' "$FETCH_BODY_PATH"; then
    ok "  HN response carries \"hits\" key (JSON schema unchanged)"
  else
    fail "  HN response schema" "no \"hits\" key in body"
  fi
  rm -f "$FETCH_BODY_PATH"
fi

# Reddit: advisory because www.reddit.com 403s most non-CF egress.
reddit_url="https://www.reddit.com/r/SaaS/search.json?q=retool+alternative&restrict_sr=on&sort=new&limit=5&t=week"
fetch_json "FLOW-008 source Reddit /r/SaaS/search.json" "$reddit_url" advisory \
  -A "nlqdb-icp-bot/1.0 (+https://nlqdb.com; contact: hello@nlqdb.com)" \
  && rm -f "$FETCH_BODY_PATH"

# GitHub Search Issues: only when GH_TOKEN is present locally (Worker
# always has it; the agent VM frequently does not).
if [[ -n "${GH_TOKEN:-}" ]]; then
  gh_url='https://api.github.com/search/issues?q=is:issue+%22text+to+sql%22+created:%3E2025-11-01&per_page=5'
  if fetch_json "FLOW-008 source GitHub /search/issues" "$gh_url" fatal \
      -H "Authorization: Bearer $GH_TOKEN" \
      -H "User-Agent: nlqdb-icp-bot" \
      -H "Accept: application/vnd.github+json"; then
    if grep -q '"total_count"' "$FETCH_BODY_PATH"; then
      ok "  GH response carries \"total_count\" key (JSON schema unchanged)"
    else
      fail "  GH response schema" "no \"total_count\" key in body"
    fi
    rm -f "$FETCH_BODY_PATH"
  fi

  # GitHub Discussions (GraphQL): same auth as Issues; one trivial query
  # proves the GraphQL endpoint still resolves the DISCUSSION type and
  # surfaces `rateLimit`. Worker pulls 5 queries/week × cost=1 (≪ 5000/hr).
  ghd_query='{"query":"query { search(query: \"text to sql\", type: DISCUSSION, first: 1) { discussionCount } rateLimit { remaining } }"}'
  if fetch_json "FLOW-008 source GitHub /graphql (Discussions)" "https://api.github.com/graphql" fatal \
      -X POST \
      -H "Authorization: Bearer $GH_TOKEN" \
      -H "User-Agent: nlqdb-icp-bot" \
      -H "Content-Type: application/json" \
      --data-raw "$ghd_query"; then
    if grep -q '"discussionCount"' "$FETCH_BODY_PATH"; then
      ok "  GH Discussions response carries \"discussionCount\" (GraphQL DISCUSSION type resolves)"
    else
      fail "  GH Discussions response schema" "no \"discussionCount\" key in body"
    fi
    rm -f "$FETCH_BODY_PATH"
  fi
else
  note "FLOW-008 source GitHub: skipped (GH_TOKEN not set in this shell — Worker still uses its bound secret)"
fi

# Stack Exchange: no auth; quota_remaining surfaces capacity. Like Reddit
# this can return 403 + x-block-reason from a sandbox-egress proxy — the
# fetch_json helper degrades that to an advisory note automatically.
so_url="https://api.stackexchange.com/2.3/search/advanced?site=stackoverflow&tagged=postgresql&q=setup&pagesize=5&fromdate=${ICP_SEVEN_DAYS_AGO}&sort=creation&order=desc"
if fetch_json "FLOW-008 source Stack Exchange /search/advanced" "$so_url" fatal --compressed; then
  quota=$(grep -oE '"quota_remaining":\s*[0-9]+' "$FETCH_BODY_PATH" | grep -oE '[0-9]+' | head -1)
  if [[ -n "$quota" ]]; then
    ok "  SO quota_remaining=$quota (300/IP/day cap; cron uses 5/week)"
  else
    fail "  SO response schema" "no quota_remaining in body"
  fi
  rm -f "$FETCH_BODY_PATH"
fi

# Indie Hackers: unofficial JSON Feed mirror.
ih_url="https://feed.indiehackers.world/posts.json?q=database&exclude=link-post"
if fetch_json "FLOW-008 source Indie Hackers /posts.json" "$ih_url" fatal \
    -H "User-Agent: nlqdb-icp-bot/1.0 (+https://nlqdb.com; contact: hello@nlqdb.com)" \
    -H "Accept: application/json"; then
  if grep -q '"items"' "$FETCH_BODY_PATH"; then
    ok "  IH response carries \"items\" key (JSON Feed schema unchanged)"
  else
    fail "  IH response schema" "no \"items\" key in body"
  fi
  rm -f "$FETCH_BODY_PATH"
fi

# Dev.to (Forem public API): top=7 is the server-side 7-day filter.
devto_url="https://dev.to/api/articles?tag=database&per_page=5&top=7"
if fetch_json "FLOW-008 source Dev.to /api/articles" "$devto_url" fatal \
    -H "User-Agent: nlqdb-icp-bot/1.0 (+https://nlqdb.com; contact: hello@nlqdb.com)" \
    -H "Accept: application/json"; then
  if grep -qE '^\s*\[' "$FETCH_BODY_PATH"; then
    ok "  Dev.to response is a JSON array (Forem articles schema unchanged)"
  else
    fail "  Dev.to response schema" "expected top-level JSON array"
  fi
  rm -f "$FETCH_BODY_PATH"
fi

# Bluesky (AT Protocol AppView): api.bsky.app is the no-auth read endpoint;
# public.api.bsky.app 403'd from this agent VM 2026-06-01 (BunnyCDN block;
# not re-verified from CF Workers egress — open question in icp-mining/FEATURE.md).
bsky_since="$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-7d +%Y-%m-%dT%H:%M:%SZ)"
bsky_url="https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=text+to+sql&limit=5&sort=latest&since=${bsky_since}"
if fetch_json "FLOW-008 source Bluesky /xrpc/app.bsky.feed.searchPosts" "$bsky_url" fatal \
    -H "User-Agent: nlqdb-icp-bot/1.0 (+https://nlqdb.com; contact: hello@nlqdb.com)" \
    -H "Accept: application/json"; then
  if grep -q '"posts"' "$FETCH_BODY_PATH"; then
    ok "  Bluesky response carries \"posts\" key (AppView searchPosts schema unchanged)"
  else
    fail "  Bluesky response schema" "no \"posts\" key in body"
  fi
  rm -f "$FETCH_BODY_PATH"
fi

# Mastodon (SK-ICP-013): mastodon.social /api/v1/timelines/tag/<tag> is a
# public unauthenticated read endpoint (300 req / 5 min per IP). robots.txt
# allows /api/v1/timelines/tag/* for non-GPTBot UAs; ours is nlqdb-icp-bot.
mast_url="https://mastodon.social/api/v1/timelines/tag/postgres?limit=5&local=false"
if fetch_json "FLOW-008 source Mastodon /api/v1/timelines/tag" "$mast_url" fatal \
    -H "User-Agent: nlqdb-icp-bot/1.0 (+https://nlqdb.com; contact: hello@nlqdb.com)" \
    -H "Accept: application/json"; then
  # Mastodon returns a top-level JSON array (status[]) per docs.joinmastodon.org.
  if grep -qE '^\s*\[' "$FETCH_BODY_PATH"; then
    ok "  Mastodon response is a JSON array (timelines/tag schema unchanged)"
  else
    fail "  Mastodon response schema" "expected top-level JSON array"
  fi
  rm -f "$FETCH_BODY_PATH"
fi

note "FLOW-008 cron-side checks (KV writes, evidence-file PUT, LogSnag publish) require the deployed Worker; this probe only proves upstream availability."

# --- summary ------------------------------------------------------------

echo ""
if (( FAIL_COUNT > 0 )); then
  printf '  \033[1;31m✗\033[0m verify-flows  — %d assertion(s) failed against %s\n' "$FAIL_COUNT" "$BASE_URL"
  exit 1
fi
printf '  \033[1;32m✓\033[0m verify-flows  — all curl-observable assertions passed against %s\n' "$BASE_URL"
