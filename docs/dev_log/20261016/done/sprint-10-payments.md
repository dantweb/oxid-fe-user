# DONE — Sprint 10: every payment method working in iframe mode, through the public ports

**Date:** 2026-10-16 · **Status:** delivered (S1–S9) · **Spec:** [payments.md](../../../payments.md)

## What was built

- **core 0.5.0 / 0.6.0:** `PaymentPlugin.inlineComponent()` + `InlinePaymentProps/Attempt`,
  `loadScriptOnce` (0.5.0); `createProviderCheckoutApi({ startArguments })` forwards provider
  options such as Mollie's `cardToken` / `method` (0.6.0). Tests first.
- **Checkout host:** the payment step mounts the chosen plugin's inline component once the terms
  are confirmed; one `start` per mount; leaving the state (other method, terms unticked) retires
  the open attempt and rebuilds a fresh basket; failures show a message and a _Try again_ button.
- **Stripe** (`payment-stripe` 0.2.0): Embedded Checkout (single-mount registry).
  **PayPal** (`payment-paypal` 0.2.0): Smart Buttons, order created on click, cancel/error retire the
  attempt. **Mollie** (`payment-mollie` 0.2.0): Components (card holder / number / expiry / CVC in
  Mollie iframes → token → `mollieCheckoutStart(uiMode embedded, cardToken)`); iDEAL and Bancontact
  chosen inline and continued on Mollie's page. Each falls back to the hosted page with
  `mode: redirect` or without the provider's public value.
- **Mollie backend** (module `mollie-payment`, branch `feature/headless-embedded-card-token`,
  commit `6d5a780`): `cardToken` argument and `uiMode: embedded`; 805 unit tests, phpcs, phpstan,
  phpmd green.
- **Instances:** A (`oxid-config.yaml`) and C (`example-peroxid`) carry Stripe, PayPal and Mollie
  public values; B carries Stripe. `.dist` holds placeholders.

## Verified (sandboxes, public URLs)

| Run                                          | Result                                                                                         |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `payments-*` on `https://…:2083` (peroxid)   | 14 / 14                                                                                        |
| `payments-*` on `https://…:8443` (A)         | 14 / 14 serial (one earlier parallel run: 1 Stripe test timed out; passed on rerun, see below) |
| `payments-stripe` on `https://…:2053` (B)    | 5 / 5                                                                                          |
| dev server (Chromium)                        | Stripe 5, PayPal 4, Mollie 5 — all green                                                       |
| unit (app) / unit (core) / lint / knip / tsc | 94 / 62 / green / green / green                                                                |

Per method: inline UI without leaving the page, a real payment → committed order → entry in
`/dashboard/orders` (Stripe + Mollie _open_/authorized, PayPal _paid_, iDEAL _paid_), the failure
path (declined Stripe card shown inside the form; Mollie _Failed_ → no committed order and a
fresh checkout pays; PayPal popup closed → attempt retired, buttons work again), and the hosted
fallback. Screenshots: [reports/payments](../reports/payments/).

## Notes / debt

- **Intermittent:** with three specs in parallel (shared shop customer) one Stripe payment timed
  out on `:8443`; serial runs (`npm run test:e2e:payments`) are green. Cause not proven — parallel
  interference on one account is the assumption; hence the serial script.
- **Mollie module branch is local:** no fork of `mollie-payment` exists and the org repo is not
  writable from here, so `6d5a780` is not pushed. The shop's working tree runs that branch.
- Card payments in Mollie test mode go through Mollie's status page (the 3-D Secure stand-in); a
  frictionless live card payment (`settled` without redirect) is covered by unit logic only.
- Only Stripe is configured on instance B (PayPal/Mollie plugins are not enabled there).
