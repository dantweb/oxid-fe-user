# oxid-fe-user — themes, build, run and debug. `make help` lists the commands.
# Docs: docs/theming.md, docs/instance-configuration.md

SHELL        := /bin/bash
SDK_ROOT     := $(abspath ..)
IMAGE        ?= oxid-fe-user:local
INSTANCE     ?= instances/example-a
PORT         ?= 8090
API_UPSTREAM ?= http://host.docker.internal
CONTAINER    ?= oxid-fe-user-$(PORT)
THEME        ?=
SPEC         ?=

.DEFAULT_GOAL := help
.PHONY: help install theme theme-watch compile build run stop dev debug debug-e2e e2e logs nginx-config gate

help: ## List the commands
	@grep -hE '^[a-zA-Z0-9_-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'
	@printf '\n  variables: INSTANCE=$(INSTANCE) PORT=$(PORT) THEME=<id> SPEC=<e2e file> IMAGE=$(IMAGE) API_UPSTREAM=$(API_UPSTREAM)\n'

install: ## Install dependencies (the core is built first: the app links it with file:../oxid-fe-core)
	cd ../oxid-fe-core && npm ci && npm run build
	npm ci

theme: ## Rebuild the themes: LESS -> CSS, images -> public/themes (THEME=<id> for one theme)
	node scripts/build-themes.mjs $(if $(THEME),--theme=$(THEME))

theme-watch: ## Rebuild the themes on every change under resources/themes
	node scripts/build-themes.mjs --watch $(if $(THEME),--theme=$(THEME))

compile: ## Recompile the app: themes + type-check + production bundle in dist/
	npm run type-check
	npm run build

build: ## Build the Docker image from the SDK root (the core is compiled inside the image)
	cd $(SDK_ROOT) && docker build -f oxid-fe-user/Dockerfile -t $(IMAGE) .

run: build ## Build, then run the image with INSTANCE mounted: http://localhost:PORT
	-@docker rm -f $(CONTAINER) >/dev/null 2>&1
	docker run -d --name $(CONTAINER) -p $(PORT):80 \
		--add-host host.docker.internal:host-gateway -e API_UPSTREAM=$(API_UPSTREAM) \
		-v $(abspath $(INSTANCE)):/etc/oxid-fe-instance:ro $(IMAGE)
	@echo "oxid-fe-user [$(INSTANCE)] on http://localhost:$(PORT)"

stop: ## Stop and remove the container started by `make run`
	-docker rm -f $(CONTAINER)

dev: ## Dev server with hot reload on :5173 (themes are built first)
	npm run dev

debug: theme ## Verbose dev server: vite debug logging, all hosts, :5173
	DEBUG='vite:*' npx vite --debug --host --port 5173

debug-e2e: ## Playwright with the inspector, headed, one worker (SPEC=tests/e2e/<file>)
	PWDEBUG=1 npx playwright test $(SPEC) --headed --workers=1

e2e: ## Run the Playwright suite (E2E_BASE_URL=<url> targets a deployed instance)
	npx playwright test $(SPEC)

logs: ## Follow the nginx logs of the container started by `make run`
	docker logs -f $(CONTAINER)

nginx-config: ## Print the nginx configuration rendered inside the running container
	docker exec $(CONTAINER) nginx -T

gate: ## The quality gate: lint, types, dead code, unit tests, build
	npm run lint && npm run type-check && npm run knip && npm run test && npm run build
