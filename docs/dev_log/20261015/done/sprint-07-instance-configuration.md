# DONE — Sprint 07: instance configuration (`oxid-config.yaml`)

**Date:** 2026-10-15 · **Status:** delivered (S1–S6)

## What was built

- **Docs first (S1):** `docs/instance-configuration.md` (the reference) and
  `oxid-config.yaml.dist` (the template) before any code.
- **Config module (S2):** `src/config/` — zod schema with defaults and a cross-check
  (`default_locale` must be offered), YAML parser, runtime loader for `/oxid-config.yaml`:
  **absent → defaults, present-but-invalid → loud failure** (a visible error screen, never a
  half-started app). 16 unit tests.
- **Boot from config (S3):** GraphQL URL, shop name (`app.title` in every language), locales
  (+ language switcher when more than one, choice remembered), plugin set — bundled _or_
  external. `plugins.json` is retired into the config file.
- **Delivery (S4):** nginx serves the instance's `oxid-config.yaml` (no-store), a
  `public/` overlay that wins over the bundle (robots.txt, favicon, images…) and a `plugins/`
  folder for external ES-module plugins; the image ships the `.dist` as a default instance; the
  Vite dev/preview server serves the local `oxid-config.yaml` (fallback `.dist`).
- **SDK (S5):** the **`oxid-fe-core` compose service is removed** (library, not a container;
  README rewritten: it is built with Node and mounted into the `oxid-fe-user` container);
  `oxid-fe-user-prod` and a new `oxid-fe-user-prod-b` mount `instances/example-a|b` into **one
  image** (`oxid-fe-user:local`).

## Verified (S6)

Two containers from one image, no rebuild between them — `tests/e2e/instances.spec.ts` (7/7):

|                   | Instance A (`:8090`)   | Instance B (`:8091`)                                       |
| ----------------- | ---------------------- | ---------------------------------------------------------- |
| shop name         | OXID Storefront        | Shop Zwei (also `<title>`)                                 |
| language          | en + de, switcher      | de only, no switcher, UI in German                         |
| products/page     | 12                     | 6                                                          |
| robots.txt        | bundle's (`Allow /`)   | **overlay**: `Disallow: /`                                 |
| plugins           | all                    | shop, checkout, Stripe, dashboard + **external `promo`**   |
| checkout payments | PayPal, Stripe, Mollie | Stripe only                                                |
| nav               | —                      | "Mützen-Angebote" from the external plugin → Caps category |

Full suite: **17/17** on the dev server (twice) and **17/17 against the public instance
`https://daniil.oxiddev.de:8443`** (three runs); unit 42/42; lint, vue-tsc, knip clean.

## Findings fixed on the way

1. **Per-instance plugin sets exposed a checkout flaw:** the payment step listed every payment
   the shop offers, so an instance without the PayPal plugin still showed PayPal (which can
   only fail on the classic path). Contract-first payments (`oe_payments_*`, payment-base's
   provider prefix) without an installed plugin are now hidden; invoice/COD stay classic.
2. e2e helpers de-duplicated (`tests/e2e/helpers/session.ts` — register customer / sign in,
   used by four specs); assertion timeout raised to 15 s for deployed targets (lazy route
   chunks through a tunnel exceeded 5 s intermittently).
3. vue-i18n's dynamic message typing needs one `unknown` cast at the JSON boundary (commented).

## Known limits (documented in the reference)

- Prerendered SEO snapshots are generated with the config present at build time; instances with
  different languages/names need their own SEO build.
- External plugins cannot share the bundled Vue — they are limited to nav items, messages,
  route redirects and event/context logic; UI-heavy plugins stay bundled.
- The `theme` section arrives with sprint 08.
