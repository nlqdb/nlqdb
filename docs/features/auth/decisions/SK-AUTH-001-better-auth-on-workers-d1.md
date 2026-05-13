# SK-AUTH-001 — Better Auth on Workers + D1 is the auth library

- **Decision:** Identity is managed by Better Auth (MIT, TypeScript, framework-agnostic) running on Cloudflare Workers with D1 as the user store. We build the sign-in UI ourselves; Better Auth provides the primitives only.
- **Core value:** Free, Open source, Seamless auth, Bullet-proof
- **Why:** Better Auth has no per-MAU fees, no vendor lock on user data shape, and the Auth.js team merged into it in 2025 making it the de-facto TS standard. Workers + D1 keeps us inside the strict-$0 stack (`GLOBAL-013`). Building the sign-in page ourselves lets the auth surface express the brand instead of leaking a hosted-IdP look.
- **Consequence in code:** `packages/auth-internal` is the only thing that imports Better Auth; every other package consumes its primitives. New auth methods are added by extending the Better Auth config in `packages/auth-internal`, never by reaching for a parallel SDK.
- **Alternatives rejected:** Auth0 / Clerk / Supabase Auth — per-MAU fees break Free; data-shape lock-in conflicts with our identity-portability promise. Roll-your-own — `GLOBAL-016` rejects DIY when a small mature library exists.
- **Source:** docs/architecture.md §4.1
