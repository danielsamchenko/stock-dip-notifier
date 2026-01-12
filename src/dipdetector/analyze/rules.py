"""Analysis rules for dip detection."""

from __future__ import annotations

from datetime import date
from typing import Iterable, Sequence

PricePoint = tuple[date, float]


def _sorted_prices(prices_by_date: Iterable[PricePoint]) -> list[PricePoint]:
    return sorted(prices_by_date, key=lambda item: item[0])


def _asof_and_prev(prices: Sequence[PricePoint], asof_date: date) -> tuple[float, float, date] | None:
    asof_close: float | None = None
    prev_close: float | None = None
    prev_date: date | None = None

    for idx, (day, close) in enumerate(prices):
        if day == asof_date:
            asof_close = close
            if idx > 0:
                prev_date, prev_close = prices[idx - 1]
            break

    if asof_close is None or prev_close is None or prev_date is None:
        return None

    return asof_close, prev_close, prev_date


def compute_1d_drop(prices_by_date: Iterable[PricePoint], asof_date: date) -> float | None:
    """Return percent change from previous close to asof close."""
    prices = _sorted_prices(prices_by_date)
    result = _asof_and_prev(prices, asof_date)
    if not result:
        return None

    asof_close, prev_close, _prev_date = result
    if prev_close == 0:
        return None

    return (asof_close - prev_close) / prev_close * 100.0


def compute_drawdown(
    prices_by_date: Iterable[PricePoint],
    asof_date: date,
    window: int,
) -> tuple[float, dict[str, object]] | None:
    """Return drawdown percent vs rolling max within window ending at asof_date."""
    if window <= 0:
        return None

    prices = _sorted_prices(prices_by_date)
    filtered = [(day, close) for day, close in prices if day <= asof_date]
    if not filtered:
        return None

    dates = [day for day, _ in filtered]
    if asof_date not in dates:
        return None

    window_prices = filtered[-window:]
    if len(window_prices) < window:
        return None

    asof_close = dict(filtered)[asof_date]

    rolling_max_close = None
    rolling_max_date = None
    for day, close in window_prices:
        if rolling_max_close is None:
            rolling_max_close = close
            rolling_max_date = day
            continue
        if close > rolling_max_close or (close == rolling_max_close and day > rolling_max_date):
            rolling_max_close = close
            rolling_max_date = day

    if rolling_max_close is None or rolling_max_date is None:
        return None
    if rolling_max_close == 0:
        return None

    value_percent = (asof_close - rolling_max_close) / rolling_max_close * 100.0
    details = {
        "window": window,
        "rolling_max_date": rolling_max_date.isoformat(),
        "rolling_max_close": float(rolling_max_close),
        "asof_close": float(asof_close),
    }
    return value_percent, details


def get_prev_close_details(
    prices_by_date: Iterable[PricePoint],
    asof_date: date,
) -> dict[str, object] | None:
    prices = _sorted_prices(prices_by_date)
    result = _asof_and_prev(prices, asof_date)
    if not result:
        return None

    asof_close, prev_close, prev_date = result
    return {
        "prev_date": prev_date.isoformat(),
        "prev_close": float(prev_close),
        "asof_close": float(asof_close),
    }
