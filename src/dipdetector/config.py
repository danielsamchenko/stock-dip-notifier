"""Configuration helpers for environment variables."""

from __future__ import annotations

import os
from typing import Iterable

DEFAULT_TICKERS = [
    "AAPL",
    "MSFT",
    "AMZN",
    "GOOGL",
    "META",
    "NVDA",
    "TSLA",
    "SPY",
]


def get_database_url() -> str:
    value = os.getenv("DATABASE_URL")
    if not value:
        raise RuntimeError("DATABASE_URL is required but was not set.")
    return value


def get_price_source() -> str:
    return os.getenv("PRICE_SOURCE", "yfinance").strip().lower()


def get_log_level() -> str:
    return os.getenv("LOG_LEVEL", "INFO").strip().upper()


def _normalize_tickers(values: Iterable[str]) -> list[str]:
    cleaned = [value.strip().upper() for value in values]
    return [value for value in cleaned if value]


def get_tickers() -> list[str]:
    raw = os.getenv("TICKERS", "")
    if raw.strip():
        tickers = _normalize_tickers(raw.split(","))
        if tickers:
            return tickers
    return DEFAULT_TICKERS.copy()
