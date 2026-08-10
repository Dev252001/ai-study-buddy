.PHONY: help install dev up down build migrate seed test-backend test-frontend lint logs reset-db

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies
	@echo "Installing frontend dependencies..."
	cd frontend && npm install
	@echo "Installing backend dependencies..."
	cd backend && pip install -r requirements.txt

dev: ## Start development environment with hot-reload
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

up: ## Start production environment
	docker-compose up -d

down: ## Stop all services
	docker-compose down

build: ## Build Docker images
	docker-compose build

migrate: ## Run database migrations
	docker-compose exec backend alembic upgrade head

seed: ## Seed database with sample data
	docker-compose exec backend python scripts/seed_data.py

test-backend: ## Run backend tests
	docker-compose exec backend pytest tests/ -v --cov=app --cov-report=term-missing

test-frontend: ## Run frontend tests
	cd frontend && npm run typecheck

lint: ## Run linters
	cd backend && ruff check app/ && mypy app/ --ignore-missing-imports
	cd frontend && npm run lint

logs: ## Tail all service logs
	docker-compose logs -f

logs-backend: ## Tail backend logs only
	docker-compose logs -f backend

logs-frontend: ## Tail frontend logs only
	docker-compose logs -f frontend

reset-db: ## Reset database (destructive!)
	bash scripts/reset_db.sh

shell-backend: ## Open shell in backend container
	docker-compose exec backend bash

shell-db: ## Open psql shell
	docker-compose exec postgres psql -U studybuddy -d studybuddy

ps: ## Show running containers
	docker-compose ps

pull: ## Pull latest images
	docker-compose pull
