# DONE — Sprint 03: SEO for the SPA storefront

**Date:** 2026-10-15 · **Status:** delivered (S1–S3, S5–S7; S4 partial, below)

## Decision (S1 / ADR-003)

**Build-time prerender snapshots** (Playwright chromium over `vite preview`, against the live
shop), nginx serves the HTML, the SPA hydrates over it. Dynamic rendering rejected (extra
service, same result); Nuxt SSR stays the recorded upgrade path. `npm run build:seo` =
build → `generate-sitemap.mjs` → `prerender.mjs`; one route list feeds both
(`scripts/seo-lib.mjs`, unit-tested).

## What was built

- **Head/meta (S2):** `@unhead/vue`; titles + descriptions on home/catalog, full product meta +
  OpenGraph (`og:title/type/image`) on detail, reactive to the loaded product.
- **JSON-LD (S3):** schema.org `Product` with `Offer` (price, EUR, availability) on detail.
- **sitemap.xml (S5):** generated from the storefront catalog (`FRONTEND_ORIGIN`,
  `SEO_PRODUCT_LIMIT`); `robots.txt` (S6) allows `/shop`, disallows `/dashboard`, `/shop/cart`,
  `/login`; cart + login render `noindex,nofollow` meta.

## Verified (S7)

- **Crawler view without JS:** snapshot HTML contains the real product title
  (`<title>Destiny · OXID Storefront</title>`) and one JSON-LD block per product page —
  checked by grep over `dist/`, 8 routes prerendered in the test run.
- Playwright 4/4 (JSON-LD content, OG, noindex on cart/login + the sprint-02 flows);
  unit 11/11 (seo-lib: route list, urlset XML, escaping, snapshot paths); lint/types/knip green.

## Partial / open (S4)

- **Canonical URLs:** the SPA uses product-id routes; mapping to the shop's `oxseo` slugs (and
  301s from legacy Twig URLs) needs the storefront's SEO fields — specified as a small follow-up
  once checkout lands. hreflang pairs likewise pending a second-language route strategy.
- Lighthouse run not automated; the crawler-view grep + e2e meta assertions are the gate for now.
