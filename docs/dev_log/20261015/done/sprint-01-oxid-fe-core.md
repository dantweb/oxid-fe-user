# DONE — Sprint 01: oxid-fe-core v0.1.0, quality gate green

**Date:** 2026-10-15 · **Status:** delivered (S1–S3, S5–S7 core scope; S4 codegen + CLI manager deferred, see below)

## What was built (`oxid-fe-core/`, ~360 statements, ES lib 9.5 kB)

| Module | Delivered |
|---|---|
| `api/` | `GraphqlClient` (typed execute, bearer token provider, response interceptors) + `GraphqlError` mapping `extensions.errorCode` → stable codes (`basket_not_found`, `invalid_token`, …), network/http fallbacks |
| `auth/` | `AuthService` over graphql-base's `token(username?, password?)`: login, **anonymous guest tokens**, `ensureSession()`, logout, expiry detection emitting `auth:session-expired`; `TokenStorage` with memory fallback; jwt decode with the real graphql-base claims (`useranonymous`, `username`, `shopid`, …) |
| `events/` | `EventBus` + `CoreEvents` |
| `plugins/` | `IPlugin` contract (routes, navItems, per-locale messages, defaultConfig, setup) + `PluginRegistry` (duplicate guard, config merge, nav sorting, namespaced i18n, `setupAll`) |
| `guards/` | `createAuthGuard` for `meta.requiresAuth` with redirect-back |
| `stores/` | `createAuthStore` — Pinia mirror synced via core events |
| `validation/`, `utils/` | zod `addressSchema`, `formatPrice` (Intl, storefront Currency.name) |

## Quality gate (all green, host Node 22)

- **Tests:** 39/39 pass (9 spec files) · **Coverage:** 94.4% lines, 92.2% branches, 96.2% functions (target ≥90)
- **Lint:** eslint + prettier clean (`no-explicit-any` = error, zero suppressions in src)
- **Type-check:** `vue-tsc --noEmit` clean · **Knip:** no unused files/exports/deps
- **Build:** vite lib build + rolled-up `dist/index.d.ts`
- `scripts/evaluate.mjs` (violations report: suppressions, coverage, outdated deps) in place, wired into CI

## Deferred (tracked, not hidden)

- **S4 graphql-codegen types** — queries are typed by hand at call sites for now; codegen pipeline is the
  next core story (shop introspection needs a logged token for `#[Logged]` fields).
- **CLI plugin manager** — `plugins.json` is read by the host loader; manage it by editing the file until
  the CLI story lands. Refresh tokens likewise deferred (fingerprint cookie contract).
