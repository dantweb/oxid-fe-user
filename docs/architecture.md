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

## A stale access token heals itself

The shop checks the `Authorization` header before it reads the query, so a token it no longer
trusts (signing key changed, another environment on the same origin, reset database) used to block
everything, including the login. Core now treats the shop's refusal as the truth: the token is
dropped (`SessionExpired` if it was a customer's), a **query** is retried once without it, a
mutation is not replayed, and the `token` calls (login, guest token) never carry a token. A stored
value that is not a JWT is dropped on read. `tests/e2e/stale-token.spec.ts` seeds a forged token.

## Language switch

One implementation, in core: the host provides its vue-i18n locale ref and the instance's ordered
locales through `localeSwitchKey`; the host header's `<select>` and peroxid's Apex-style dropdown
(`plugins/peroxid/components/LanguageMenu.vue`, `LanguageOptions.vue`) both call
`useLocaleSwitch().switchTo(code)`. The choice is stored under `oxfe_locale` (read at boot by
`pickLocale`) and the page reloads — like the shop's own language links — so every view fetches its
shop content in the new language (the request cache is keyed by language). Names come from
`languageName()` (`Intl.DisplayNames`, upper-cased code as fallback).

## Sessions: what the browser keeps, where, and for how long

| Key                     | Storage          | Holds                                                                                                                                                                           | Lives until                                                                                                                                                                                                                                                                         |
| ----------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `oxfe.token`            | `localStorage`   | the access token (a JWT) of the customer or of the anonymous guest session                                                                                                      | its `exp` (lifetime is the shop's `sJsonWebTokenLifetime`); renewed silently by the refresh flow; removed by logout, a refused refresh or a token the shop rejects                                                                                                                  |
| `oxfe.refresh`          | `localStorage`   | the refresh token (core 0.10.0: `login` / `refresh`)                                                                                                                            | its own expiry; useless without the HttpOnly `fingerprint` cookie the shop sets at login (same-origin `/graphql/` proxy required); removed with the access token                                                                                                                    |
| `oxfe_checkout_attempt` | `sessionStorage` | `provider`, `contractId`, `contractToken`, `orderNumber` of the open payment attempt — the proof of ownership the return/cancel pages need after the round trip to the provider | the tab; and earlier: removed by a committed, failed or (after the pending wait of 5 × 2 s) pending return, by the cancel page and by logout (`CoreEvents.AuthLogout`). A return that could not reach the shop (`network_error` / `http_error`) keeps it, so a reload can ask again |
| `oxfe_locale`           | `localStorage`   | the language the shopper chose                                                                                                                                                  | until the shopper switches again                                                                                                                                                                                                                                                    |
| `oxfe_shop_cart`        | `localStorage`   | the guest cart: product ids and amounts, no personal data                                                                                                                       | until the order is placed or the shopper empties it                                                                                                                                                                                                                                 |

Notes:

- **Logout** ends the local session at once and revokes the token on the shop (`tokenDelete`, core
  0.10.0); the checkout attempt is dropped by the checkout plugin's `AuthLogout` handler.
- **The e-mail claim.** graphql-base puts the customer's e-mail address (`username`) into the JWT. That is
  the shop module's choice, not this app's; the app only reads `exp` and `useranonymous`. Anyone who can
  read `localStorage` can read it, which is why the token lifetime is short and renewed rather than long.
- **The refresh flow** (core 0.10.0) renews the access token at three quarters of its remaining lifetime;
  a refused refresh drops the session and shows the "session expired" banner; a network failure keeps it
  and retries. A shop without `login` / `refresh` rights is detected on the first login and `token` is used.
- **Guest checkout details** (e-mail, addresses; sprint 140c) are kept in memory only — never in any
  of these storages.
- **URLs** carry nothing after use: the return page and the password-reset page remove their query string
  with `history.replaceState` (sprint 138c).
