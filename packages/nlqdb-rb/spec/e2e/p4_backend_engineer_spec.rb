# frozen_string_literal: true

# Pre-shipped contract per SK-E2E-006; mirror of tests/e2e/sdk/p4_backend_engineer.test.ts.

require "rspec"

RSpec.describe "P4 — Backend Engineer · Ruby SDK contract" do
  it "attaches Idempotency-Key on every mutation (GLOBAL-005)" do
    pending "ships with Nlqdb::Client implementation (Phase 2)"
    raise "not yet implemented"
  end

  it "retries the same call on transient 5xx with the same Idempotency-Key" do
    pending "ships with Nlqdb::Client implementation (Phase 2)"
    raise "not yet implemented"
  end

  it "surfaces 401 as Nlqdb::AuthError without retry" do
    pending "ships with Nlqdb::Client implementation (Phase 2)"
    raise "not yet implemented"
  end
end
