.PHONY: up down logs dev mongo

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f web

# Local dev: mongo container + vinext dev server (hot reload)
mongo:
	docker compose up -d mongo

dev: mongo
	npm run dev
