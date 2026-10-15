# Sprint 02 — oxid-fe-user: the host app on oxid-fe-core

**Date:** 2026-10-15 · **Repo:** `dantweb/oxid-fe-user` · **Status:** planned · **Depends on:** 01

## Ask

The user-facing storefront SPA in the [vbwd-fe-user](https://github.com/VBWD-platform/vbwd-fe-user)
pattern: a thin Vue 3 host that owns auth, layout, i18n and plugin loading — with the catalog/cart as the
first first-party plugin (the [vbwd-fe-user-plugin-shop](https://github.com/VBWD-platform/vbwd-fe-user-plugin-shop)
analogue) — consuming `@dantweb/oxid-fe-core` and talking only to the shop's GraphQL endpoint.

## Stories

| # | Story | Detail |
|---|---|---|
| S1 | **App scaffold** | Vue 3 + Pinia + Vue Router 4 + Vite + vue-i18n (en, de), core installed from GitHub Packages; `.env`: `VITE_SHOP_URL` |
| S2 | **Auth** | login, registration, logout views over storefront `token` / customer mutations via core's `auth/`; anonymous token for guests; session-expired modal wired to core's event |
| S3 | **Layout & navigation** | header/footer, category navigation from the storefront `categories` query, nav items contributed by plugins through the registry |
| S4 | **Plugin loading** | plugins live in `plugins/<name>/` with `index.ts` exporting `IPlugin`; host loads enabled plugins from `plugins.json` at boot; the core CLI manages state |
| S5 | **Shop plugin** (first-party, in-repo) | routes `/shop`, `/shop/category/:slug`, `/shop/product/:slug`, `/shop/cart`; views ProductCatalog (pagination, sorting), ProductDetail (variants, price, stock), Cart; basket via storefront `basketCreate` / `basketAddItem` / `basketRemoveItem`; guest cart in localStorage, synced to a user basket on login (`cart_sync_on_login`, as in the VBWD shop plugin); `config.json`: `products_per_page`, `show_out_of_stock`, `default_catalog_view` |
| S6 | **Delivery: nginx + Docker** | two-stage prod image (builder → nginx); nginx proxies `/graphql` to the shop (same-origin — no CORS surface) and serves the SPA with history fallback; dev service `services/oxid-fe-user.yml` in the SDK (same pattern as sprint 00a) |
| S7 | **E2E skeleton** | Playwright: guest browses catalog → product → cart; user registers → logs in → cart survives; runs against the SDK shop in CI |

## Constraints

- The host stays thin: no shop domain logic outside the shop plugin — the point is that sprint-04 payment
  plugins and future plugins (CMS, themes…) are peers of the shop plugin.
- Every storefront call goes through core's `GraphqlClient` with generated types; no hand-written fetches.
- OXID quirk (documented in payment-base): requests with bot-like `User-Agent`s get their basket emptied —
  irrelevant for browsers, but e2e/API tooling must send a browser-like UA.

## Acceptance

- `make up` (SDK) + `npm run dev` in the container serves the storefront against the local shop; a guest
  can browse the demo catalog and fill a cart; a logged-in user keeps the cart.
- Prod image serves the built SPA behind nginx with the `/graphql` proxy; Playwright suite green in CI.
