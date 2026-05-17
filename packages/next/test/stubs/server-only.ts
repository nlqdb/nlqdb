// Test-only stub for Next.js' `server-only` package. In production
// the real module throws at compile time if imported from a client
// component; under vitest we just no-op so the source under test
// loads cleanly.
export {};
