# Quality gates

One source of truth for local work and CI — the same commands, byte-identical
(binding principles: [`dev_log/20261015/sprints/_engeneering_requirements.md`](dev_log/20261015/sprints/_engeneering_requirements.md)).

| Gate                  | Command                                   | oxid-fe-core    | oxid-fe-user             |
| --------------------- | ----------------------------------------- | --------------- | ------------------------ |
| Lint + format         | `npm run lint`                            | ✓               | ✓                        |
| Types                 | `npm run type-check` (`vue-tsc --noEmit`) | ✓               | ✓                        |
| Dead code             | `npm run knip`                            | ✓               | ✓                        |
| Unit tests + coverage | `npm run test:coverage`                   | ✓ (lines ≥ 90%) | ✓ (views proven by e2e)  |
| Build                 | `npm run build`                           | ✓ (lib + d.ts)  | ✓                        |
| E2E                   | `npm run test:e2e` (Playwright)           | —               | ✓ against a running shop |
| Violations report     | `npm run evaluate`                        | ✓               | ✓                        |

- CI (`.github/workflows/ci.yml` in each repo) runs the full set on every push to `main` and
  every PR. oxid-fe-user CI checks out `dantweb/oxid-fe-core` as a sibling over SSH with the
  `CORE_DEPLOY_KEY` secret — the private half of a **read-only deploy key** registered on
  oxid-fe-core (it can read that one repository and nothing else; no personal token in CI).
- `npm run evaluate` prints suppressions/any-casts in source, coverage, and outdated
  dependencies. Reviewed at every sprint close; the count only goes down or is justified in the
  day's dev_log (see the engineering requirements).
- E2E in CI is pending a reachable shop (sandbox/stage URL as a CI variable) — currently it runs
  locally against the SDK shop.
- The two-instance proof (`tests/e2e/instances.spec.ts`) skips unless both containers run:
  `E2E_BASE_URL=http://localhost:8090 E2E_INSTANCE_A_URL=http://localhost:8090 E2E_INSTANCE_B_URL=http://localhost:8091 npx playwright test instances`
  (SDK services `oxid-fe-user-prod` / `oxid-fe-user-prod-b`, built from one image).
- The responsiveness proof (`tests/e2e/peroxid-responsive.spec.ts`) runs as four extra Playwright
  **projects** — `iphone-17-pro` (WebKit: `npx playwright install webkit` once), `galaxy-s24`,
  `galaxy-s25-ultra`, `galaxy-z-fold-7` (Chromium) — so a plain `npx playwright test` includes
  them; `--project=chromium` runs the desktop suite only. Screenshots land in
  `docs/dev_log/<day>/reports/peroxid-responsive/`.
- `tests/e2e/deployed-config.spec.ts` proves a deployment really runs this repo's `oxid-config.yaml`:
  `E2E_BASE_URL=https://daniil.oxiddev.de:8443 npx playwright test deployed-config`.
- The payment proof (`tests/e2e/payments-*.spec.ts`, 14 tests: Stripe, PayPal, Mollie) completes
  real sandbox payments. Run it **serially** — all three specs use one shop customer, so parallel
  workers can interfere: `E2E_BASE_URL=https://daniil.oxiddev.de:2083 npm run test:e2e:payments`
  (`:8443` and `:2053` likewise; `:2053` enables only Stripe → `npx playwright test payments-stripe`).
  PayPal needs `PAYPAL_BUYER_EMAIL` / `PAYPAL_BUYER_PASSWORD` in the gitignored `tests/e2e/.env`
  (see `.env.dist`). `payments-evidence.spec.ts` regenerates the screenshots in
  `docs/dev_log/20261016/reports/payments/`.
