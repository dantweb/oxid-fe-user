# ADR-003: SEO via build-time prerender snapshots, SSR kept as the upgrade path

**Status:** accepted (2026-10-15) · **Decides:** sprint 03 mechanism (follows ADR-001)

## Context

The SPA serves crawlers an empty shell. Candidates (sprint-03 plan): build-time
prerender/SSG, dynamic rendering for crawler user agents, or a Nuxt SSR migration.

## Decision

**Build-time prerendering** of the indexable routes (`/`, `/shop`, product pages), snapshotted
with the Playwright chromium already in the toolchain (`scripts/prerender.mjs`) from a `vite
preview` of the built app against the live shop. nginx serves the snapshot HTML; the SPA
hydrates over it. `scripts/generate-sitemap.mjs` builds `sitemap.xml` from the same storefront
query. Head/meta (`@unhead/vue`), JSON-LD `Product` and robots rules are runtime features and
work in every rendering model.

Why not the others now: dynamic rendering adds a service to operate for the same crawler-visible
result; Nuxt SSR is the recorded upgrade path (ADR-001 keeps plugins SSR-safe) and becomes
worth it when price/stock freshness in the crawler view or very large catalogs demand it.

## Consequences

- Prerender freshness = build cadence; re-run `npm run build:seo` on catalog changes (cron or
  shop webhook — ops decision).
- `/dashboard` (sprint 05), `/shop/cart` and `/login` are never prerendered, are `noindex`, and
  are disallowed in `robots.txt`.
- The prerenderer walks only the first catalog pages (`SEO_PRODUCT_LIMIT`, default 48); the
  sitemap lists what the prerenderer rendered — one route list, built once.
