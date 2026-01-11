"""Provider interfaces and shared types."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Protocol


@dataclass(frozen=True)
class DailyPriceBar:
    date: date
    open: float
    high: float
    low: float
    close: float
    volume: int | None


class PriceProvider(Protocol):
    def fetch_daily_prices(self, symbol: str, start: date, end: date) -> list[DailyPriceBar]:
        """Return daily bars for start..end (inclusive)."""
        ...
