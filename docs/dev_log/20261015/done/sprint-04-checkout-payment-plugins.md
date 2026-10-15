# DONE — Sprint 04: checkout with Stripe/PayPal/Mollie as frontend plugins

**Date:** 2026-10-15 · **Status:** delivered (S1–S3 hosted, S4–S6, S8, S9; deviations below)

## What was built

- **core v0.2.0 (S1):** `PaymentPlugin` interface (paymentId + start/checkoutReturn/cancel over
  payment-base's three-mutation contract), `isPaymentPlugin` guard,
  `createProviderCheckoutApi(client, prefix)` — one factory serves every provider, a plugin is
  ~30 lines of configuration; `PluginRegistry.paymentPluginFor(paymentId)`; `PluginContext`
  gained `registry` so the checkout plugin can find its payment peers.
- **checkout plugin (S2, S6):** `/checkout` (auth-guarded): invoice-address step (zod-validated,
  prefilled from `customerInvoiceAddress`), **fresh server-side basket per attempt** built from
  the guest cart (`basketCreate` + `basketAddItem`), delivery step (auto-select single method),
  payment step mapping offered `basketPayments` ids to installed payment plugins — unmatched ids
  go the classic `basketSetPayment` + `placeOrder` path; terms checkbox; redirect handling;
  `/checkout/return/:provider` polls `<provider>CheckoutReturn` (committed/pending/failed, clears
  cart+attempt on committed); `/checkout/cancel/:provider` retires the attempt. The open attempt
  (contractId + contractToken) lives in sessionStorage — it must survive the PSP round trip.
- **Provider plugins (S3–S5):** `payment-paypal`, `payment-stripe`, `payment-mollie` — all
  hosted mode via the core factory.
- **Ops (S8):** `sPaymentBaseHeadlessReturnOrigins` lives in
  `var/configuration/shops/1/modules/oe_payment_base.yaml` (+ cache clear); this SDK shop now
  allows `http://localhost:5173`.

## Verified

- **Playwright, real shop + real PSP sandboxes (S9):** fresh customer registers → signs in →
  fills cart → address form → delivery → PayPal → terms → Pay → **lands on
  sandbox.paypal.com** → cancel leg retires the attempt (`cancelled`). Same flow reaches
  **checkout.stripe.com** for Stripe. Suite: 6/6 e2e, 22/22 unit, lint/vue-tsc/knip clean.
- API-level (curl): full basket flow, `return_url_rejected/origin_not_allowed` before
  allowlisting, PayPal order 832 + Stripe order 833 created and cancelled.

## Findings & deviations

- **A cancelled attempt blocks its basket** (idempotency guard answers "order already exists") —
  the checkout therefore builds a **fresh basket per attempt**; retry after cancel works. Worth a
  backend look: `graphql-headless-checkout.md` promises "a second start retires the first", which
  holds per basket only _before_ cancel.
- Stripe **embedded** uiMode deferred (needs publishable-key config + stripe.js story); hosted
  shipped for all three. Mollie `method` pre-selection deferred (providerOptions seam exists).
- Mollie has no e2e (sandbox API key reachability); its plugin is the same factory path as the
  two e2e-proven providers and is unit-tested.
- Guest checkout (S7): mutations are `#[Logged]`; `/checkout` is auth-guarded, guests register
  or sign in first (the e2e registers via the public `customerRegister`). Anonymous-token
  checkout stays a backend setting question (payment-base permission provider).
