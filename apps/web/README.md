# apps/web — Astro marketing site

Phase 1. Static-first Astro deployed via Cloudflare **Workers Static
Assets** at `nlqdb.com`. Lighthouse target 100/100/100/100 (docs/architecture.md §10,
docs/architecture.md §3.1).

Currently shipping:

- `/` — wordmark + lede + 20-slide capability carousel + waitlist form
  (POST `/v1/waitlist`). Waitlist is a holding pattern; removed when
  sign-in UI + chat surface ship.
- `/manifesto` — long-form philosophy.
- `robots.txt`, `llms.txt`, hand-rolled `sitemap.xml`.
- JSON-LD `SoftwareApplication` on every page via `Base.astro`.
- Live `<nlq-data>` demo on the homepage, backed by `/v1/ask` with anonymous bearer (SK-WEB-008). Global anon cap (SK-ANON-010) keeps the LLM bill bounded; localStorage-backed prompt persistence (SK-ANON-011) survives the auth-redirect.

Phase 1 remaining:

- `/sign-in`, `/app`, `/auth/continue` — chat surface + magic-link UI
  (backend at `app.nlqdb.com` is ready).
- `/pricing`, `/docs`, `/blog`, `/showcase`.
- View Transitions morph from hero into chat.

## Local dev

```bash
bun install --cwd apps/web
bun run --cwd apps/web dev      # http://localhost:4321
bun run --cwd apps/web check    # astro check (typecheck)
bun run --cwd apps/web build    # static dist/
bun run --cwd apps/web preview  # serve dist/
```

## Deploy

Static `dist/` deployed to a Cloudflare **Worker** (`nlqdb-web`) via
Workers Static Assets at `nlqdb.com`. Configured in `wrangler.toml`.

```bash
bun run --cwd apps/web deploy
```

PR previews use Workers Versions with `--preview-alias pr-N`,
producing sticky `pr-N-nlqdb-web.<account>.workers.dev` URLs.

## Design tokens

`src/styles/global.css` — neo-brutalist + terminal per docs/architecture.md §3.1:
Acid Lime `#C6F432` on near-black `#0B0F0A`, JetBrains Mono headlines,
3px borders, 6px hard shadows, no rounding.
