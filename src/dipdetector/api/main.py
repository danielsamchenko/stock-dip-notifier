"""FastAPI application entry point."""

from __future__ import annotations

from fastapi import FastAPI

from dipdetector.api.routes import alerts, dips, health, tickers

app = FastAPI(title="Stock Dip Notifier API", version="0.1.0")

app.include_router(health.router)
app.include_router(alerts.router)
app.include_router(dips.router)
app.include_router(tickers.router)
