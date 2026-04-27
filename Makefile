SHELL := /usr/bin/env bash

COMPOSE_FILE := gaode-map/docker-compose.yml
ENV_FILE := gaode-map/.env
ARCGIS_BRIDGE_PORT ?= 18081
PYTHON ?= python

.PHONY: help up down ps logs bridge search-local app-local verify-h3 check-imports verify-startup

help:
	@echo "Available targets:"
	@echo "  make up             - Start docker stack (gaode-map + search + valhalla + overpass)"
	@echo "  make down           - Stop docker stack"
	@echo "  make ps             - Show docker stack status"
	@echo "  make logs           - Tail docker stack logs"
	@echo "  make bridge         - Start host_bridge on host"
	@echo "  make search-local   - Run search locally with Maven wrapper"
	@echo "  make app-local      - Run gaode-map locally"
	@echo "  make verify-h3      - Run h3-grid API acceptance script"
	@echo "  make check-imports  - Validate gaode-map imports"
	@echo "  make verify-startup - Validate gaode-map startup lifecycle"

up:
	docker compose --env-file $(ENV_FILE) -f $(COMPOSE_FILE) up -d --build

down:
	docker compose --env-file $(ENV_FILE) -f $(COMPOSE_FILE) down

ps:
	docker compose --env-file $(ENV_FILE) -f $(COMPOSE_FILE) ps

logs:
	docker compose --env-file $(ENV_FILE) -f $(COMPOSE_FILE) logs -f --tail=100

bridge:
	$(PYTHON) -m uvicorn host_bridge.main:app --host 0.0.0.0 --port $(ARCGIS_BRIDGE_PORT)

search-local:
	cd search && ./mvnw spring-boot:run

app-local:
	cd gaode-map && uvicorn main:app --host 0.0.0.0 --port 8000 --reload

verify-h3:
	$(PYTHON) scripts/verify_h3_grid_api.py --base-url http://127.0.0.1:8000

check-imports:
	cd gaode-map && $(PYTHON) ../scripts/check_imports.py

verify-startup:
	cd gaode-map && $(PYTHON) ../scripts/verify_startup.py
