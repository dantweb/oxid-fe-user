# Payments — every method, in the checkout's own page ("iframe mode")

The standard OXID checkout has an **iframe mode** (payment-base setting `blPaymentBaseUseIframe`,
"Use iframe instead of checkout button"): the provider's payment UI renders _inline on the order
page_, inside the provider's iframes, instead of a "Pay with X" button that leaves the shop. The
SPA checkout works the same way. Each provider's payment plugin supplies an **inline component**;
the checkout shows it in the payment step as soon as the method is chosen and the terms are
confirmed. Where the provider has no embeddable UI for a method, the plugin falls back to the
hosted page (redirect) — selectable per instance.

## The shop's payment methods

The shop offers three contract-first methods (payment-base's headless checkout, see
`payment-base/docs/graphql-headless-checkout.md`); the frontend has one payment plugin each:

| Plugin           | OXID payment id             | Inline (iframe) mode                                                                                                                   | Hosted fallback              |
| ---------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `payment-stripe` | `oe_payments_stripe_wallet` | **Stripe Embedded Checkout** — the whole payment form in Stripe's iframe                                                               | Stripe Checkout page         |
| `payment-paypal` | `oe_payments_paypal`        | **PayPal Smart Buttons** — PayPal's buttons and approval popup                                                                         | PayPal approval page         |
| `payment-mollie` | `oe_payments_mollie`        | **Mollie Components** — card number / holder / expiry / CVC in Mollie iframes; other methods (iDEAL, Bancontact, …) open Mollie's page | Mollie method-selection page |

## How an inline payment runs

```
select method + confirm terms
   └─ checkout mounts the plugin's inline component (the page does not navigate)
        Stripe  : start(uiMode: embedded) → clientSecret → stripe.initEmbeddedCheckout → mounted iframe
        PayPal  : Buttons render; on click → start() → PayPal order id → SDK popup → onApprove
        Mollie  : Components mounted; "Pay" → mollie.createToken() → start(cardToken)
   └─ payment completes at the provider
        Stripe  : Stripe sends the browser to returnUrl (?session_id=…)
        PayPal  : onApprove → app navigates to the return route
        Mollie  : paid → app navigates to the return route; 3-D Secure / other methods → redirect
   └─ /checkout/return/<provider>: <provider>CheckoutReturn settles the contract → order committed
```

The return route, the order confirmation, cancel handling and the "fresh basket per attempt"
rule are the same for inline and hosted payments (`done/sprint-04…`).

## Instance configuration

The public values each provider SDK needs come from the instance's `oxid-config.yaml`
(`plugins.<name>.config`). They are **public by design** — the same values sit in the page source
of any checkout using that provider — but they are _not_ secrets-free in general: never put a
secret key, API key or PayPal secret here (the browser downloads this file).

```yaml
plugins:
  payment-stripe:
    config:
      mode: iframe # iframe (default) | redirect
      publishable_key: pk_test_… # Stripe publishable key (shop setting sStripeTestPk / sStripeLivePk)
  payment-paypal:
    config:
      mode: iframe
      client_id: … # PayPal REST client id (sPayPalSandboxClientId / sPayPalLiveClientId)
      currency: EUR
      intent: capture # must match the shop: capture mode automatic → capture, manual → authorize
  payment-mollie:
    config:
      mode: iframe
      profile_id: pfl_… # Mollie profile id (sMollieProfileId)
      test_mode: true # mirrors sMollieMode
      # locale: en_US   # optional: derived from the active storefront language (de → de_DE)
      methods: [creditcard, ideal, bancontact] # offered inline; creditcard uses Components, the rest Mollie's page
```

## Backend support

| Provider | Needed from the module                                                                                                    | Status                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Stripe   | `uiMode: embedded` on `stripeCheckoutStart` → `clientSecret`                                                              | already there                                                                 |
| PayPal   | approval URL (carries the PayPal order id) from `paypalCheckoutStart`                                                     | already there                                                                 |
| Mollie   | `mollieCheckoutStart(uiMode: embedded, cardToken)`; the handler already forwards `mollieCardToken` to the payment request | **added in sprint 10** (module branch `feature/headless-embedded-card-token`) |

## What "working" means here — the proof

`tests/e2e/payments-*.spec.ts` complete a real payment per method **through the public ports**
(`https://daniil.oxiddev.de:2083` peroxid, `:2053`, `:8443`) in the providers' sandboxes: Stripe
test card, PayPal sandbox buyer, Mollie test card and Mollie's test payment page. Each asserts
the committed order (confirmation with order number, order visible in `/dashboard/orders`, the
shop-side order row `OK`), plus the failure paths (declined card, cancelled PayPal, failed Mollie
payment) which must leave no committed order and the shopper able to retry.
Capture modes of this shop: Stripe `manual`, Mollie `manual`, PayPal `automatic` — so Stripe and
Mollie orders are _authorized and open_, PayPal's is _paid_.

## Findings from the sandbox runs

- **Mollie Components load lazily** — a card field's iframe only becomes live once scrolled into
  view, so the e2e helper scrolls each field before typing. `createToken()` on fields that never
  loaded returns an error, which the component shows inline.
- **Mollie test mode** answers a card payment with its test-payment page (pick the final status);
  that page is the stand-in for 3-D Secure, so the return route is exercised for every card
  payment. iDEAL first asks for a bank, then offers _Paid / Failed / …_ (no _Authorized_).
- **PayPal's SDK buttons** attach their click handler shortly after rendering and re-render after
  a cancelled attempt (fresh basket) — the e2e waits for the rebuild before clicking again.
- **Same customer, one worker:** the specs share one shop account, run them with `--workers=1`.
