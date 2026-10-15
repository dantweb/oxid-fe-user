# DONE — Sprint 00b: project documentation baseline

**Date:** 2026-10-15 · **Status:** delivered

| Deliverable                                                                     | Where                                                           |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| READMEs (purpose, quickstart, commands, gate)                                   | `oxid-fe-core/README.md`, `oxid-fe-user/README.md`              |
| Architecture (host/plugin model, GraphQL deps by module+branch, proxy topology) | `docs/architecture.md`                                          |
| Plugin contract (`IPlugin`, rules, payment-plugin preview)                      | `docs/plugin-contract.md`                                       |
| ADR-001 SPA-first (accepted; SSR decided in sprint 03)                          | `docs/adr/ADR-001-spa-first.md`                                 |
| ADR-002 core distribution (accepted: npm + `file:` sibling; submodule rejected) | `docs/adr/ADR-002-core-distribution.md`                         |
| dev_log convention                                                              | `docs/dev_log/20261015/{reports,sprints,done,status.md}` in use |
| Quality gates (one table, local = CI)                                           | `docs/quality-gates.md`                                         |

Both ADRs were decided during implementation (sprints 01/02 built on them), so they are recorded
as accepted rather than proposed — the deciding evidence is in the done-reports.
