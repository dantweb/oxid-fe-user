# DONE — Sprint 00c: private repos dantweb/oxid-fe-core + dantweb/oxid-fe-user

**Date:** 2026-10-15 · **Status:** delivered with one open item (CI secret)

## What was done

- **S1:** both private repos created and pushed (`main`, SSH):
  https://github.com/dantweb/oxid-fe-core · https://github.com/dantweb/oxid-fe-user
- **S2 (ADR-002 accepted):** core consumed via `file:../oxid-fe-core` sibling layout in dev and
  CI; releases to GitHub Packages as `@dantweb/oxid-fe-core` (publish workflow = `npm publish`
  on tag, to be added with the first tagged release).
- **S3:** CI workflows live in both repos; **oxid-fe-core CI is green on main** (lint,
  type-check, knip, coverage, build, evaluate — run 38738851209, exit 0).
- **S5 partial:** `.editorconfig`-equivalent via prettier; license noted in package.json
  (BUSL-1.1). Branch protection not yet enabled (see open items).

## Open items

1. **oxid-fe-user CI is red** at the cross-repo checkout: the default `github.token` cannot read
   the private core repo, and the agent was not permitted to write repo secrets. Fix (one
   command, with a fine-grained PAT that has read access to dantweb/oxid-fe-core):
   `gh secret set REPO_READ_TOKEN --repo dantweb/oxid-fe-user --body <PAT>`
   — then `gh run rerun --repo dantweb/oxid-fe-user <run-id>`.
2. Branch protection on `main` (PR + green CI) — enable once the secret is in and CI is green,
   otherwise sprint pushes would lock themselves out.
3. First tagged release `v0.1.0` of core + GitHub Packages publish workflow (S4).
