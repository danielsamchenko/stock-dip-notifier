"""FastAPI application entry point."""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from dipdetector.api.routes import alerts, chart, dips, health, refresh, tickers


def _get_cors_origins() -> list[str]:
    raw = os.getenv("CORS_ALLOW_ORIGINS", "").strip()
    if raw:
        return [value.strip() for value in raw.split(",") if value.strip()]
    return [
        "http://localhost:19006",
        "http://localhost:8081",
        "http://127.0.0.1:19006",
        "http://127.0.0.1:8081",
    ]


app = FastAPI(title="Stock Dip Notifier API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_cors_origins(),
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    allow_credentials=False,
)

app.include_router(health.router)
app.include_router(alerts.router)
app.include_router(dips.router)
app.include_router(chart.router)
app.include_router(tickers.router)
app.include_router(refresh.router)
