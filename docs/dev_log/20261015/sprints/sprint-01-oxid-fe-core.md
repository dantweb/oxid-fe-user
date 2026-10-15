# Sprint 01 — oxid-fe-core: the shared library (vbwd-fe-core analogue, over OXID GraphQL)

**Date:** 2026-10-15 · **Repo:** `dantweb/oxid-fe-core` · **Status:** planned · **Depends on:** 00a, 00c

## Ask

The infrastructure library every OXID frontend app and plugin builds on — the role
[vbwd-fe-core](https://github.com/VBWD-platform/vbwd-fe-core) plays for VBWD: plugin system, typed API
client, JWT auth, event bus, validation, shared components, composables, access control, route guards.
The one structural difference to VBWD: the backend speaks **GraphQL** (graphql-base + graphql-storefront),
not REST, so the API layer is a GraphQL client with generated types instead of a REST `ApiClient`.

## Module map (mirrors vbwd-fe-core's `src/` layout)

| Module | Job |
|---|---|
| `api/` | `GraphqlClient`: fetch-based, typed `query()`/`mutate()`, request/response interceptors; maps GraphQL errors to typed errors keyed by `extensions.errorCode` (the stable codes payment-base and storefront emit, e.g. `basket_not_found`, `invalid_token`) |
| `auth/` | token lifecycle over graphql-base: `token` query (login), refresh tokens, **anonymous tokens** for guest browsing/baskets, storage, auto-refresh, `session-expired` event for the host's modal |
| `plugins/` | `PluginRegistry` + `IPlugin` SDK: a plugin registers routes, Pinia stores, i18n messages, nav items and named UI slots; `config.json` defaults + `admin-config.json` schema; plugin state in `plugins.json` |
| `cli/` | plugin manager (`list`, `install`, `uninstall`, `activate`, `deactivate`) maintaining `plugins.json` — the vbwd-fe-core CLI, reimplemented |
| `events/` | event bus for decoupled plugin ↔ host communication |
| `guards/` + `access-control/` | `requiresAuth` route guard, role/permission checks (anonymous vs `oxidcustomer`) |
| `stores/` | base Pinia stores: auth/session, shop config |
| `components/` + `composables/` | shared UI primitives (form fields, buttons, modal, pagination, price display with currency from the storefront `currency` query) and composables (`useAuth`, `useGraphql`, `usePagination`) |
| `validation/` | zod schemas for forms (address, registration) matching storefront input types |
| `types/` | generated TypeScript types from the storefront schema via `graphql-codegen` (introspection against the SDK shop at `<shop-url>/graphql/`; note: `#[Logged]` fields are hidden from anonymous introspection — codegen runs with a logged-in token) |
| `utils/` | shared helpers |

## Stories

| # | Story |
|---|---|
| S1 | Library scaffold: Vite lib mode (ESM + d.ts), Vitest, ESLint/Prettier, `vue-tsc`; builds in the 00a container |
| S2 | `GraphqlClient` + error mapping (TDD against a mocked transport; one integration test against the SDK shop) |
| S3 | `auth/`: login, refresh, anonymous token, storage, expiry events |
| S4 | `types/`: codegen pipeline + npm script; committed generated types, regeneration documented |
| S5 | `plugins/` + `cli/`: registry, IPlugin, slots, plugins.json, manager commands |
| S6 | `guards/`, `access-control/`, base `stores/` |
| S7 | `components/`, `composables/`, `validation/` |
| S8 | docs: per-module README sections + a worked "hello-world plugin" example |

## Acceptance

- Unit coverage ≥ 90% (vbwd-fe-core targets ≥ 95%; we start at 90 and ratchet).
- A demo app in `examples/` logs in against the SDK shop, fetches a product list with generated types,
  and loads the hello-world plugin through the registry.
- Published as `@dantweb/oxid-fe-core` `v0.1.0` (sprint 00c release flow).
