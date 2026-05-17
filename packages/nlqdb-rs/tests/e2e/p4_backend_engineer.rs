// P4 — Backend Engineer at a Small Startup (Rust flavour).
//
// Pre-shipped contract per SK-E2E-006. The Rust SDK is a Phase 2
// scaffold today (`src/lib.rs` returns "hello"); these tests are
// gated with `#[ignore]` until the SDK lands. When it does, the
// expected behaviour matches the TypeScript SDK's contract in
// tests/e2e/sdk/p4_backend_engineer.test.ts:
//
//   1. POST /v1/ask carries an Idempotency-Key on every mutation
//      (GLOBAL-005). Same key across SDK-level retries.
//   2. Transient 5xx is silently retried (GLOBAL-022).
//   3. 401 surfaces as a typed error (GLOBAL-009 sits above the SDK).
//
// To run when the SDK lands:
//
//     cd packages/nlqdb-rs
//     cargo test --test e2e -- --ignored
//
// Wiring into CI: extend `_e2e-sdk.yml` with a `rust` matrix cell
// alongside the TypeScript one. Not in CI today.

#[test]
#[ignore = "ships with Client implementation (Phase 2)"]
fn idempotency_key_on_every_mutation() {
    // let client = nlqdb::Client::new("sk_live_test");
    // let _ = client.ask("regression rows since last release", "db_e2e_p4").unwrap();
    // assert!(client.last_request_header("Idempotency-Key").is_some());
    panic!("not yet implemented");
}

#[test]
#[ignore = "ships with Client implementation (Phase 2)"]
fn same_idempotency_key_across_5xx_retries() {
    // 503 then 200 — verify two requests, same Idempotency-Key.
    panic!("not yet implemented");
}

#[test]
#[ignore = "ships with Client implementation (Phase 2)"]
fn surfaces_401_as_auth_error_without_retry() {
    // The consuming auth-wrapper refreshes; the SDK throws clearly
    // so the wrapper can act. SDK does not retry 401 internally.
    panic!("not yet implemented");
}
