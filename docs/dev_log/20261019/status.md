# 2026-10-19

- Sprint 12 (API request caching) and Sprint 13 (search to the shop plugin, scale-safe) implemented in `oxid-fe-core`, `oxid-fe-user`, `hydroxid-project`; details in `sprints/` ("Outcome" sections).
- `bin/pre-commit-check.sh` added to all three repos; all gates green locally.
- Decision: the shop core gets no `OXTITLE` index, so the search stays `contains` (prefix match reverted); protection is in the storefront only.
- Debt / open: scale limit of `contains` on millions of rows; release tags and HydroXid pin bump pending; nothing is committed.

## Sprints 14 + 15 (later the same day)

- **Sprint 14** (stale token heals itself): done in core + user, verified by unit tests and e2e; see its outcome section.
- **Sprint 15** (payment keys sealed from the backend): frontend and config done and verified; the four PHP backend pieces are committed locally in module worktrees (not pushed); the real end-to-end payment (S7) and key rotation (S8) are NOT done. Details and open items in the sprint-15 outcome section.
- Branches: `feature/stale-token-and-sealed-keys` in oxid-fe-core, oxid-fe-user, hydroxid-project (pushed); `feature/sealed-client-config` in payment-base, stripe, paypal, mollie-payment (local worktrees only).
