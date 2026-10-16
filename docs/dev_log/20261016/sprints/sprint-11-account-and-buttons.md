# Sprint 11 — user account with Apex parity, and Apex's button styles

**Date:** 2026-10-16 · **Repos:** `oxid-fe-core` (styles), `oxid-fe-user` (account plugin, theme)
**Spec:** [`docs/account.md`](../../../account.md) (written first)

## Ask

"user account and button styles" — the same functionality of the user account as in the Apex theme.

## Starting point

- Existing `/dashboard`: tiles, orders (+ detail), addresses, profile (e-mail, password), newsletter
  toggle. Buttons are unstyled browser defaults.
- Apex (read in `vendor/oxid-esales/apex-theme`): dashboard cards with counts, the "Where do you want
  to go?" menu, password, newsletter, billing & shipping, order history, wish list, gift registry,
  reviews, downloads, forgot password, delete account; Bootstrap-5 buttons with Apex's variables.
- The storefront API covers all of it except compare list / listmania (off by default in Apex).

## Stories

| #   | Story                                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------- |
| S1  | Docs first: `docs/account.md`                                                                                           |
| S2  | Button / card / form styles in core (`styles/components.css`, 0.7.0) + `apex` theme; storefront buttons migrated        |
| S3  | Account layout (heading + dropdown menu with active entry and count badges) and dashboard cards with counts             |
| S4  | Password page, newsletter page, billing & shipping (addresses + profile) restyled and linked from the menu              |
| S5  | Wish list and gift registry (baskets `noticelist` / `wishlist`), "add to wish list" on the product page, public/private |
| S6  | Reviews, downloads, delete account (confirmation)                                                                       |
| S7  | Forgot / reset password (login link, mail key, new password)                                                            |
| S8  | e2e per feature + computed-style assertions for buttons; public ports; screenshots (default + apex)                     |
| S9  | Report, docs, quality gate, commit + push, CI                                                                           |

## Acceptance

- Every row of the feature map in `docs/account.md` works as a customer would use it, including the
  failure paths; menu and cards show the right counts.
- `.btn` variants match the Apex values (computed styles) in the default theme's structure and take
  their colours from theme tokens; the `apex` theme renders black primary buttons.
- Existing suites (catalog, checkout, payments, dashboard) unaffected.
