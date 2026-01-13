.PHONY: up down logs migrate ingest analyze reset

up:
	docker compose up -d db api

down:
	docker compose down

logs:
	docker compose logs -f api

migrate:
	docker compose run --rm migrate

ingest:
	docker compose run --rm ingest

analyze:
	docker compose run --rm analyze

reset:
	docker compose down -v
