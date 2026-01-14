"""Compute recent drawdown windows for a single ticker."""

from __future__ import annotations

from datetime import date
from typing import Iterable

from dipdetector.analyze import rules

PricePoint = tuple[date, float]


def compute_best_recent_drawdown(
    prices: Iterable[PricePoint],
    asof_date: date,
    windows: list[int],
) -> tuple[float, int] | None:
    if not windows:
        return None

    sorted_prices = sorted(prices, key=lambda item: item[0])
    filtered = [(day, float(close)) for day, close in sorted_prices if day <= asof_date]
    if not filtered:
        return None

    dates = {day for day, _ in filtered}
    if asof_date not in dates:
        return None

    best: tuple[float, int] | None = None

    for window in windows:
        if window <= 0:
            continue

        if window == 1:
            # Treat 1d as previous close -> asof close to capture single-day drops.
            value = rules.compute_1d_drop(filtered, asof_date)
        else:
            if len(filtered) < window:
                continue
            window_prices = filtered[-window:]
            asof_close = window_prices[-1][1]
            max_close = max(close for _, close in window_prices)
            if max_close == 0:
                continue
            value = (asof_close / max_close - 1.0) * 100.0

        if value is None:
            continue
        if best is None or value < best[0]:
            best = (value, window)

    return best
