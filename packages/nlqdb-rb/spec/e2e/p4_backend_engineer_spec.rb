# frozen_string_literal: true

# P4 — Backend Engineer at a Small Startup (Ruby flavour).
#
# Pre-shipped contract per SK-E2E-006. The Ruby SDK is a Phase 2
# scaffold today (lib/nlqdb.rb returns "hello"); these RSpec examples
# are `pending` until the SDK lands. When it does, the expected
# behaviour is exactly what the equivalent TypeScript SDK test asserts
# in tests/e2e/sdk/p4_backend_engineer.test.ts:
#
#   1. POST /v1/ask carries an Idempotency-Key header on every mutation
#      (GLOBAL-005). The same key is reused across SDK-level retries
#      so server-side dedupe collapses retries to one effect.
#   2. Transient 5xx is silently retried (GLOBAL-022).
#   3. 401 surfaces to the caller — the auth-wrapper layer above the
#      SDK refreshes (GLOBAL-009 lives at the auth layer, not the
#      HTTP layer).
#
# To run when the SDK lands:
#   cd packages/nlqdb-rb
#   bundle exec rspec spec/e2e
#
# Wiring into CI: extend `_e2e-sdk.yml` to spawn a `ruby` matrix cell
# alongside the TypeScript one. Not in CI today.

require "rspec"

RSpec.describe "P4 — Backend Engineer · Ruby SDK contract" do
  it "attaches Idempotency-Key on every mutation (GLOBAL-005)" do
    pending "ships with Nlqdb::Client implementation (Phase 2)"
    # client = Nlqdb::Client.new(api_key: "sk_live_test")
    # result = client.ask(goal: "regression rows since last release", db_id: "db_e2e_p4")
    # expect(client.last_request_headers["Idempotency-Key"]).to match(/^[A-Z0-9]{16,}$/)
    raise "not yet implemented"
  end

  it "retries the same call on transient 5xx with the same Idempotency-Key" do
    pending "ships with Nlqdb::Client implementation (Phase 2)"
    # 503 then 200 — verify two requests, same Idempotency-Key.
    raise "not yet implemented"
  end

  it "surfaces 401 as Nlqdb::AuthError without retry (GLOBAL-009 lives above)" do
    pending "ships with Nlqdb::Client implementation (Phase 2)"
    # The auth-wrapper refreshes; the SDK throws clearly so the wrapper can act.
    raise "not yet implemented"
  end
end
