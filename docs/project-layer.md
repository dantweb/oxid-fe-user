# The project layer — building a client project on oxid-fe-user

```
oxid-fe-core   internal library (contracts, GraphQL client, auth, styles)
   ↑
oxid-fe-user   the storefront application (plugins: shop, checkout, payments, dashboard, peroxid …)
   ↑
<project>      a client's repository: depends on oxid-fe-user, brings its own plugins, themes, instances
```

A project (e.g. `dantweb/hydroxid-project`) is its **own app shell**: an `index.html`, a `vite.config.ts`
and a `main.ts` that calls this package.

## What this package exposes (`exports`)

| Import                                 | What                                                               |
| -------------------------------------- | ------------------------------------------------------------------ |
| `@dantweb/oxid-fe-user/bootstrap`      | `startStorefront({ plugins })`, `bundledPlugins`                   |
| `@dantweb/oxid-fe-user/plugins/<name>` | a bundled plugin (e.g. `dashboard`) — to wrap, extend or re-export |
| `@dantweb/oxid-fe-user/theme-tools`    | `buildThemes`, `stageThemeSources` — compile the project's themes  |

```ts
// project src/main.ts
import { startStorefront } from '@dantweb/oxid-fe-user/bootstrap';
startStorefront({
  plugins: {
    dashboard: () => import('./plugins/dashboard-override'), // same name → REPLACES the bundled plugin
    'gdpr-cookie-consent': () => import('./plugins/gdpr-cookie-consent'), // new name → added
  },
});
```

The instance's `oxid-config.yaml` still decides which plugins run (and in which order — a layout
plugin is listed last so it wins its slots).

## Overriding a plugin

0. **Extending a plugin:** the project's plugin spreads the original (`{ ...peroxid, overrides: { ...peroxid.overrides, footer } }`), keeps its `name` (so message namespaces such as `peroxid.*` keep working) and may be registered under a project-friendly loader key (`startStorefront({ plugins: { hydroxid: () => import(…) } })` → `hydroxid:` in `oxid-config.yaml`). Components of a plugin can be wrapped through `@dantweb/oxid-fe-user/plugins/<name>/components/<File>.vue`.
1. **By name:** register a plugin under the bundled plugin's name; the project's replaces it. The
   usual shape is to _extend_ the original: `import base from '@dantweb/oxid-fe-user/plugins/dashboard'`
   and return `{ ...base, routes: [...], messages: { … } }`.
2. **By slot:** a layout plugin supplies `overrides: { header, footer, home }` (see layout-plugins.md).
3. **Global components:** `overlays: [() => import('./Banner.vue')]` renders a component on every
   page (cookie consent, banners) — core 0.8.0.

## Themes

Project themes live in the project's `themes/<id>/` (same anatomy as `resources/themes`, plus an
optional `fonts/` folder copied next to the styles). A project theme may name a base theme as its
`parent` (`@import '../../default/styles/styles.less'`): `stageThemeSources([baseThemes, ownThemes],
tmp)` merges both before `buildThemes`.

## Dependency wiring

oxid-fe-user depends on core through `file:../oxid-fe-core` (the SDK layout). A project overrides
that in its own `package.json`:

```json
"dependencies": {
  "@dantweb/oxid-fe-user": "github:dantweb/oxid-fe-user#v0.3.1",
  "@dantweb/oxid-fe-core": "github:dantweb/oxid-fe-core#v0.8.0"
},
"overrides": { "@dantweb/oxid-fe-core": "github:dantweb/oxid-fe-core#v0.8.0" }
```

Core builds itself on install (`prepare`). The packages are private; CI authenticates with
read-only deploy keys (see the project's `docs/ci.md`).
