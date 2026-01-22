"""Configuration helpers for environment variables."""

from __future__ import annotations

import os
from typing import Iterable

from dipdetector.tickers import DEFAULT_TICKERS


def get_database_url() -> str:
    value = os.getenv("DATABASE_URL")
    if not value:
        raise RuntimeError("DATABASE_URL is required but was not set.")
    return value


def get_price_source() -> str:
    return "massive"


def get_massive_api_key() -> str:
    value = os.getenv("MASSIVE_API_KEY", "").strip()
    if not value:
        raise RuntimeError("MASSIVE_API_KEY is required but was not set.")
    return value


def get_massive_rest_base_url() -> str | None:
    value = os.getenv("MASSIVE_REST_BASE_URL", "").strip()
    return value or None


def get_massive_ws_url() -> str:
    value = os.getenv("MASSIVE_STOCKS_WS_URL", "").strip()
    if value:
        return value
    return "wss://socket.massive.com/stocks"


def get_live_chart_timespan() -> str:
    return os.getenv("LIVE_CHART_TIMESPAN", "minute").strip()


def get_live_chart_multiplier() -> int:
    return _get_int("LIVE_CHART_MULTIPLIER", 1)


def get_live_chart_lookback_minutes() -> int:
    return _get_int("LIVE_CHART_LOOKBACK_MINUTES", 390)


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


def _get_float(name: str, default: float) -> float:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError as exc:
        raise ValueError(f"{name} must be a float, got: {raw!r}") from exc


def _get_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer, got: {raw!r}") from exc


def get_dip_1d_threshold() -> float:
    return _get_float("DIP_1D_THRESHOLD", -5.0)


def get_dip_nday_window() -> int:
    return _get_int("DIP_NDAY_WINDOW", 20)


def get_dip_nday_threshold() -> float:
    return _get_float("DIP_NDAY_THRESHOLD", -8.0)


def get_dip_52w_window() -> int:
    return _get_int("DIP_52W_WINDOW", 252)


def get_dip_52w_threshold() -> float:
    return _get_float("DIP_52W_THRESHOLD", -15.0)
