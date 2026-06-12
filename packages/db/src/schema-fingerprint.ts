// The one `schema_hash` fingerprint function. `schema_hash` is the plan-cache
// content-address (`GLOBAL-006`, `SK-SCHEMA-001`): a stable string per DB that
// changes whenever the schema does, so a cached plan stays valid exactly while
// the schema it was planned against is unchanged. Both schema sources hash
// through here so the column is one shape, not two — the hosted create path
// over the canonicalised `SchemaPlan` JSON (`build-deps.ts`), and the BYO
// connect path over the rendered `schema_text` (`SK-DB-015`).
//
// FNV-1a 32-bit: non-cryptographic, deterministic, allocation-free. The hash is
// a cache fingerprint, not a security boundary — we need stability across
// calls, not collision resistance against an adversary — so a fast 8-hex digest
// is the right tool. `charCodeAt` reads UTF-16 code units; that is fine because
// the only requirement is that equal strings hash equal and the function is
// pure, both of which hold.

export function fingerprintSchema(canonical: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    hash = (hash ^ canonical.charCodeAt(i)) >>> 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
