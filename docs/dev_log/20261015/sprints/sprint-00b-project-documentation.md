# Sprint 00b — project documentation baseline

**Date:** 2026-10-15 · **Repos:** `oxid-fe-core`, `oxid-fe-user` · **Status:** planned

## Ask

Before code: the documentation skeleton that every later sprint writes into, so decisions and contracts
are recorded where the VBWD repos record theirs (README + docs/ + per-day dev_log).

## Deliverables

| #   | Deliverable                                        | Content                                                                                                                                                                                                                 |
| --- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | `oxid-fe-user/README.md`, `oxid-fe-core/README.md` | purpose, quickstart (SDK container from sprint 00a), commands, repo map                                                                                                                                                 |
| D2  | `docs/architecture.md` (in oxid-fe-user)           | the big picture: host app + PluginRegistry + plugins; OXID GraphQL Storefront as the only backend API; payment-base headless checkout contract; diagram of the request flow (browser → nginx → `/graphql` proxy → shop) |
| D3  | `docs/plugin-contract.md`                          | the `IPlugin` interface (routes, Pinia stores, i18n messages, nav items, config.json / admin-config.json), modelled on vbwd-fe-user-plugin-shop; versioning rules between core and plugins                              |
| D4  | `docs/adr/` + template                             | ADR-001: SPA-first, SSR/prerender decision deferred to sprint 03. ADR-002: how oxid-fe-user consumes oxid-fe-core — npm package (GitHub Packages) vs git submodule (the VBWD way); decide in sprint 00c                 |
| D5  | `docs/dev_log/` convention                         | same convention as the payment modules: `dev_log/<YYYYMMDD>/{status.md,done/,reports/,sprints/}`; this sprint plan and the research report are the first entries                                                        |
| D6  | `docs/quality-gates.md`                            | lint (ESLint+Prettier), `vue-tsc` type-check, Vitest coverage target, Playwright e2e, pre-commit script — mirrored in CI (sprint 00c)                                                                                   |

## Source material

- Research report: `docs/dev_log/20261015/reports/headless-oxid-vue-frontend-perspectives.md`
- Backend contract: `source/vendor/oxid-esales/payment-base/docs/graphql-headless-checkout.md`
- VBWD references: vbwd-fe-core (library layout, plugin SDK, CLI), vbwd-fe-user (host app, nginx,
  Docker), vbwd-fe-user-plugin-shop (plugin anatomy, config.json/admin-config.json)

## Acceptance

- All six deliverables exist and are linked from the two READMEs.
- `docs/architecture.md` names every GraphQL dependency by module and branch (graphql-base,
  graphql-storefront b-7.4.x, payment-base headless mutations) so backend upgrades can be impact-checked.
- ADR-001/002 are written as "proposed" with the deciding sprint named.
