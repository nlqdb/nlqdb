// `server-only` is a compile-time guard Next aliases internally (not a dependency);
// TS 6 checks side-effect imports by default (`noUncheckedSideEffectImports`).
declare module "server-only";
