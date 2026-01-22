"""CLI-friendly ingestion for daily prices."""

from __future__ import annotations

import argparse
import logging
from collections.abc import Callable
from contextlib import AbstractContextManager
from datetime import date, timedelta
from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from dipdetector import config
from dipdetector.db.models import DailyPrice, Ticker
from dipdetector.db.session import get_session
from dipdetector.providers.base import DailyPriceBar, PriceProvider
from dipdetector.providers.massive_provider import MassiveProvider
from dipdetector.utils.logging import configure_logging

logger = logging.getLogger(__name__)


def ensure_ticker(session: Session, symbol: str) -> Ticker:
    ticker = session.execute(select(Ticker).where(Ticker.symbol == symbol)).scalar_one_or_none()
    if ticker:
        return ticker
    ticker = Ticker(symbol=symbol, active=True)
    session.add(ticker)
    session.flush()
    return ticker


def get_start_date(
    session: Session, ticker_id: int, source: str, end_date: date, days: int
) -> date:
    max_date = session.execute(
        select(func.max(DailyPrice.date)).where(
            DailyPrice.ticker_id == ticker_id, DailyPrice.source == source
        )
    ).scalar_one()
    if max_date:
        start_date = max_date - timedelta(days=5)
    else:
        start_date = end_date - timedelta(days=days)
    return min(start_date, end_date)


def upsert_daily_prices(
    session: Session, ticker_id: int, source: str, bars: Sequence[DailyPriceBar]
) -> tuple[int, int]:
    if not bars:
        return 0, 0

    dates = [bar.date for bar in bars]
    existing = session.execute(
        select(DailyPrice).where(
            DailyPrice.ticker_id == ticker_id,
            DailyPrice.source == source,
            DailyPrice.date.in_(dates),
        )
    ).scalars()
    existing_by_date = {row.date: row for row in existing}

    inserted = 0
    updated = 0
    for bar in bars:
        row = existing_by_date.get(bar.date)
        if row:
            row.open = bar.open
            row.high = bar.high
            row.low = bar.low
            row.close = bar.close
            row.volume = bar.volume
            updated += 1
        else:
            session.add(
                DailyPrice(
                    ticker_id=ticker_id,
                    date=bar.date,
                    open=bar.open,
                    high=bar.high,
                    low=bar.low,
                    close=bar.close,
                    volume=bar.volume,
                    source=source,
                )
            )
            inserted += 1
    return inserted, updated


def ingest_prices(
    days: int,
    provider: PriceProvider | None = None,
    session_factory: Callable[[], AbstractContextManager[Session]] = get_session,
    tickers: Sequence[str] | None = None,
) -> None:
    if days <= 0:
        raise ValueError("days must be a positive integer")

    source = config.get_price_source()
    provider = provider or MassiveProvider(
        config.get_massive_api_key(), config.get_massive_rest_base_url()
    )
    tickers_list = list(tickers) if tickers is not None else config.get_tickers()
    end_date = date.today()

    for symbol in tickers_list:
        with session_factory() as session:
            ticker = ensure_ticker(session, symbol)
            start_date = get_start_date(session, ticker.id, source, end_date, days)
            bars = provider.fetch_daily_prices(symbol, start_date, end_date)
            inserted, updated = upsert_daily_prices(session, ticker.id, source, bars)
            logger.info(
                "Ticker %s: fetched %d rows, inserted %d, updated %d",
                symbol,
                len(bars),
                inserted,
                updated,
            )


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest daily price bars.")
    parser.add_argument("--days", type=int, default=30, help="Number of days to backfill")
    args = parser.parse_args()

    configure_logging(config.get_log_level())
    ingest_prices(days=args.days)


if __name__ == "__main__":
    main()
