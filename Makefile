SHELL := /bin/bash

.DEFAULT_GOAL := help

.PHONY: help setup env install dev test build db-up db-tools db-down db-logs db-migrate initdb deploy restart

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*## "; printf "Usage: make <target>\n\nTargets:\n"} /^[a-zA-Z_-]+:.*## / {printf "  %-14s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: ## Prepare a fresh clone for local development
	./scripts/setup.sh

env: ## Create missing local environment files without overwriting existing ones
	@test -f server/.env || cp server/.env.example server/.env
	@test -f client/.env.local || cp client/.env.example client/.env.local

install: ## Install client and server dependencies from lockfiles
	cd client && pnpm install --frozen-lockfile
	cd server && pnpm install --frozen-lockfile

dev: ## Run the client and server together; Ctrl+C stops both
	./scripts/dev.sh

test: ## Run the server test suite
	cd server && pnpm test --runInBand

build: ## Build the server and client
	cd server && pnpm run build
	cd client && pnpm run build

db-up: env ## Start PostgreSQL and wait until it is healthy
	cd server && docker compose up -d --wait postgres

db-tools: env ## Start PostgreSQL and pgAdmin
	cd server && docker compose up -d --wait postgres pgadmin

db-down: ## Stop local database containers (keeps data volumes)
	cd server && docker compose down

db-logs: ## Follow PostgreSQL logs
	cd server && docker compose logs -f postgres

db-migrate: env ## Generate Prisma Client and apply committed migrations
	cd server && pnpm prisma generate
	cd server && pnpm prisma migrate deploy

initdb: db-migrate ## Backward-compatible alias for db-migrate

# Legacy PM2 deployment helpers. For the supported Azure topology and required
# production settings, read docs/MATCH_TRACKING.md before using these targets.
deploy: ## Build and run both applications with PM2 on a single host
	cd client && pnpm run build
	pm2 delete gennia-client 2> /dev/null || true
	cd client && pm2 start pnpm --time --name "gennia-client" -- start --port 3000
	cd server && docker compose up -d --wait postgres
	cd server && pnpm prisma migrate deploy
	cd server && pnpm run build
	pm2 delete gennia-server 2> /dev/null || true
	cd server && pm2 start node --time --name "gennia-server" -- ./dist/src/server.js

restart: ## Rebuild and restart existing PM2 processes
	cd client && pnpm run build
	cd server && pnpm run build
	pm2 restart gennia-client
	pm2 restart gennia-server
