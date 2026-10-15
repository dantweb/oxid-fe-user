# Status — 2026-10-15

**Day's arc:** research → sprint plan → implementation of sprints 0a, 0b, 0c, 01, 02.

| Sprint                      | Status          | Proof                                                                                                              |
| --------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------ |
| 00a Docker service          | ✅ done         | image builds, compose valid ([report](done/sprint-00a-docker-fe-core-service.md))                                  |
| 00b documentation           | ✅ done         | architecture, plugin contract, ADR-001/002, quality gates ([report](done/sprint-00b-project-documentation.md))     |
| 00c GitHub repos            | ✅ done, 1 open | repos pushed; **core CI green**; fe-user CI needs `REPO_READ_TOKEN` ([report](done/sprint-00c-github-repos.md))    |
| 01 oxid-fe-core             | ✅ done         | 39/39 tests, 94.4% lines, full gate green, CI green ([report](done/sprint-01-oxid-fe-core.md))                     |
| 02 oxid-fe-user             | ✅ done         | 7/7 unit, **Playwright 2/2 against the live shop**, gate green ([report](done/sprint-02-oxid-fe-user-host-app.md)) |
| 03 SEO                      | ⬜ next         | [plan](sprints/sprint-03-seo-spa.md)                                                                               |
| 04 checkout/payment plugins | ⬜              | [plan](sprints/sprint-04-checkout-payment-plugins.md)                                                              |
| 05 /dashboard               | ⬜              | [plan](sprints/sprint-05-user-dashboard.md)                                                                        |

**Violations ledger:** 0 suppressions/any-casts in both codebases (`npm run evaluate`).
**Known debt:** fe-user line coverage 18.5% (views proven by e2e, not unit-mounted); codegen
types, CLI plugin manager, refresh tokens deferred (named in the done-reports).
