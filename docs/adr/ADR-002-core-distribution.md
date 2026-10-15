# ADR-002: oxid-fe-core consumed as an npm package, sibling `file:` link for development

**Status:** accepted (2026-10-15) · **Decides:** how oxid-fe-user depends on oxid-fe-core

## Context

vbwd consumes its core as a git submodule. Alternatives: npm package (GitHub Packages) or a
`file:` sibling dependency.

## Decision

- **Development:** `"@dantweb/oxid-fe-core": "file:../oxid-fe-core"` with the two repos as
  siblings — in the SDK root and in CI (two checkouts, same layout). Core is built
  (`npm run build`) before the app installs; the app consumes `dist/` through the package
  `exports`.
- **Releases:** core publishes `v0.x.y` to **GitHub Packages** (scope `@dantweb`); consuming
  apps outside this workspace pin the published version. Submodules were rejected: implicit
  source coupling, no versioning, painful CI auth.

## Consequences

- oxid-fe-user CI needs a read token for the private core repo (`REPO_READ_TOKEN`).
- A core change only reaches the app after `npm run build` in core — cheap, explicit, and the
  same contract as the published package.
