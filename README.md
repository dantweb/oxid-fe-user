# @dantweb/oxid-fe-user

Standalone Vue 3 storefront for a headless OXID eShop — a thin plugin-host app on
[@dantweb/oxid-fe-core](https://github.com/dantweb/oxid-fe-core), talking only to the shop's
GraphQL API (`graphql-base` + `graphql-storefront`). Modelled on
[vbwd-fe-user](https://github.com/VBWD-platform/vbwd-fe-user).

## Layout

```
src/            host: bootstrap, core wiring, router, i18n, layout, login
plugins/shop/   first-party shop plugin: catalog, product detail, guest cart
oxid-config.yaml.dist   template of the per-instance configuration (docs/instance-configuration.md)
instances/      example instance folders (oxid-config.yaml + public/ + plugins/)
docs/           architecture, instance configuration, sprints, dev_log
tests/e2e/      Playwright flows (run against the SDK shop or a deployed instance)
```

A plugin exports an `IPlugin` (routes, nav items, i18n messages, config, `setup()`); the host
registers the plugins the instance's `oxid-config.yaml` enables at boot (bundled, or external from
the instance's `plugins/` folder). Payment providers are plugins too.

One compiled bundle serves many instances (`shop1.oxid.dev`, `shop2.oxid.dev`, …): each differs
only by its mounted instance folder — config, languages, plugin set, `public/` overlay. See
[`docs/instance-configuration.md`](docs/instance-configuration.md).

## Development

Sibling layout with the core is required (`file:../oxid-fe-core`):

```bash
cd ../oxid-fe-core && npm ci && npm run build
cd ../oxid-fe-user && npm ci
cp .env.example .env            # VITE_SHOP_URL → your shop
npm run dev                      # http://localhost:5173, /graphql proxied to the shop
```

Inside the OXID Docker SDK the `oxid-fe-user` service (port 5173) has both repos mounted:
`make file=services/oxid-fe-user.yml addservice && make up`.

## Quality gate (same locally and in CI)

```bash
npm run lint && npm run type-check && npm run knip && npm run test:coverage && npm run build
npm run test:e2e   # Playwright against the dev server + live shop
npm run evaluate   # violations report
```

CI needs a sibling checkout of `dantweb/oxid-fe-core` — add a fine-grained PAT with read access
as the `REPO_READ_TOKEN` secret.

## Production image

```bash
# from the SDK root (both repos in the build context)
docker build -f oxid-fe-user/Dockerfile -t oxid-fe-user .
docker run -e API_UPSTREAM=https://shop.example.com -p 8080:80 oxid-fe-user
```

nginx serves the SPA and proxies `/graphql/` + `/out/pictures/` same-origin to `API_UPSTREAM`.

## License

BUSL-1.1.
