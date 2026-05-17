# Rust SDK e2e — pre-shipped contract

Persona: P4 — Backend Engineer at a Small Startup (Rust flavour).

Per [`SK-E2E-006`](../../../../docs/features/e2e-coverage/FEATURE.md#sk-e2e-006--future-sdk-scaffolds-ruby-rust-ship-test-skeletons-before-runtime-code), this directory ships **before** the Rust SDK implementation. Tests are `#[ignore]`'d today and lift when `src/lib.rs` gains a real `Client` (Phase 2 in [`docs/phase-plan.md`](../../../../docs/phase-plan.md)).

## Why pre-ship the tests

Same rationale as the Ruby skeleton — pin the contract before the implementation re-derives it.

Reference contract: [`tests/e2e/sdk/p4_backend_engineer.test.ts`](../../../../tests/e2e/sdk/p4_backend_engineer.test.ts).

## Run (Phase 2+)

```bash
cd packages/nlqdb-rs
cargo test --test e2e -- --ignored
```

Cargo discovers integration tests in `tests/`; each `.rs` file there is its own test binary. The `--ignored` flag opts into the SK-E2E-006-tagged tests.

## Not wired to CI

No `e2e-rust.yml` workflow exists today. When the Rust SDK lands, add one mirroring `.github/workflows/e2e-sdk.yml`.

## When to add a spec

Mirror the corresponding TypeScript test file under `tests/e2e/sdk/`. Each new persona test gets a matching `pN_<persona>.rs` here.
