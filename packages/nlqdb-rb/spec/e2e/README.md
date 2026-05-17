# Ruby SDK e2e — pre-shipped contract

Persona: P4 — Backend Engineer at a Small Startup (Ruby flavour).

Per [`SK-E2E-006`](../../../../docs/features/e2e-coverage/FEATURE.md#sk-e2e-006--future-sdk-scaffolds-ruby-rust-ship-test-skeletons-before-runtime-code), this directory ships **before** the Ruby SDK implementation. The specs are `pending` today. They lift when `lib/nlqdb.rb` gains a real `Nlqdb::Client` (Phase 2 in [`docs/phase-plan.md`](../../../../docs/phase-plan.md)).

## Why pre-ship the tests

GLOBAL-003 keeps surfaces from drifting at *capability-add* time but doesn't prevent a *future* surface from re-inventing its own interpretation of an already-shipped capability. Pre-shipping the test pins the contract: the Ruby SDK must match the TypeScript SDK's behaviour, not invent new semantics.

The reference contract is [`tests/e2e/sdk/p4_backend_engineer.test.ts`](../../../../tests/e2e/sdk/p4_backend_engineer.test.ts) — read it before implementing the Ruby `Client`.

## Run (Phase 2+)

```bash
cd packages/nlqdb-rb
bundle install
bundle exec rspec spec/e2e
```

## Not wired to CI

No `e2e-ruby.yml` workflow exists today. When the Ruby SDK lands, add one mirroring `.github/workflows/e2e-sdk.yml`.

## When to add a spec

Mirror the corresponding TypeScript test file under `tests/e2e/sdk/`. Each new persona test gets a matching `pN_<persona>_spec.rb` here.
