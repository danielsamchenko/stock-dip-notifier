"""API response schemas."""

from __future__ import annotations

import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str


class AlertOut(BaseModel):
    symbol: str
    date: date
    rule: str
    magnitude: float
    threshold: float
    details: dict[str, Any] | None
    created_at: datetime


class SignalOut(BaseModel):
    symbol: str
    date: date
    rule: str
    value: float
    created_at: datetime


class CurrentDipItem(BaseModel):
    symbol: str
    date: date
    dip: float
    window_days: int
    market_symbol: str
    sector_symbol: str | None
    ticker_return_pct: float | None
    spy_return_pct: float | None
    sector_return_pct: float | None
    relative_to_spy_pp: float | None
    relative_to_sector_pp: float | None


class CurrentDipsResponse(BaseModel):
    asof: date | None
    windows: list[int]
    items: list[CurrentDipItem]


class AnalystRecommendationOut(BaseModel):
    symbol: str
    summary: str
    strong_buy: int
    buy: int
    hold: int
    sell: int
    strong_sell: int
    source: str


class PriceOut(BaseModel):
    symbol: str
    date: date
    open: float
    high: float
    low: float
    close: float
    volume: int | None
    source: str


class TickerSummaryOut(BaseModel):
    symbol: str
    name: str | None
    active: bool
    latest_price_date: date | None


class TickerDetailOut(BaseModel):
    symbol: str
    name: str | None
    active: bool
    latest_price: PriceOut | None
    recent_signals: list[SignalOut]
    recent_alerts: list[AlertOut]


def to_float(value: Any) -> float:
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def parse_details(value: Any) -> dict[str, Any] | None:
    if value is None:
        return None
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            return {"raw": value}
    return {"raw": value}
