# Textile CAD Studio — developer tasks
# Windows users: run these from Git Bash or WSL.

.PHONY: help install dev-db api web test lint build up down logs migrate seed

help:
	@echo "install   install frontend dependencies"
	@echo "dev-db    start PostgreSQL only"
	@echo "api       run the Go API on :8080"
	@echo "web       run the Vite dev server on :5173"
	@echo "test      run backend tests"
	@echo "lint      go vet + TypeScript typecheck"
	@echo "build     build API binary and frontend bundle"
	@echo "up        docker compose up --build"
	@echo "down      docker compose down"
	@echo "migrate   run embedded migrations"
	@echo "seed      seed global rates and yarns"

install:
	cd frontend && npm install

dev-db:
	docker compose up -d db

api:
	cd backend && go run ./cmd/api

web:
	cd frontend && npm run dev

test:
	cd backend && go test ./...

lint:
	cd backend && go vet ./...
	cd frontend && npm run typecheck

build:
	cd backend && go build -o ../bin/api ./cmd/api
	cd frontend && npm run build

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f --tail=100

migrate:
	cd backend && go run ./cmd/migrate

seed:
	cd backend && go run ./cmd/seed
