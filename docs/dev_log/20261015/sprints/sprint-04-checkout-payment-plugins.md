# Sprint 04 — checkout: every payment module (Stripe, PayPal, Mollie, …) as an oxid-fe-user plugin

**Date:** 2026-10-15 · **Repo:** `dantweb/oxid-fe-user` (+ one plugin per provider) · **Status:** planned · **Depends on:** 02
**Backend contract (already shipped, b-7.4.x):** `payment-base/docs/graphql-headless-checkout.md` —
`<provider>CheckoutStart` → `{contractId, contractToken, orderNumber, redirectUrl, clientSecret, renderMode}`,
`<provider>CheckoutReturn`, `<provider>CheckoutCancel`; the provider's webhook commits the order.

## Ask

A checkout flow plugin plus **one frontend plugin per payment provider**, mirroring on the frontend how the
backend is factored (payment-base + provider modules). Adding a payment provider to the storefront must
mean: install its OXID module **and** install its frontend plugin — no host-app changes.

## Design

- **`PaymentPlugin` interface** (goes into oxid-fe-core): extends `IPlugin` with
  `paymentId` (the OXID id, e.g. `oe_payments_stripe_wallet`), `start(basketId, {returnUrl, cancelUrl}, options)`,
  a `PayComponent` for `renderMode: embedded`, and `ReturnView`/`CancelView` route components.
- **Checkout plugin** owns the flow: basket review → invoice/delivery address (storefront address
  mutations) → delivery method (`basketSetDeliveryMethod`) → payment selection → pay → confirmation.
- **Payment selection** queries the basket's available payments; ids registered by an installed
  `PaymentPlugin` route to that plugin's `start` mutation; all other (non-contract-first) payments —
  invoice, COD — go the classic way: `basketSetPayment` + `placeOrder`. This is exactly the split the
  backend enforces (core `placeOrder` is refused for contract-first payments).
- **Return/cancel routes**: `/checkout/return/:provider` and `/checkout/cancel/:provider`; `contractId`
  arrives in the URL (`contract_id`), `contractToken` is held client-side from the start response
  (Pinia + sessionStorage — it is the proof of ownership for return/cancel).

## Stories

| # | Story |
|---|---|
| S1 | `PaymentPlugin` interface + registry support in oxid-fe-core (minor release) |
| S2 | Checkout plugin: steps, state machine, address/delivery over storefront mutations, terms checkbox (`confirmTermsAndConditions`) |
| S3 | **stripe plugin**: hosted (redirect to `redirectUrl`) and `uiMode: embedded` (mount embedded Checkout with `clientSecret`); return view polls `stripeCheckoutReturn` until `committed`/`failed` |
| S4 | **paypal plugin**: hosted approval-page redirect (`uiMode: hosted` is all the backend offers today); return view calls `paypalCheckoutReturn(contractId, contractToken)`; **follow-up ticket, not this sprint**: Smart Buttons require a new backend `uiMode` in the paypal module |
| S5 | **mollie plugin**: hosted redirect; optional `method` pre-selection (`ideal`, `creditcard`, …) surfaced as sub-options in payment selection |
| S6 | Classic path: `basketSetPayment` + `placeOrder` for non-contract payments; shared confirmation page (order number from either path) |
| S7 | **Guest checkout**: the checkout mutations are `#[Logged]` — design and verify the guest path (anonymous-token basket → register/login step before pay, basket carried over); document findings against graphql-base's anonymous-token rights |
| S8 | **Ops**: the frontend origin goes into the shop setting `sPaymentBaseHeadlessReturnOrigins` (otherwise `return_url_rejected`); documented in the SDK setup; webhook reachability (tunnel) documented for local dev |
| S9 | **E2E**: Playwright per provider against sandbox credentials, reproducing each module's `bin/graph-ql-cli-test.sh demo` flow in the browser: start → pay at PSP (test mode) → return shows committed order; cancel path; wrong-token path shows the error page |

## Error handling

Map the stable `extensions.errorCode`s to user-facing states: `basket_not_found`, `payment_not_supported`
(basket set to a different provider), `terms_not_confirmed`, `return_url_rejected`, `provider_failed`
(+ `providerCode`), `contract_not_found`, `invalid_token`. A second `start` on the same basket retires the
first attempt (backend behavior) — the UI treats "pay again" as safe.

## Acceptance

- Demo shop: a cart is paid once through each of Stripe (hosted **and** embedded), PayPal and Mollie
  sandbox; the confirmation page shows the order number; the shop admin shows the order paid/committed.
- Removing a provider's frontend plugin removes it from payment selection without any host change.
- Playwright provider suites green in CI (sandbox secrets via CI env).
