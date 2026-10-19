# Architecture — oxid-fe-user / oxid-fe-core

```
browser ──► nginx (prod) / vite dev server
             │  SPA assets (history fallback)
             │
             ├─ /graphql/        ──► OXID shop  (same-origin proxy — no CORS surface)
             └─ /out/pictures/   ──► OXID shop  (generated product images)

oxid-fe-user (host app)
  src/            bootstrap, core wiring, router+guards, i18n, layout, login
  plugins/<name>/ IPlugin: routes, nav, i18n, config, setup()   ← shop today;
  layout plugins    plugins may override header / footer / home (peroxid) — layout-plugins.md
  resources/themes  themes (LESS + images + config.json) → /themes/<id>/ ; chosen per instance
  oxid-config.yaml  the INSTANCE: shop name, languages, which plugins load + their config
                    (+ public/ overlay, plugins/ folder) — see instance-configuration.md

oxid-fe-core (library @dantweb/oxid-fe-core)
  GraphqlClient · GraphqlError(errorCode)      transport + stable error codes
  AuthService · TokenStorage · jwt             graphql-base tokens (login, anonymous, expiry)
  PluginRegistry · IPlugin                     the plugin contract
  EventBus · CoreEvents                        host ↔ plugin decoupling
  createAuthGuard · createAuthStore            router guard, Pinia mirror
  addressSchema (zod) · formatPrice
```

## Backend dependencies (by module and branch)

| Module                           | Branch  | Used for                                                                                                                      |
| -------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `oxid-esales/graphql-base`       | b-7.4.x | `token(username?, password?)` (anonymous tokens for guests), JWT claims (`useranonymous`, `username`, …)                      |
| `oxid-esales/graphql-storefront` | b-7.4.x | `products`, `product(productId)`, `categories`, baskets, customer, addresses, `placeOrder`                                    |
| `oxid-esales/payment-base`       | b-7.4.x | headless checkout contract for sprint 04: `<provider>CheckoutStart/Return/Cancel` (`docs/graphql-headless-checkout.md` there) |

The only URL the frontend knows is its own origin: `/graphql/` is proxied (vite dev proxy /
nginx `API_UPSTREAM`). Payment return URLs (sprint 04) must be allow-listed in the shop setting
`sPaymentBaseHeadlessReturnOrigins`.

## Principles

- The **host stays thin**: domain features live in plugins; adding a payment provider =
  install its OXID module + its frontend plugin, no host change.
- Every API call goes through core's `GraphqlClient`; errors are handled by
  `extensions.errorCode`, never by message text.
- Auth: customers get a JWT via login; guests get an **anonymous token** at boot; expiry of a
  customer token emits `auth:session-expired`, which the host renders as a banner.

## Background

Research: [`dev_log/20261015/reports/headless-oxid-vue-frontend-perspectives.md`](dev_log/20261015/reports/headless-oxid-vue-frontend-perspectives.md) ·
Sprint plan: [`dev_log/20261015/sprints/_index.md`](dev_log/20261015/sprints/_index.md) ·
Reference: [vbwd-fe-core](https://github.com/VBWD-platform/vbwd-fe-core),
[vbwd-fe-user](https://github.com/VBWD-platform/vbwd-fe-user)

## Request caching

`oxid-fe-core`'s `GraphqlClient` can serve a repeated **read** from memory. It is opt-in per call:
`client.execute(query, variables, CATALOG_READ)` (policy in `plugins/shop/api/cachePolicy.ts`:
60 s for catalog reads, 30 s for search suggestions). `createCore` creates one `ResponseCache`
and injects it into the client.

- The key is language + token + query + variables: a language switch or another user never reads
  someone else's answer. The guest session arrives just after the first page load, so the very
  first read may be asked again once.
- Identical concurrent calls share one request. Errors are never cached.
- Any successful mutation (basket, login, address …) clears the whole cache.
- Basket, account, checkout and payment calls never opt in — `tests/unit/cachePolicy.spec.ts`
  fails if one does. Memory only: nothing is persisted, the entry count is capped.

## Search

Site search is part of the `shop` plugin (`plugins/shop/search/`); layout plugins such as
`peroxid` place its box. It is built for catalogues with millions of near-identical titles:
a `contains` match (the shop core, and so its indexes, stay untouched), `%` stripped from the shopper's input, a 2-character
minimum, debounce, 5 suggestions, pages of 12 asked as 13 (so "next page exists" needs no
`COUNT`), a depth cap of 20 pages followed by a "refine your search" hint, and the request cache
above. Limits are named constants in `search/searchApi.ts`.
