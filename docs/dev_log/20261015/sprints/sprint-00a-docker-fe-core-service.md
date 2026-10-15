# Sprint 00a — Docker container for oxid-fe-core, wired into the SDK's docker-compose

**Date:** 2026-10-15 · **Repo:** Docker SDK root (+ `oxid-fe-core` checkout at SDK root) · **Status:** planned

## Ask

A dedicated container in which `oxid-fe-core` is developed, built and tested, added to the SDK's
`docker-compose.yaml` the same way every other service is (a file under `services/`, installed with
`make file=services/oxid-fe-core.yml addservice`). Nobody needs Node on the host.

## Stories

| # | Story | Done when |
|---|---|---|
| S1 | **Dockerfile** `containers/node-fe/Dockerfile`: `node:22-alpine`, non-root `node` user, workdir `/app`, git (for submodules/codegen) | image builds |
| S2 | **Service definition** `services/oxid-fe-core.yml`: builds S1, mounts `./oxid-fe-core:/app` and `./data/npm:/home/node/.npm` (npm cache survives rebuilds, same pattern as `data/composer`), exposes `5173` for the Vite dev/preview server, default command keeps the container idle (`sleep infinity`) so it serves as a shell + CI-like runner | `make file=services/oxid-fe-core.yml addservice && make up` starts it |
| S3 | **Makefile targets**: `make fe-core` (shell into the container, like `make php` / `make node`) | target works |
| S4 | **Smoke inside the container**: `npm ci && npm run build && npm test && npm run lint` all green (against the sprint-01 scaffold; until then, against an empty Vite lib scaffold) | commands documented and green |
| S5 | **Docs**: section in the SDK `README` + `oxid-fe-core/README` quickstart (clone location at SDK root, addservice, make target) | reviewed |

## Constraints

- Follow the existing SDK conventions exactly: service file in `services/`, Dockerfile under `containers/`,
  persistent caches under `data/`, env knobs (`NODE_VERSION`) in `.env.dist`.
- The container must be usable by CI the same way developers use it (DevOps-first): the CI job of
  `dantweb/oxid-fe-core` (sprint 00c) runs the same `npm ci/build/test/lint` commands.
- No changes to existing services.

## Acceptance

- Fresh clone → `make setup && make addbasicservices && make file=services/oxid-fe-core.yml addservice && make up`
  brings the service up.
- `docker compose exec oxid-fe-core npm run build` and `npm test` are green.
- Editing a file on the host is visible in the container (bind mount verified).
