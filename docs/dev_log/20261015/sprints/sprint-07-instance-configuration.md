# Sprint 07 — instance configuration (`oxid-config.yaml`)

**Date:** 2026-10-15 · **Repo:** `dantweb/oxid-fe-user` + SDK compose · **Depends on:** 02–06
**Spec of the file:** [`docs/instance-configuration.md`](../../../instance-configuration.md)
(written first, as asked) · **Template:** `oxid-config.yaml.dist` in the repo root.

## Ask

A running instance is configured by a file. One compiled TS/JS bundle must serve many instances
(`shop1.oxid.dev`, `shop2.oxid.dev`, …) that differ only by their `oxid-config.yaml` and their
`public/` and `plugins/` folders — each with its own languages. `oxid-config.yaml.dist` is the
home for every instance-specific variable (`plugins.json` is retired into it).

## Stories

| #   | Story                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Docs + template first: `docs/instance-configuration.md`, `oxid-config.yaml.dist`                                                                                                |
| S2  | `src/config/`: zod schema with defaults + cross-checks, YAML parser, runtime loader (`/oxid-config.yaml`; absent → defaults; present-but-invalid → loud failure), unit tests    |
| S3  | Boot from config: GraphQL URL, shop name (`app.title`), locales + language switcher, plugin set (bundled and external) — replaces `plugins.json`                                |
| S4  | nginx: serve the instance file, `public/` overlay first, `plugins/` folder; Dockerfile ships a default instance; Vite dev middleware serves the local file                      |
| S5  | SDK: **remove the `oxid-fe-core` compose service** (core is a library consumed by oxid-fe-user, not a container); `oxid-fe-user` services mount instance dirs                   |
| S6  | Proof: two containers from **one image**, different instance dirs (name, languages, plugin set, public overlay, external plugin) — e2e asserts they differ; suite green on both |

## Acceptance

- One image, two instance folders → visibly different shops (name, language(s), enabled plugins,
  robots.txt, an external-plugin nav item) with no rebuild.
- Invalid config fails loudly; missing config = defaults; unit-tested.
- Quality gate green; sprint-06 e2e still green against an instance built from the `.dist`.
