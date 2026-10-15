# Standalone Vue.js frontend for headless OXID — research perspectives

Date: 2026-10-15
Reference implementations studied: [vbwd-fe-user](https://github.com/VBWD-platform/vbwd-fe-user),
[vbwd-fe-user-plugin-shop](https://github.com/VBWD-platform/vbwd-fe-user-plugin-shop)

## 1. What already exists on the backend (the headless half is largely solved)

- **`graphql-base` + `graphql-storefront` (b-7.4.x) are already installed** in this workspace
  (`source/vendor/oxid-esales/`, required by `source/composer.json`). The Storefront module is OXID's
  consolidated headless API (the earlier catalogue/account/checkout module split was discarded) and covers
  products, categories, manufacturers, vendors, reviews, customer registration and account, invoice and
  delivery addresses, baskets (create, add/remove items, vouchers, set delivery and payment), delivery
  methods and `placeOrder` — 62 queries plus mutations across ~26 domains. Auth is JWT
  (`token` query, refresh tokens, anonymous tokens for guest browsing).
  Docs: [Browse the Storefront](https://docs.oxid-esales.com/interfaces/graphql/en/latest/consuming/BrowseStorefront.html),
  [Modules and use cases (9.0)](https://docs.oxid-esales.com/interfaces/graphql/en/9.0/modules.html).
- **Headless payments are already built in-house.** `payment-base` ships a `HeadlessCheckoutService` with a
  provider-neutral GraphQL contract, documented in
  `payment-base/docs/graphql-headless-checkout.md`. Each provider module (Stripe, Mollie, PayPal) exposes
  three mutations:
  - `<provider>CheckoutStart(basketId, confirmTermsAndConditions, returnUrl, cancelUrl?, uiMode?)`
    → `{ contractId, contractToken, orderNumber, redirectUrl, clientSecret, renderMode }`
  - `<provider>CheckoutReturn(contractId, contractToken)` → `{ status, orderId, orderNumber, contractState }`
  - `<provider>CheckoutCancel(contractId, contractToken)` → `{ cancelled, contractId, contractState }`

  The provider's webhook commits the contract and finishes the order; the return mutation only reports (or
  settles itself when no webhook is registered). Core `placeOrder` remains for non-contract payments
  (invoice, COD) and is refused for contract-first payments with an error naming the right mutation. The
  PayPal side lives in `paypal/src/PayPal/GraphQL/Controller/PayPalCheckout.php`; each module ships
  `bin/graph-ql-cli-test.sh` to exercise the whole flow from the CLI.

So the question is not "how do we make OXID headless" — it is purely a frontend architecture decision.

## 2. What the VBWD reference repos are

- **`vbwd-fe-user`** — a Vue 3 + Pinia + Vue Router 4 + Vite SPA (host app) on a shared core library
  (`vbwd-fe-core` git submodule), with vue-i18n, JWT auth with automatic refresh (session-expired modal,
  localStorage persistence), socket.io for realtime, nginx proxying `/api/` to the backend and `/_plugins`
  to a plugin API server, two-stage Docker production build. Its defining feature is a **runtime
  `PluginRegistry`** (from `vbwd-view-component`): plugins register routes, Pinia stores and translations at
  runtime. Stripe/PayPal/YooKassa payments, checkout, CMS (widget slots) and themes are each separate
  plugin repositories.
- **`vbwd-fe-user-plugin-shop`** — a plugin exporting an `IPlugin` from `index.ts`: declares routes
  (`/shop`, `/shop/category/:slug`, `/shop/product/:slug`, `/shop/cart` public; `/shop/orders`,
  `/shop/orders/:id` auth-required), views (ProductCatalog, ProductDetail, Cart, OrderHistory,
  OrderDetail), a `useCartStore` (guest cart in localStorage under a namespaced key, synced to the backend
  on login when `cart_sync_on_login` is set), plus `config.json` defaults and an `admin-config.json`
  settings schema for merchant configuration.

The pattern maps almost one-to-one onto OXID: the host app owns auth/tokens/layout; a "shop" plugin owns
catalog + basket views over the Storefront API; **each payment provider becomes its own frontend plugin
pairing with its OXID module's three mutations** — mirroring how the backend is already factored.

## 3. Perspectives

### A. VBWD-style Vue 3 SPA host + plugin architecture (closest fit)

Vue 3 / Pinia / Vite host talking to `/graphql` (villus or Apollo client; types generated with
`graphql-codegen` against the Storefront schema). Plugins: shop/catalog, checkout, one per payment
provider.

- Pros: mirrors the backend's module factoring; payment frontend plugins can ship alongside their OXID
  module; the VBWD repos are a working reference to copy the plugin contract from.
- Cons: SPA = weak SEO for a public catalog. Fine for B2B portals, app-like storefronts, kiosk/embedded
  commerce, or behind-login shops.

### B. Nuxt 3 (SSR/SSG) variant

Same stack, server-rendered — necessary where organic search traffic matters (a public shop usually does).
Nuxt layers/modules play the "plugin" role. Costs a Node SSR server in the deployment, but the GraphQL
contract is identical. Pragmatic default for a real public storefront; option A can be promoted to this by
swapping the shell, not the plugins.

### C. Alokai (ex-Vue Storefront)

**No OXID connector exists** — neither [Alokai's integration list](https://docs.alokai.com/integrations)
nor the [vuestorefront GitHub org](https://github.com/vuestorefront) mentions OXID; a custom middleware
connector would have to be built from their integration boilerplate. Buys a UI kit and middleware layer at
the cost of a heavy, partly commercial framework plus a connector to maintain. Only worth it as a
strategic product bet, not for a first standalone frontend. (The older community
[graphql-catalogue](https://root.packagist.org/packages/oxid-esales/graphql-catalogue) package is
unmaintained — the Storefront module replaced it.)

## 4. Gaps and risks to plan for (any option)

1. **Guest checkout** — the headless checkout mutations are `#[Logged]`; anonymous JWTs exist in
   graphql-base for browsing/baskets, but the guest-to-registered handover in checkout needs explicit
   design and testing.
2. **Embedded payment UIs** — Stripe supports `uiMode: embedded` (returns `clientSecret` for embedded
   Checkout); **PayPal is currently `hosted`-only: Smart Buttons would need the standalone frontend to
   load PayPal's JS SDK**. A natural first extension of the existing contract, and squarely this team's
   territory.
3. **Return-URL allowlisting** — the frontend's origin must be listed in
   `sPaymentBaseHeadlessReturnOrigins`; CORS for `/graphql` needs the same treatment.
4. **Storefront API coverage** — CMS content/widgets, full-text search, SEO URLs, thumbnail generation and
   wishlist/comparison are thin or absent in graphql-storefront; budget for supplementary GraphQL
   extension modules or frontend-side solutions.
5. **Webhooks are load-bearing** — order finalization depends on provider webhooks reaching the shop;
   local/staging setups need tunnels (familiar from the Stripe CLI workflow).

## 5. Suggested next step

A proof-of-concept that reuses the existing CLI test flow in a browser: a minimal Vue 3 host (auth +
basket via the Storefront API) plus one payment plugin (PayPal, matching the three mutations in
`graphql-headless-checkout.md`), structured so the plugin contract imitates VBWD's `IPlugin` (routes +
Pinia store + i18n + `config.json`). That validates option A end to end; promoting it to Nuxt later
changes the shell, not the plugins.

## Sources

- https://docs.oxid-esales.com/interfaces/graphql/en/latest/consuming/BrowseStorefront.html
- https://docs.oxid-esales.com/interfaces/graphql/en/9.0/modules.html
- https://docs.oxid-esales.com/interfaces/graphql/en/7.0/modules.html
- https://forum.oxid-esales.com/t/about-the-discarded-idea-to-distribute-oxid-graphql-api-with-different-modules/97634
- https://root.packagist.org/packages/oxid-esales/graphql-catalogue
- https://docs.alokai.com/integrations
- https://madewithvuejs.com/vue-storefront
- https://github.com/vuestorefront
- https://github.com/VBWD-platform/vbwd-fe-user
- https://github.com/VBWD-platform/vbwd-fe-user-plugin-shop
- Local: `source/vendor/oxid-esales/payment-base/docs/graphql-headless-checkout.md`,
  `source/extensions/paypal/src/PayPal/GraphQL/Controller/PayPalCheckout.php`,
  `source/vendor/oxid-esales/graphql-storefront/src/`
