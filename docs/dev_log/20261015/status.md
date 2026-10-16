# Status — 2026-10-15

**Day's arc:** research → sprint plan → implementation of sprints 0a, 0b, 0c, 01, 02.

| Sprint                      | Status  | Proof                                                                                                                                                          |
| --------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 00a Docker service          | ✅ done | image builds, compose valid ([report](done/sprint-00a-docker-fe-core-service.md))                                                                              |
| 00b documentation           | ✅ done | architecture, plugin contract, ADR-001/002, quality gates ([report](done/sprint-00b-project-documentation.md))                                                 |
| 00c GitHub repos            | ✅ done | repos pushed; **core and fe-user CI green** (read-only deploy key) ([report](done/sprint-00c-github-repos.md))                                                 |
| 01 oxid-fe-core             | ✅ done | 39/39 tests, 94.4% lines, full gate green, CI green ([report](done/sprint-01-oxid-fe-core.md))                                                                 |
| 02 oxid-fe-user             | ✅ done | 7/7 unit, **Playwright 2/2 against the live shop**, gate green ([report](done/sprint-02-oxid-fe-user-host-app.md))                                             |
| 03 SEO                      | ✅ done | prerender+JSON-LD verified crawler-side ([report](done/sprint-03-seo-spa.md))                                                                                  |
| 04 checkout/payment plugins | ✅ done | e2e to sandbox.paypal.com + checkout.stripe.com ([report](done/sprint-04-checkout-payment-plugins.md)) — [plan](sprints/sprint-04-checkout-payment-plugins.md) |
| 05 /dashboard               | ✅ done | e2e 3/3: guard+redirect-back, orders, addresses, password change ([report](done/sprint-05-user-dashboard.md)) — [plan](sprints/sprint-05-user-dashboard.md)    |

**Violations ledger:** 0 suppressions/any-casts in both codebases (`npm run evaluate`).
**Known debt:** fe-user line coverage 18.5% (views proven by e2e, not unit-mounted); codegen
types, CLI plugin manager, refresh tokens deferred (named in the done-reports).
| 06 e2e catalog/category/checkout | ✅ done | 17/17 incl. completed Stripe payment, local + public ([report](done/sprint-06-e2e-catalog-category-checkout.md)) |
| 07 instance configuration | ✅ done | one image, two instances differ in name/language/plugins/robots ([report](done/sprint-07-instance-configuration.md)) |
| 08 theming | ✅ done | default + dark child theme per instance, make targets all executed ([report](done/sprint-08-theming.md)) |
