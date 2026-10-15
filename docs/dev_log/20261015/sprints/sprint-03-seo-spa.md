# Sprint 03 — resolving SEO for the SPA storefront

**Date:** 2026-10-15 · **Repo:** `dantweb/oxid-fe-user` · **Status:** planned · **Depends on:** 02

## Problem

A client-rendered SPA serves crawlers an empty shell: catalog and product pages — the pages that must
rank — have no server-delivered content, titles, or structured data. The research report flagged this as
the main cost of option A (SPA) vs option B (Nuxt SSR).

## Candidates to evaluate (decision = ADR-003)

| Option | How | Cost | Freshness |
|---|---|---|---|
| A. Build-time prerender / SSG | prerender `/shop`, category and product routes at build (vite-ssg or a Playwright-based prerenderer walking the sitemap), re-run on schedule/webhook | no runtime infra | stale between builds — price/stock must stay client-rendered islands |
| B. Dynamic rendering | nginx routes crawler UAs to a rendering service (headless Chrome, e.g. Rendertron-style), humans get the SPA | one extra service | always fresh; Google tolerates it, but it is an extra moving part to operate |
| C. SSR migration | promote the host to Nuxt 3 (plugins survive as Nuxt layers; core is framework-agnostic enough) | Node SSR runtime, biggest change | always fresh |

Evaluation criteria: catalog size of target shops, price/stock volatility, hosting constraints, team ops
capacity. Recommendation going in: **A for launch, C as the recorded upgrade path** — B only if A's
staleness is unacceptable and C is too big.

## Stories (independent of the chosen option)

| # | Story |
|---|---|
| S1 | ADR-003 written and decided; chosen mechanism implemented for `/shop/**` routes |
| S2 | **Meta/head management**: title, description, Open Graph per route from storefront data (`@unhead/vue`) |
| S3 | **Structured data**: JSON-LD `Product` (price, availability, review aggregate) and `BreadcrumbList` on product pages |
| S4 | **Canonical URLs**: the SPA's slugs align with the shop's `oxseo` SEO URLs so existing link equity and the shop's own sitemap semantics carry over; 301 strategy for legacy Twig URLs documented |
| S5 | **sitemap.xml** generated from the Storefront API (categories + products), served by nginx; regenerated with the prerender run |
| S6 | **robots.txt**: allow `/shop/**`, **disallow `/dashboard`** (contract with sprint 05); `noindex` meta on cart/checkout/account routes |
| S7 | **Verification**: Lighthouse SEO ≥ 90 on category + product pages; `curl` as Googlebot returns fully-rendered product HTML; hreflang pairs for en/de if the shop runs both languages |

## Known gap to budget

graphql-storefront does not expose everything SEO wants (CMS/content pages, thumbnails generation, full
SEO-URL mapping). S4/S5 may need a small shop-side GraphQL extension module — if so, it is specified here
and built additively, not hacked into the frontend.

## Acceptance

- A crawler with JS disabled receives complete HTML (title, meta, JSON-LD, product content) for
  `/shop`, a category and a product page.
- sitemap.xml validates and lists only indexable routes; `/dashboard` is excluded everywhere.
