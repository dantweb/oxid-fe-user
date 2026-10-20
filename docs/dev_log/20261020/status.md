# 2026-10-20

- Sprint 17 **done**: 5 M seeded rods in a cloned `example_perf` (`:8094`); quicksearch timed over GraphQL + SQL probes for no index /
  B-tree / FULLTEXT on `OXTITLE`+`OXSHORTDESC`. **No gain for `contains`** (~0.3 s frequent, ~20 s rare in all runs); B-tree helps prefix search only
  (13.5 s → < 2 ms); FULLTEXT fails on shared words. Report: `reports/search-index-perf/report.md`. Branch `feature/search-index-perf` (oxid-fe-user).
- Sprint 17 planned: measure the gain from `oxarticles.OXTITLE`/`OXSHORTDESC` indexes for the quicksearch on 5 M seeded "metal rod" articles
  in a cloned `example_perf` DB — runs none / B-tree / FULLTEXT, report with SVG charts (`sprints/sprint-17-search-index-perf.md`).
- Branch `feature/peroxid-language-switcher` (from `main` `622f63f`).
- Sprint 16 **implemented** (see its outcome section): core `feature/locale-switch` 0.9.2, user `feature/peroxid-language-switcher` 0.6.0; the switch now reloads the page so shop content follows (both headers).
- Sprint 16 planned: peroxid language switch as an Apex-like dropdown, same behaviour as the default header's switch
  (`sprints/sprint-16-peroxid-language-switch.md`). Tested first on `daniil.oxiddev.de:8443` (default: works) and `:2083`
  (peroxid: no switch) — evidence in `reports/language-switch-before/`.
- Housekeeping found while checking the mainlines: yesterday's merges landed with the TEMPORARY CI pins still in place
  (payment-base feature branch in stripe/mollie/paypal workflows; core feature `ref` in oxid-fe-user `ci.yml`) — to revert
  on `b-7.4.x` / `main`.
- stripe: `feature/session-locale-from-request-language` restored at `b98e559` (pay1's lock pins it; the branch had been deleted).
