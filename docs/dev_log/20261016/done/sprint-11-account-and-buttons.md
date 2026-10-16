# DONE — Sprint 11: user account with Apex parity, and Apex's button styles

**Date:** 2026-10-16 · **Status:** delivered (S1–S9) · **Spec:** [account.md](../../../account.md)

## What was built

- **core 0.7.0:** `styles/components.css` — `.btn` (+ `-primary`, `-outline-primary`, `-secondary`,
  `-danger`, `-link`, `-sm`, `-lg`), `.stretched-link`, `.card`, `.badge`, `.form-control`, `.alert`;
  geometry from Apex's compiled stylesheet, colours from the theme tokens. `createSavedListsApi`
  (wish list = basket `noticelist`, gift registry = basket `wishlist`; get / add / remove /
  public ⇄ private / count), tests first (incl. the shop answering _not found_ instead of null).
- **`apex` theme** (child of `default`): black primary, white surfaces. Storefront buttons (sign-in,
  checkout, cart, catalog, product, header, banner, Mollie) now use the shared classes.
- **Account area (`dashboard` 0.2.0):** one **account layout** — "Hello <name>" and Apex's dropdown
  "Where do you want to go?" with the active page marked and count badges — around every page:
  - dashboard **cards** with counts (orders, password, newsletter status, billing & shipping,
    downloads _if any_, wish list, gift registry, reviews _if any_, delete account), whole card clickable;
  - **change password** (repeat check, wrong old password refused, fresh token adopted);
  - **newsletter** (double opt-in pending state); **billing & shipping** (invoice address, delivery
    addresses add/delete, **e-mail change**); **order history** + details;
  - **wish list** and **gift registry** (public ⇄ private), "add to wish list / gift registry" on the
    product page (guests are offered to sign in); **reviews**; **downloads**; **delete my account**
    behind an explicit confirmation step;
  - **forgot / reset password** (`/forgot-password`, `/reset-password?uid=…`, login link; neutral
    answer for unknown addresses).

## Verified

| Run                                                   | Result                                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `account.spec` (11) + `account-buttons.spec` (7), dev | 18 / 18                                                                                                 |
| same, public `:2083`, `:8443`, `:2053`                | 18 / 18 each (see notes)                                                                                |
| shop settings **on** (reviews + deletion)             | review deleted, account deleted ✓                                                                       |
| unit (app / core), lint, knip, tsc, build             | 99 / 70, all green                                                                                      |
| button styles vs Apex                                 | padding / radius / border / line-height / disabled opacity / colours via tokens, default + `apex` theme |

Screenshots of every account page in both themes: [reports/account](../reports/account/).

## Notes / debt

- **Shop-gated features:** deleting a review (`blAllowUsersToManageTheirReviews`) and deleting the
  account (`blAllowUsersToDeleteTheirAccount`) are shop settings, **off** in the SDK shop. The API
  does not expose them, so the SPA lets the shop answer and shows the message; the real deletion was
  proven by switching both settings on temporarily (restored afterwards).
- **Not in the API → out of scope:** compare list and listmania (off by default in Apex too);
  actual file download (`OrderFile` has no URL — the list shows name, downloads used / allowed, expiry).
- **Forgot-password mail** links to the shop's `cl=forgotpwd&uid=…`; a headless deployment forwards
  it to `/reset-password?uid=…` (documented in account.md).
- **Intermittent, not reproduced:** one `account.spec` billing test timed out on `:8443` right after
  the containers were recreated (12 / 12 on repeat); a hover-colour assertion was flaky until the probe
  disabled the CSS transition.
- **Full public regression (`:8443`, serial, before the fix below):** 67 passed, 11 skipped, 3 failed —
  two legacy specs (`checkout`, `checkout-stripe-complete`) prove the _hosted_ flow and failed
  because instance A now runs iframe mode; they now force `mode: redirect` (`HOSTED_PAYMENTS_CONFIG`)
  and pass (9/9 with the Stripe payment spec). The third, `payments-stripe` "paying commits", timed
  out waiting for the return route in the long run and passes alone and on rerun — the same
  unexplained intermittent as in sprint 10 (only seen on `:8443` in long runs; suspected Stripe
  sandbox timing), still open.
