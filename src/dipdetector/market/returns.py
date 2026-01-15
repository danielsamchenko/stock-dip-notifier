"""Return calculation helpers."""

from __future__ import annotations

from datetime import date
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from dipdetector import config
from dipdetector.db.models import DailyPrice, Ticker

PricePoint = tuple[date, float]


def compute_return_pct(
    closes: Iterable[PricePoint],
    start_date: date,
    end_date: date,
) -> float | None:
    if start_date > end_date:
        return None

    prices = sorted(closes, key=lambda item: item[0])
    if not prices:
        return None

    start_close = None
    start_day = None
    for day, close in prices:
        if day >= start_date:
            start_day = day
            start_close = float(close)
            break

    end_close = None
    end_day = None
    for day, close in reversed(prices):
        if day <= end_date:
            end_day = day
            end_close = float(close)
            break

    if start_close is None or end_close is None or start_day is None or end_day is None:
        return None
    if start_day > end_day:
        return None
    if start_close == 0:
        return None

    return (end_close / start_close - 1.0) * 100.0


def get_closes_for_symbol(
    session: Session,
    symbol: str,
    start_date: date,
    end_date: date,
) -> list[PricePoint]:
    source = config.get_price_source()
    rows = session.execute(
        select(DailyPrice.date, DailyPrice.close)
        .join(Ticker, Ticker.id == DailyPrice.ticker_id)
        .where(
            Ticker.symbol == symbol,
            DailyPrice.source == source,
            DailyPrice.date >= start_date,
            DailyPrice.date <= end_date,
        )
        .order_by(DailyPrice.date.asc())
    ).all()
    return [(row.date, float(row.close)) for row in rows]
