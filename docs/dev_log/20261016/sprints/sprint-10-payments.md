# Sprint 10 — payments: every method working, in iframe mode, through the public ports

**Date:** 2026-10-16 · **Repos:** `oxid-fe-core`, `oxid-fe-user`, module `mollie-payment` (small backend change)
**Spec:** [`docs/payments.md`](../../../payments.md) (written first)

## Ask

A working payment process on **all payment methods** through `daniil.oxiddev.de:2083` and the
other ports; the payment frontend behaves like the **iframe mode of the standard OXID checkout**
(provider UI rendered inline on the checkout page).

## Starting point (verified against the live shop)

- Shop methods: **Stripe Wallet, PayPal, Mollie** (the only active payments).
- Stripe `uiMode: embedded` already returns a `clientSecret`; PayPal's approval URL carries the
  order id (`?token=…`); Mollie refuses `embedded` (`MOLLIE_UI_MODE_UNSUPPORTED`), its handler
  already forwards `mollieCardToken`.
- Public SDK values live in module settings (`sStripeTestPk`, `sPayPalSandboxClientId`,
  `sMollieProfileId`); sandbox buyer credentials exist in the PayPal module's e2e env.

## Stories

| #   | Story                                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Docs first: `docs/payments.md`                                                                                                                                                          |
| S2  | core v0.5.0: `PaymentPlugin.inline` contract (component + props/events), `loadScriptOnce` for provider SDKs; tests                                                                      |
| S3  | checkout: payment step mounts the selected plugin's inline component once terms are confirmed; hosted fallback per instance `mode`; shared success/failure handling; no double mounting |
| S4  | Stripe inline: Stripe.js + Embedded Checkout (single-mount registry), return flow, decline handling                                                                                     |
| S5  | PayPal inline: Smart Buttons (SDK URL from instance config, intent matching the shop), `createOrder` → start, `onApprove` → settle, `onCancel`/`onError` retire the attempt             |
| S6  | Mollie: **backend** `cardToken` argument + `embedded` mode (TDD, branch in the module); frontend Components card (4 iframes), other methods via Mollie's page                           |
| S7  | Instance configs: A (deployed file), B, C with the public provider values; return origins for `:2053` / `:2083`                                                                         |
| S8  | e2e per method on the public ports: success, failure/cancel, retry; shop-side order state asserted; evidence screenshots                                                                |
| S9  | Report, docs, quality gate                                                                                                                                                              |

## Acceptance

- Each of the three methods completes a real sandbox payment on `:2083`, and Stripe + PayPal also
  on `:8443` / `:2053`: committed order, confirmation, dashboard entry, shop order row finished.
- The payment UI is inline on the checkout page (provider iframes visible; no navigation until
  the provider finishes), exactly one mount per method; hosted mode still works.
- Failure paths leave no committed order and the shopper can retry.
- Quality gate green in core, app and the Mollie module's tests; existing suites unaffected.
