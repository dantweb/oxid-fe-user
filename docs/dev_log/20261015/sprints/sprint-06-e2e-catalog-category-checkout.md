# Sprint 06 — e2e proof: catalog, category page, completed Stripe checkout

**Date:** 2026-10-15 · **Repo:** `dantweb/oxid-fe-user` (+ core if seams needed) · **Depends on:** 02–05
**Inspiration:** the Stripe module's Playwright suite
(`source/extensions/stripe/tests/e2e/playwright/`) — its hosted-Checkout card-fill helper,
test-card fixtures and `.env` credentials.

## Ask

Playwright must _prove_ three storefront capabilities end to end against the real shop:

1. **Catalog page** — products render with title/price/image; pagination pages through.
2. **Product category page** — does not exist yet (deferred in sprint 02): implement
   `/shop/category/:id` (storefront `category(categoryId)` +
   `products(filter: { category: { equals: $id } })`, verified) with category navigation on the
   catalog, then prove it.
3. **Checkout, completed** — beyond sprint 04's "reaches the PSP": pay on Stripe's hosted page
   with a test card (pattern from the Stripe module's `fillStripeCardDetailsWithCard` +
   `[data-testid=hosted-payment-submit-button]`), land back on the return view, see the order
   **committed with an order number**, and find it as **paid** in `/dashboard/orders`.

## Stories

| #   | Story                                                                                                                                                                                                                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Category page: `CATEGORY_QUERY` + category-filtered products; `CategoryView`; category links on the catalog; shared `ProductGrid` component (DRY with the catalog)                                                                                         |
| S2  | e2e env: copy credentials from the Stripe module's `.env` → `tests/e2e/.env` (gitignored) + committed `.env.dist`; dotenv loading in `playwright.config.ts`; fixtures (test user, Stripe test cards) env-overridable like the Stripe module's fixture file |
| S3  | `catalog.spec.ts` — cards content + pagination                                                                                                                                                                                                             |
| S4  | `category.spec.ts` — catalog → category → products of that category → product detail                                                                                                                                                                       |
| S5  | `checkout-stripe-complete.spec.ts` — full payment with a success test card, committed order, paid in dashboard                                                                                                                                             |
| S6  | Redeploy the public instance (prod image rebuild) and run the suite against `https://daniil.oxiddev.de:8443` too                                                                                                                                           |

## Acceptance

- All specs green locally (dev server) **and** against the public containerized instance.
- The category page is covered by the same quality gate (lint, types, knip; unit test for the
  plugin's new route).
- No hardcoded credentials in specs — fixtures + env only.
