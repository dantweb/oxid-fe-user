# Instance configuration — `oxid-config.yaml`

One **compiled** oxid-fe-user bundle can serve any number of storefront instances
(`shop1.oxid.dev`, `shop2.oxid.dev`, `shop3.oxid.dev`, …). What makes an instance an instance is
a small folder, mounted into the container at deploy time — **not** a rebuild:

```
<instance dir>/                      mounted at /etc/oxid-fe-instance in the container
├── oxid-config.yaml                 the instance's configuration (template: oxid-config.yaml.dist)
├── public/                          optional file overlay: robots.txt, favicon, images, …
└── plugins/                         optional external plugins: plugins/<name>/index.js
```

Everything instance-specific lives there: shop name, languages, which plugins are active and
their settings, extra files, extra plugins. The app bundle is identical for all of them.

## How it is loaded

1. nginx serves the instance's file at `GET /oxid-config.yaml` (never cached).
2. Before the app mounts, `src/config/` fetches and parses it, **validates it with a zod
   schema** and fills defaults. A file that is present but invalid stops the app with a clear
   error screen instead of half-starting; a file that is **absent** (plain `npm run dev` without
   one) means "all defaults" — everything bundled, `en`+`de`.
3. The validated config drives: the GraphQL URL, i18n locales, the shop name, and which plugins
   load (bundled or external) with which config.

> **The browser downloads this file.** It must contain no secrets (no API keys, no tokens).
> Secrets belong to the shop (OXID module settings) and never to the frontend.

## Reference

| Key                      | Default           | Meaning                                                                                                             |
| ------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| `instance.id`            | `default`         | machine name of the instance (logs, support)                                                                        |
| `instance.name`          | `OXID Storefront` | shop name — header, footer, `<title>` suffix (`app.title` in every locale)                                          |
| `shop.graphql_url`       | `/graphql/`       | the shop's GraphQL endpoint as the browser reaches it; same-origin recommended (nginx proxies it to `API_UPSTREAM`) |
| `i18n.locales`           | `[en, de]`        | languages offered by this instance; **more than one** shows a language switcher; bundled catalogs: `en`, `de`       |
| `i18n.default_locale`    | `en`              | initial language (must be in `locales`); the browser language wins if it is in `locales`                            |
| `i18n.fallback_locale`   | `en`              | catalog used for missing keys                                                                                       |
| `theme.default`          | `default`         | fallback theme when `active` cannot be loaded (see `theming.md`)                                                    |
| `theme.active`           | = `theme.default` | the theme this instance runs: `resources/themes/<id>/`                                                              |
| `plugins.<name>.enabled` | `true`            | `false` → plugin not loaded: no routes, no nav entry                                                                |
| `plugins.<name>.source`  | `bundled`         | `bundled` = compiled into the app; `external` = loaded at runtime from `<instance>/plugins/<name>/index.js`         |
| `plugins.<name>.config`  | `{}`              | merged over the plugin's `defaultConfig` (e.g. `products_per_page`)                                                 |

## The `public/` overlay

nginx looks in `<instance>/public/` **first** and falls back to the compiled app: put a
`robots.txt`, `favicon.ico`, `images/…` there and they win over the bundle's copy. Typical use:
a staging instance with `Disallow: /` while production allows indexing.

## External plugins

`source: external` plugins are plain ES modules (`<instance>/plugins/<name>/index.js`) whose
default export is an `IPlugin` (see `plugin-contract.md`). They are loaded with a dynamic
`import()` at boot, so an instance can ship its own plugin **without rebuilding the app**.

Constraint: an external module is a separate file and cannot share the app's bundled `vue`;
therefore keep it to what needs no Vue import — nav items, messages, route **redirects**, event
handlers in `setup(ctx)` (the context gives client, auth, events, registry, config). UI-heavy
plugins belong in the bundle (`source: bundled`).

## Deploying several instances from one image

```bash
docker run -d -p 8081:80 -e API_UPSTREAM=https://shop1.example.com \
  -v /srv/oxid-fe/shop1:/etc/oxid-fe-instance:ro  oxid-fe-user
docker run -d -p 8082:80 -e API_UPSTREAM=https://shop2.example.com \
  -v /srv/oxid-fe/shop2:/etc/oxid-fe-instance:ro  oxid-fe-user
```

`API_UPSTREAM` (container environment) says which OXID shop the instance proxies to — it is
deployment wiring, not frontend config. The image ships a default instance (the `.dist`) so it
also runs with no mount.

## Local development

`npm run dev` serves `oxid-config.yaml` from the project root at `/oxid-config.yaml` (falling
back to `oxid-config.yaml.dist`). `oxid-config.yaml` is gitignored; copy the `.dist` and edit.

## Known limits

- **Prerendered SEO snapshots** (`npm run build:seo`, ADR-003) are generated with the config
  present at build time. Instances with different languages/names need their own SEO build
  (run it with that instance's config) — an SSR move (ADR-001/003 upgrade path) removes this.
