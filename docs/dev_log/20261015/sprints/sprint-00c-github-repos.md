# Sprint 00c — private repos dantweb/oxid-fe-core and dantweb/oxid-fe-user

**Date:** 2026-10-15 · **Status:** planned

## Ask

Two private GitHub repositories under the `dantweb` account, with CI from day one, and a decided
distribution mechanism between the two.

## Stories

| # | Story | Done when |
|---|---|---|
| S1 | `gh repo create dantweb/oxid-fe-core --private` and `gh repo create dantweb/oxid-fe-user --private`; default branch `main`; push the sprint-00a/00b scaffolds as the initial commits | both repos exist, clones work |
| S2 | **Distribution decision (closes ADR-002)**: oxid-fe-core consumed as a scoped npm package `@dantweb/oxid-fe-core` published to GitHub Packages (recommended — explicit versioning, CI-installable with a token), with git submodule (the VBWD pattern) documented as the rejected alternative and `npm link` / `file:` documented for local two-repo development inside the SDK container | ADR-002 accepted, oxid-fe-user installs the package |
| S3 | **CI** (GitHub Actions, both repos): on PR and push to main — `npm ci`, lint, type-check, unit tests; oxid-fe-core additionally `npm run build` + pack; oxid-fe-user additionally a Playwright job (allowed to be a skeleton until sprint 02). Node version matches the SDK container | first green run on main |
| S4 | **Release flow** for oxid-fe-core: tag `v0.x.y` → workflow publishes to GitHub Packages | `v0.1.0` published |
| S5 | **Repo hygiene**: branch protection on `main` (PR + green CI required), CODEOWNERS, `.editorconfig`, license file (private/BSL-style, mirroring the VBWD repos' BSL-1.1 stance — confirm with the owner) | settings verified |

## Constraints

- Private repos: no secrets in code; the shop URL and tokens used by e2e come from env/CI secrets.
- The CI commands must be byte-identical to what runs in the SDK container (sprint 00a) — one source of
  truth, documented in `docs/quality-gates.md`.

## Acceptance

- A fresh `git clone` of oxid-fe-user + `npm ci` (with a GitHub Packages token) installs
  `@dantweb/oxid-fe-core` and builds.
- Both repos: PR without green CI cannot merge to `main`.
