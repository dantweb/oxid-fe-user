# DONE — Sprint 05: account area at /dashboard (pure SPA, excluded from SEO)

**Date:** 2026-10-15 · **Status:** delivered (S1–S7; deviations below)

## What was built

- **dashboard plugin**: `/dashboard` (overview: email, tiles, newsletter status + toggle),
  `/dashboard/orders` (+ `/:id` detail with items and total), `/dashboard/addresses` (invoice
  address edit, delivery addresses list/add/delete), `/dashboard/profile` (password change) —
  every route `requiresAuth`, every view `noindex,nofollow`, nav item only for signed-in users.
- **SEO exclusion enforced by test (S5)**: a unit test asserts the prerender/sitemap route list
  can never contain `/dashboard` and robots.txt disallows it — a route addition that leaks fails CI.
- **core v0.2.x**: `AuthService.adoptToken()` — see findings.

## Verified (Playwright, real shop: 3/3 — full suite 9/9)

- Guest on `/dashboard` → redirected to `/login?redirect=…` → signing in lands back on
  `/dashboard`; noindex meta present.
- Orders empty-state; invoice address saved; delivery address added and listed; newsletter
  toggle → "confirmation pending".
- Password change → logout → **sign-in with the new password works**.

## Findings (real API contracts, discovered by the e2e)

1. **`customerPasswordChange` answers a fresh `LoginInterface { accessToken }`** — the old JWT
   dies with the old password. The view adopts the new token (`AuthService.adoptToken`),
   otherwise the user is silently logged out after changing their password.
2. **Newsletter is double-opt-in**: `newsletterSubscribe` → `MISSING_DOUBLE_OPTIN` until the
   emailed code is confirmed (`newsletterOptIn(email, confirmCode)` is the _confirmation_, not
   the subscription). The dashboard shows the pending state; the confirm-by-link page is a
   follow-up (needs the mail template's link to point at the frontend).

## Deviations

- Reviews and wished-price management (optional stories) not included.
- Order detail reuses the orders query and filters client-side (no single-order query in the
  storefront schema); fine at account-history sizes.
- Address form markup exists in checkout and dashboard; the shared piece (zod schema) lives in
  core — extracting a core AddressForm SFC needs core's build to learn .vue first (noted for a
  core story).
