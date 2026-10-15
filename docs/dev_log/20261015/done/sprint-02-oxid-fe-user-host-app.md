# DONE — Sprint 02: oxid-fe-user host app + shop plugin, proven in the browser

**Date:** 2026-10-15 · **Status:** delivered (S1–S7; deviations below)

## What was built

- **Host (S1–S4):** Vue 3 + Pinia + Vue Router + vue-i18n (en/de) on `@dantweb/oxid-fe-core`
  (`file:../oxid-fe-core` sibling layout). `main.ts` loads enabled plugins from `plugins.json`
  through the core `PluginRegistry`; router takes plugin routes + auth guard + expiry check;
  header renders plugin nav items; login view with redirect-back; session-expired banner on the
  core event; anonymous guest token fetched at boot.
- **Shop plugin (S5):** `plugins/shop/` exports an `IPlugin` — routes `/shop`,
  `/shop/product/:id`, `/shop/cart`; catalog with pagination (`products_per_page` config),
  product detail, guest cart in localStorage (merge, amount ±, remove, clear, subtotal,
  garbage-tolerant load). Query field sets verified against the live shop
  (`products`, `product(productId)`, `imageGallery.thumb/images`, `price.currency`).
- **Delivery (S6):** Vite dev server proxies `/graphql` + `/out/pictures` same-origin to
  `VITE_SHOP_URL`; prod `Dockerfile` (two-stage, build from SDK root) + nginx template with
  `API_UPSTREAM` envsubst; `services/oxid-fe-user.yml` in the SDK compose.
- **E2E (S7):** Playwright chromium; `webServer` boots the dev app.

## Verified (quality gate, all green)

- Unit: 7/7 (cart store incl. persistence + garbage localStorage; plugin contract via registry)
- **Playwright against the running SDK shop: 2/2** — guest browses catalog → product detail →
  add to cart → amount 1→2; login rejects wrong credentials with visible error
- eslint + prettier clean · `vue-tsc` clean · knip clean · vite build 75 kB gzip

## Deviations / open

- Category routes (`/shop/category/:slug`) and **cart→user-basket sync on login** deferred — the
  sync belongs with the basket mutations that checkout (sprint 04) introduces anyway.
- Line coverage is 18.5% (views carry most lines and are proven by e2e, not unit-mounted);
  branches 90%. Component-mount tests are a follow-up if we want the number, not the proof.
- Registration view deferred (login + anonymous sessions shipped).
