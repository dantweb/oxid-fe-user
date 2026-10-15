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
