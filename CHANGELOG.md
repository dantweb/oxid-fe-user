# Changelog

## 0.7.1

SEC-1 — security advisories. Needs `@dantweb/oxid-fe-core` 0.11.0 (zod 4, the `/zod-csp` entry).

### Security

- **zod 4.6.7** (was 3), patching GHSA-mrhx-c7xc-m3w5. `src/config/schema.ts`: `.prefault({})` for object
  defaults (zod 4's `.default({})` no longer parses the inner defaults), two-argument `z.record`, `'custom'`
  issue code. `scripts/public-config.mjs` uses no zod.
- **happy-dom `^21.0.4`** (dev), patching GHSA-834v-8h66-3h79.
- **`src/zodConfig.ts`**: the first import of `main.ts` sets zod `jitless` through core's `/zod-csp` entry. Zod 4
  compiles parsers with `new Function`, a violation under a CSP without `'unsafe-eval'`. The storefront has no
  CSP today; this keeps it ready for one, and matches oxid-fe-admin.

## 0.7.0

Needs `@dantweb/oxid-fe-core` 0.10.0 (branch `feature/graphql-comply`) and payment-base 1.5 (guest checkout)
on the shop. Sprints 139b, 138f, 138e, 138c, 138d, 139c, 140c.

### Added

- **140c — Mollie guest e2e.** `guest-checkout.spec.ts` also pays a guest order on Mollie's hosted page (status Paid) and
  lands on the return page with the order number; PayPal cannot run against the SDK shop (its PayPal copy lacks `guest`).
- **138h — docs.** `docs/payments-keys.md` "Traces" table (what the headless flow leaves where, and what it does
  not); `docs/quality-gates.md` warns that Playwright traces hold the bearer token and the test login.

- **140c — checkout without an account.** `GuestDetailsForm` (e-mail, invoice address, "deliver elsewhere",
  country select from the shop), `GuestCheckoutView`, `CheckoutEntry` (customer or guest checkout by session).
  The checkout routes drop `requiresAuth` (`meta.guestCheckout`); instance option `checkout.guest` (default
  `true`; `false` restores the login redirect). Guest details live in the checkout store's memory only.
  `docs/checkout.md`.
- **139b — `?lang=` / `?shp=`.** `shop.language_ids` (locale → shop language id, default `{ de: 0, en: 1 }`) and
  optional `shop.id`; the host feeds core's `setEndpointParamsProvider` from the active locale. An unmapped
  locale sends no `lang`.
- **138f — errors by code.** `errors.<code>` i18n group (en/de, generic fallback, Stripe decline texts),
  `useErrorMessage`, `ErrorAlert`; every view and the checkout render translated text, never the raw message.
  Instance option `debug.errors` (default `false`) adds a collapsible details block (code + raw message).
- **139c — payment state of an order.** The dashboard orders list shows a badge from
  `Order.paymentContract { state provider }`; a shop without the field is asked again without it.
- **138d — log hygiene.** nginx `log_format headless` (`$uri`, no query string) for the container.

### Changed

- **138e — browser storage.** `oxfe_checkout_attempt` is removed on a failed or pending (after the wait)
  return, on cancel and on logout; a return that could not reach the shop keeps it. Logout calls core's
  revoking `logout()`. `docs/architecture.md` has the sessions table.
- **138c — no identifiers in URLs.** The return, cancel and password-reset pages remove their query string
  (`history.replaceState`) once they have read it; the reset key lives in component state.
- Inline payment components emit `failed` with the cause instead of a message string.
- Mollie's card-token error no longer shows Mollie.js' own text.
- `createAppRouter(registry, auth, config)` takes the instance config.

### Config keys for deployments (hydroxid)

`shop.language_ids`, `shop.id`, `checkout.guest`, `debug.errors` — all rendered by `scripts/public-config.mjs`
(allow-list) and validated by `src/config/schema.ts`. Strings to translate for a new locale: `errors.*`
(host catalog), `checkout.guest.*`, `dashboard.orders.payment.*` (plugin catalogs).
