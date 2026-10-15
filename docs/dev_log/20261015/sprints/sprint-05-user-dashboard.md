# Sprint 05 — user account at `<shop-url>/dashboard`: pure SPA, excluded from SEO

**Date:** 2026-10-15 · **Repo:** `dantweb/oxid-fe-user` · **Status:** planned · **Depends on:** 02, 03 (robots/sitemap contract)

## Ask

The logged-in account area as a first-party plugin under `/dashboard` — deliberately a pure client-rendered
SPA: no prerendering, no sitemap entries, `noindex`, robots-disallowed (sprint 03 S6 already reserves
this). Everything behind core's `requiresAuth` guard; a guest hitting `/dashboard/**` is sent to login
with a redirect-back.

## Routes & features (all over graphql-storefront, via core's typed client)

| Route | Feature | Storefront API |
|---|---|---|
| `/dashboard` | overview: customer greeting, last orders, newsletter status | `customer`, `orders` |
| `/dashboard/orders`, `/dashboard/orders/:id` | order history + detail (positions, prices, delivery, payment used, order files/downloads if present) | `customer { orders }` |
| `/dashboard/addresses` | invoice address edit; delivery addresses list/add/delete | `customerInvoiceAddressSet`, `customerDeliveryAddressAdd/Delete` |
| `/dashboard/profile` | customer data, email change, password change | `customerEmailUpdate`, `customerPasswordChange` |
| `/dashboard/newsletter` | subscribe/unsubscribe | `newsletterOptIn/Unsubscribe` |
| `/dashboard/reviews` (optional) | my reviews, delete | `reviewSet/Delete` |
| `/dashboard/wishlist` (optional) | wished prices | `wishedPriceSet/Delete` |

## Stories

| # | Story |
|---|---|
| S1 | Dashboard plugin scaffold: routes (all `requiresAuth`), layout with account navigation, nav entry contributed to the host header for logged-in users |
| S2 | Orders list + detail (pagination; re-order = copy positions into the basket as a nice-to-have) |
| S3 | Addresses (zod validation from core, country list from the `countries` query) |
| S4 | Profile + password + newsletter |
| S5 | **SEO exclusion verified**: `noindex,nofollow` meta on every `/dashboard` route, robots.txt disallow, absent from sitemap and from the sprint-03 prerender route list — covered by an automated test so a later route addition cannot leak into the index |
| S6 | Session behavior: JWT auto-refresh (core), expiry modal preserving the in-progress form, logout clears tokens + guest-cart state correctly |
| S7 | Playwright: register → order (reuses sprint-04 flow) → see it under `/dashboard/orders`; address CRUD; password change re-login |

## Constraints

- No server rendering for any `/dashboard` route even after sprint 03 lands SSG/SSR for the catalog —
  the route group is explicitly excluded in the rendering config, not by convention.
- Personal data stays out of localStorage (tokens per core's auth policy; no cached order payloads).

## Acceptance

- Logged-in user manages orders, addresses, profile, newsletter end to end against the SDK shop.
- `curl` as Googlebot on `/dashboard` gets the shell with `noindex` (and robots.txt disallows it);
  the S5 automated test is green in CI.
