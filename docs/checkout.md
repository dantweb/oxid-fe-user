# Checkout — with and without an account

The `/checkout` route serves two shoppers. Which one is decided by the session, not by a setting of the
page: `CheckoutEntry.vue` asks `auth.isAuthenticated()` (a customer token, not the anonymous guest token).

| Shopper                 | Page                                                                                               | Basket                                              | Payment                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| signed in               | `CheckoutView.vue`: invoice address, delivery method, payment list of the shop                     | the customer's                                      | the shop lists the methods (`basketPayments`); the provider's inline component or hosted page |
| guest (anonymous token) | `GuestCheckoutView.vue`: e-mail, invoice address, optional delivery address, payment plugin, terms | built anonymously (`basketCreate`, `basketAddItem`) | **hosted page** of the provider, started with the guest details                               |

A logged-in shopper never sees the guest form.

## The guest flow (sprint 140c)

1. The shopper adds products (the cart is in `localStorage`, as for everyone) and opens `/checkout`. The route
   carries `meta.guestCheckout`, no `requiresAuth`; the host already holds an anonymous token
   (`ensureSession()` at boot).
2. `GuestDetailsForm.vue`: e-mail, salutation, name, street and number, ZIP, city, country (the shop's
   `countries` query, answered to an anonymous token; Germany preselected when present), and a "Deliver to a
   different address" toggle that adds a second address block. Every field is checked in the browser first
   (`validateGuestForm`, `plugins/checkout/guest.ts`); a missing one shows its own message and nothing is sent.
3. The payment methods are the payment plugins this instance runs. An anonymous token cannot list them
   (`basketPayments`, `basketSetPayment`, `basketSetDeliveryMethod` are `@Logged` in graphql-storefront), so the
   guest never chooses a delivery method and the provider mutation says which payment it is: the plugin's own
   start mutation (`stripeCheckoutStart`, …) already names its payment, no `paymentId` is sent.
4. "Pay now" builds a fresh anonymous basket, then calls `plugin.start(basketId, { returnUrl, cancelUrl, guest })`
   (core 0.10.0: `PaymentStartOptions.guest`, `{ email, invoiceAddress, deliveryAddress? }`). payment-base turns
   the guest into a shop user at that moment (140a), re-owns the basket and continues as for a customer.
5. The browser goes to the provider's hosted page and comes back to `/checkout/return/<provider>` (no query
   string stays in the address bar, sprint 138c); the return page shows the order number. The route needs no
   login either.

### What the shop answers, and what the shopper sees

| Shop code                                                                | Shown                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `account_exists`                                                         | "An account with this e-mail address already exists. Please log in or use another e-mail address." plus a link `Log in or use another e-mail address` to `/login?redirect=/checkout`; after the login the shopper is back on the checkout as a customer |
| `guest_details_required`                                                 | the translated "please enter your e-mail address and your addresses"                                                                                                                                                                                    |
| `return_url_rejected`, `provider_failed`, `network_error`, anything else | the `errors.<code>` text of `src/i18n/*.json` (sprint 138f); the shop's own message is never shown. `debug.errors: true` adds a details block for developers                                                                                            |

### What is stored where

| Data                                                                        | Where                                          | Until                                                                                                                                                 |
| --------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| e-mail and addresses of the guest                                           | the `checkout` store (Pinia) — **memory only** | the page view; a reload or `checkout.clear()` (logout, committed/failed return, cancel) drops them. Never in `localStorage` / `sessionStorage` (138e) |
| the open attempt (`provider`, `contractId`, `contractToken`, `orderNumber`) | `sessionStorage` `oxfe_checkout_attempt`       | as in `architecture.md` (sessions) — it carries no personal data                                                                                      |
| the anonymous token                                                         | `localStorage` `oxfe.token`                    | its expiry; it stays the guest's token, the shop user created at the start is not logged in                                                           |

## Instance option `checkout.guest`

`checkout.guest: true` (default) opens the three checkout routes to guests. With `false` the routes behave as
before sprint 140c: a shopper without a customer session is sent to `/login?redirect=/checkout`
(`guestCheckoutGuard` in `src/router.ts`; unit tests cover both values, `tests/e2e/guest-checkout.spec.ts` the
redirect).

## Limits of this release

- Hosted payment page only: the inline (iframe) components start the payment themselves and do not carry the
  guest details yet.
- PayPal starts a guest checkout only once its module accepts the `guest` argument (Stripe and Mollie do).
- `customer { orders }` is empty for a guest: the shop's guest account has no `oxregister` (140a, open there);
  the order confirmation page is the guest's receipt.
- No account creation after checkout, no saved guest addresses (out of scope of 140).

## Tests

`tests/e2e/guest-checkout.spec.ts`: guest → Stripe sandbox → order number (C1), empty form, delivery toggle,
`account_exists` and the login round trip, logged-in shopper, `checkout.guest: false`, phone layout. Unit:
`tests/unit/guestForm.spec.ts`, `guestCheckout.spec.ts`, `guestRoutes.spec.ts`. The e2e against the SDK shop
must run on port 5173: the shop's `sPaymentBaseHeadlessReturnOrigins` allows that origin only.
