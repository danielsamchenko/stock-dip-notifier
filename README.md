# Stock Dip Notifier (MVP)

Phase 1 of a Stock Dip Notifier MVP. This project ingests daily OHLCV price bars into Postgres using Massive (Polygon) and keeps the API read-only over cached data.

## Setup

Create and activate a virtual environment, then install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

## Environment

Required:
- `DATABASE_URL` (e.g. `postgresql+psycopg2://user:pass@localhost:5432/dips`)
- `MASSIVE_API_KEY` (required for ingestion)

Optional:
- `LOG_LEVEL` (default `INFO`)
- `TICKERS` (comma-separated symbols; overrides the default list in `src/dipdetector/tickers.py`)
- `MASSIVE_REST_BASE_URL` (default `https://api.massive.com`)
- `MASSIVE_STOCKS_WS_URL` (default `wss://socket.massive.com/stocks`)
- `LIVE_CHART_TIMESPAN` (default `minute`)
- `LIVE_CHART_MULTIPLIER` (default `1`)
- `LIVE_CHART_LOOKBACK_MINUTES` (default `390`)

Copy the example file and edit:

```bash
cp .env.example .env
```

## Local Postgres (no Docker)

You can use any local Postgres installation. One simple path on macOS:

```bash
brew install postgresql@15
brew services start postgresql@15
createdb dips
```

Then set `DATABASE_URL` to point at that database.

## Migrations

Run Alembic migrations after setting `DATABASE_URL`:

```bash
alembic upgrade head
```

## Ingest prices

```bash
python -m dipdetector.ingest.ingest_prices --days 30
```

Requires `MASSIVE_API_KEY` to be set for market data.
AI overview caching uses AWS Lambda, so set:
`AWS_REGION`, `AI_OVERVIEW_LAMBDA_NAME`, and `AI_OVERVIEW_TTL_MIN`.

## API usage

Run the FastAPI app:

```bash
uvicorn dipdetector.api.main:app --reload
```

Example requests:

```bash
curl "http://127.0.0.1:8000/health"
curl "http://127.0.0.1:8000/dips?rule=drawdown_20d"
curl "http://127.0.0.1:8000/dips/current"
curl "http://127.0.0.1:8000/alerts?days=7&symbol=AAPL"
curl "http://127.0.0.1:8000/tickers/AAPL"
curl "http://127.0.0.1:8000/tickers/AAPL/overview"
curl "http://127.0.0.1:8000/chart/intraday/AAPL"
```

WebSocket for live intraday bars:

```bash
ws://127.0.0.1:8000/ws/chart/intraday/AAPL
```

`/dips/current` returns one row per ticker with the best recent dip window.

## CORS for Expo Web

Expo Web runs in a browser, so the API must allow CORS. By default the API allows
local Expo dev origins. To override, set `CORS_ALLOW_ORIGINS` in your `.env`:

```bash
CORS_ALLOW_ORIGINS=http://localhost:19006,http://localhost:8081
```

## Docker Compose Quickstart

This runs Postgres + the API in containers and gives you one-shot jobs for
migrations, ingestion, and analysis.

```bash
cp .env.example .env
make up
make migrate
make ingest
make analyze
```

API endpoints:

```bash
curl "http://127.0.0.1:8000/health"
curl "http://127.0.0.1:8000/dips"
curl "http://127.0.0.1:8000/alerts"
```

If the database isnt ready yet, retry `make migrate` after a few seconds

## Testing

```bash
pytest
```

## Notes

- Massive (Polygon) is used for ingestion; the API reads from Postgres only.
- The provider interface keeps ingestion swappable without changing analysis or API logic.
