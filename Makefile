# Makefile — operator entry points for Phase 1 (Supabase) and Phase 2
# (firebase-service dispatcher).
#
# These targets only orchestrate scripts; cloud credentials must be
# provided by the operator (env vars, gcloud login, supabase login).
# Nothing in this file embeds secrets or invents auth flows.

SHELL          := /bin/bash
REPO_ROOT      := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
SCRIPTS        := $(REPO_ROOT)/scripts
DISPATCHER_DIR := $(REPO_ROOT)/backends/firebase-service

.DEFAULT_GOAL := help

.PHONY: help deploy-supabase setup-cron deploy-dispatcher healthcheck verify-dispatcher supabase-env-hints docker-local-api-build docker-local-api-up verify-local-api verify-apk-builder

help:
	@echo "Apkzio operator targets:"
	@echo ""
	@echo "  make deploy-supabase     # link + db push + edge deploy + secrets"
	@echo "                           # env: SUPABASE_PROJECT_REF (required), see"
	@echo "                           #      scripts/deploy-supabase.sh header for opts"
	@echo ""
	@echo "  make setup-cron          # idempotent cron.schedule via psql -f"
	@echo "                           # env: DATABASE_URL"
	@echo ""
	@echo "  make deploy-dispatcher   # docker build (+optional push) + gcloud run deploy"
	@echo "                           # env: GCP_PROJECT, GCP_REGION, DATABASE_URL_SECRET,"
	@echo "                           #      FCM_SECRET (required); IMAGE_TAG, PUSH (opt)"
	@echo ""
	@echo "  make healthcheck         # curl \$$DISPATCHER_URL/healthz, assert ok:true"
	@echo ""
	@echo "  make verify-dispatcher   # offline: lint+build+test in firebase-service"
	@echo ""
	@echo "  make verify-local-api    # offline: lint+build+test in local-api (builder)"
	@echo "  make verify-apk-builder # offline: template gradlew + local-api tests"
	@echo ""
	@echo "  make docker-local-api-build  # docker compose build (APK-capable API image)"
	@echo "  make docker-local-api-up     # docker compose up -d (see docker-compose.local-api.yml)"
	@echo ""
	@echo "  make supabase-env-hints # print SUPABASE_URL / DATABASE_URL / VITE_* patterns"
	@echo "                           # env: SUPABASE_PROJECT_REF (required)"

deploy-supabase:
	@bash "$(SCRIPTS)/deploy-supabase.sh"

setup-cron:
	@if [[ -z "$${DATABASE_URL:-}" ]]; then \
	  echo "error: DATABASE_URL is required (direct port-5432 Postgres URI)" >&2; \
	  exit 1; \
	fi
	@command -v psql >/dev/null 2>&1 || { \
	  echo "error: psql not found in PATH" >&2; exit 1; }
	@psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$(SCRIPTS)/setup-cron.sql"

deploy-dispatcher:
	@bash "$(SCRIPTS)/deploy-dispatcher.sh"

healthcheck:
	@bash "$(SCRIPTS)/healthcheck.sh"

verify-dispatcher:
	@cd "$(DISPATCHER_DIR)" && \
	  if [[ -d node_modules ]]; then npm run lint && npm run build && npm test; \
	  else npm ci && npm run lint && npm run build && npm test; fi

LOCAL_API_DIR := $(REPO_ROOT)/backends/local-api

verify-local-api:
	@cd "$(LOCAL_API_DIR)" && \
	  if [[ -d node_modules ]]; then npm run lint && npm run build && npm test; \
	  else npm ci && npm run lint && npm run build && npm test; fi

verify-apk-builder:
	@bash "$(SCRIPTS)/verify-apk-builder.sh"

docker-local-api-build:
	@docker compose -f "$(REPO_ROOT)/docker-compose.local-api.yml" build

docker-local-api-up:
	@docker compose -f "$(REPO_ROOT)/docker-compose.local-api.yml" up -d

supabase-env-hints:
	@if [[ -z "$${SUPABASE_PROJECT_REF:-}" ]]; then \
	  echo "error: SUPABASE_PROJECT_REF is required (Dashboard → General → Reference ID)" >&2; \
	  exit 1; \
	fi
	@bash "$(SCRIPTS)/supabase-env-hints.sh" "$$SUPABASE_PROJECT_REF"
