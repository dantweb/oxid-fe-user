# 2026-10-19

- Sprint 12 (API request caching) and Sprint 13 (search to the shop plugin, scale-safe) implemented in `oxid-fe-core`, `oxid-fe-user`, `hydroxid-project`; details in `sprints/` ("Outcome" sections).
- `bin/pre-commit-check.sh` added to all three repos; all gates green locally.
- Decision: the shop core gets no `OXTITLE` index, so the search stays `contains` (prefix match reverted); protection is in the storefront only.
- Debt / open: scale limit of `contains` on millions of rows; release tags and HydroXid pin bump pending; nothing is committed.
