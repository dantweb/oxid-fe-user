# 2026-10-20

- Branch `feature/peroxid-language-switcher` (from `main` `622f63f`).
- Sprint 16 **implemented** (see its outcome section): core `feature/locale-switch` 0.9.2, user `feature/peroxid-language-switcher` 0.6.0; the switch now reloads the page so shop content follows (both headers).
- Sprint 16 planned: peroxid language switch as an Apex-like dropdown, same behaviour as the default header's switch
  (`sprints/sprint-16-peroxid-language-switch.md`). Tested first on `daniil.oxiddev.de:8443` (default: works) and `:2083`
  (peroxid: no switch) — evidence in `reports/language-switch-before/`.
- Housekeeping found while checking the mainlines: yesterday's merges landed with the TEMPORARY CI pins still in place
  (payment-base feature branch in stripe/mollie/paypal workflows; core feature `ref` in oxid-fe-user `ci.yml`) — to revert
  on `b-7.4.x` / `main`.
- stripe: `feature/session-locale-from-request-language` restored at `b98e559` (pay1's lock pins it; the branch had been deleted).
