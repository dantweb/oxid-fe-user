# DONE — Sprint 00a: Docker container for oxid-fe-core/-user in the SDK compose

**Date:** 2026-10-15 · **Status:** delivered (S1–S4; S5 docs land with sprint 00b)

## What was built

- `containers/node-fe/Dockerfile` — `node:22-alpine` + git/bash, idle runner (`sleep infinity`),
  shared by both frontend services. Image builds clean.
- `services/oxid-fe-core.yml` — mounts `./oxid-fe-core:/app`, npm cache in `./data/npm`
  (composer-cache pattern), runs as `${HOST_USER_ID}:${HOST_GROUP_ID}`, port 5175.
- `services/oxid-fe-user.yml` — mounts `./oxid-fe-user:/app` **and** `./oxid-fe-core:/oxid-fe-core`
  so the `file:../oxid-fe-core` npm dependency resolves inside the container; links apache as
  `localhost.local`; port 5173 (Vite dev server).
- Both added to the generated `docker-compose.yml` via the SDK's own
  `make file=services/<name>.yml addservice`; `docker compose config -q` passes.

## Verified

- `docker compose build oxid-fe-core` → exit 0.
- Compose config validates with both services present.

## Deviation from plan

- The `make fe-core` Makefile shell target was **not** added: the SDK `Makefile` is a tracked file in
  the user's checkout; shells work via `docker compose exec oxid-fe-core sh`. If wanted, it is a
  2-line Makefile change to make by hand.
