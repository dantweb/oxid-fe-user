# @dantweb/oxid-fe-user

Standalone Vue 3 storefront for a headless OXID eShop — a thin plugin-host app on
[@dantweb/oxid-fe-core](https://github.com/dantweb/oxid-fe-core), talking only to the shop's
GraphQL API (`graphql-base` + `graphql-storefront`). Modelled on
[vbwd-fe-user](https://github.com/VBWD-platform/vbwd-fe-user).

## Layout

```
src/            host: bootstrap, core wiring, router, i18n, layout, login
plugins/shop/   first-party shop plugin: catalog, category, product detail, guest cart, search
plugins/peroxid/ layout plugin: overrides header/footer/front page (cart icon, hero, streams; places the shop's search box)
oxid-config.yaml.dist   template of the per-instance configuration (docs/instance-configuration.md)
resources/themes/       themes: <id>/config.json + styles/styles.less + images/ (docs/theming.md)
Makefile                theme, compile, build, run, dev, debug, … — `make help`
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
cp oxid-config.yaml.dist oxid-config.yaml   # this deployment's instance configuration
npm run dev                      # http://localhost:5173, /graphql proxied to the shop
```

Inside the OXID Docker SDK the `oxid-fe-user` service (port 5173) has both repos mounted:
`make file=services/oxid-fe-user.yml addservice && make up`.

## Commands

`make help` lists them: `theme` (rebuild themes), `compile`, `build` / `run` / `stop` (Docker, per instance), `dev`, `debug`, `debug-e2e`, `logs`, `nginx-config`, `gate`.

## Applying a changed `oxid-config.yaml` locally

A configuration change needs a **re-render of the browser's `/oxid-config.json`** — not an image
rebuild. `oxid-config.yaml` itself is never served (see
[docs/instance-configuration.md](docs/instance-configuration.md)).

**SDK instances** (`oxid-fe-user-prod` :8090, `-b` :8091, `-c` :8092): the JSON is rendered when the
container starts, so restart the container.

```bash
cd ~/osc/strpwt7-nov26                                   # the SDK root
docker compose restart oxid-fe-user-prod-b               # or -c: they mount their whole instances/<name> folder
docker compose up -d --force-recreate oxid-fe-user-prod  # instance A mounts the single file oxid-config.yaml
curl -s http://localhost:8090/oxid-config.json           # verify
```

- Instance A mounts one file. Editors that save by replacing the file leave the container with the
  old copy, so use `--force-recreate` for A.
- A secret-looking key or value stops the container right after start (the renderer refuses it):
  `docker compose logs oxid-fe-user-prod-b` names the offending path.
- `make dev` (hot reload on :5173) renders the YAML on every request: reload the browser tab.
- Code or theme changes do need the image: `docker compose build oxid-fe-user-prod`, then recreate.

**A project built on this package** (e.g. `hydroxid-project`, `localhost:8101`–`8103`): render the
instances again and reload the tab; nginx reads them from a mounted folder and serves them `no-store`.

```bash
cd ~/osc/strpwt7-nov26/hydroxid-project
npm run build:instances            # instances/<id>/oxid-config.yaml → build/instances/<id>/oxid-config.json
npm run build:nginx && docker compose restart   # only after changing a port in deploy/instances.json
make local                         # code or theme changes: rebuild everything
```

To get a configuration change onto a server, deploy: the build renders the JSON again from the YAML
in the repository.

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
