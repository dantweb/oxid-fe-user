# oxid-fe — sprint plan index

**Date:** 2026-10-15 · **Projects:** `oxid-fe-core` (library), `oxid-fe-user` (host app)
**Foundation:** [`../reports/headless-oxid-vue-frontend-perspectives.md`](../reports/headless-oxid-vue-frontend-perspectives.md)
**Reference architecture:** [vbwd-fe-core](https://github.com/VBWD-platform/vbwd-fe-core),
[vbwd-fe-user](https://github.com/VBWD-platform/vbwd-fe-user),
[vbwd-fe-user-plugin-shop](https://github.com/VBWD-platform/vbwd-fe-user-plugin-shop)

The backend is already headless: `graphql-base` + `graphql-storefront` (b-7.4.x) are installed, and
payment-base ships the contract-first headless checkout (`<provider>CheckoutStart/Return/Cancel`) for
Stripe, PayPal and Mollie — see `payment-base/docs/graphql-headless-checkout.md`. These sprints build the
frontend half: a Vue 3 plugin-host storefront in the VBWD pattern.

| Sprint | Title | Depends on |
|---|---|---|
| [00a](sprint-00a-docker-fe-core-service.md) | Docker container for oxid-fe-core as an SDK service | — |
| [00b](sprint-00b-project-documentation.md) | Project documentation baseline | — |
| [00c](sprint-00c-github-repos.md) | Private repos `dantweb/oxid-fe-core`, `dantweb/oxid-fe-user` | 00b |
| [01](sprint-01-oxid-fe-core.md) | `oxid-fe-core` — the shared library (VBWD `vbwd-fe-core` analogue over GraphQL) | 00a, 00c |
| [02](sprint-02-oxid-fe-user-host-app.md) | `oxid-fe-user` — host app consuming `oxid-fe-core`, shop plugin | 01 |
| [03](sprint-03-seo-spa.md) | SEO for the SPA storefront | 02 |
| [04](sprint-04-checkout-payment-plugins.md) | Checkout — Stripe/PayPal/Mollie as frontend plugins | 02 |
| [05](sprint-05-user-dashboard.md) | User account at `/dashboard` — pure SPA, excluded from SEO | 02, 03 |

**Engineering requirements:** binding for every sprint —
[`_engeneering_requirements.md`](_engeneering_requirements.md): SOLID, DRY, clean code, TDD,
no overengineering, no dead code, regular evaluation of violations, quality guards. Additionally,
DevOps-first (everything runs in the SDK containers and in CI) and additive only — nothing in the shop or
the payment modules changes unless a sprint names it explicitly.
