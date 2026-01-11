from __future__ import annotations

from datetime import date

from sqlalchemy import select

from dipdetector.db import models
from dipdetector.db import session as db_session
from dipdetector.ingest import ingest_prices
from dipdetector.providers.base import DailyPriceBar


class DummyProvider:
    def __init__(self, bars: list[DailyPriceBar]):
        self._bars = bars

    def fetch_daily_prices(self, symbol, start, end):
        return self._bars


def test_ingest_upsert_updates_existing_row(tmp_path):
    db_url = f"sqlite+pysqlite:///{tmp_path / 'test.db'}"
    db_session.configure_engine(db_url)
    models.Base.metadata.create_all(db_session.get_engine())

    today = date.today()
    with db_session.get_session() as session:
        ticker = models.Ticker(symbol="AAPL")
        session.add(ticker)
        session.flush()
        session.add(
            models.DailyPrice(
                ticker_id=ticker.id,
                date=today,
                open=1.0,
                high=2.0,
                low=0.5,
                close=1.5,
                volume=100,
                source="yfinance",
            )
        )

    bars = [
        DailyPriceBar(
            date=today,
            open=10.0,
            high=20.0,
            low=5.0,
            close=15.0,
            volume=999,
        )
    ]
    provider = DummyProvider(bars)

    ingest_prices.ingest_prices(
        days=30,
        provider=provider,
        session_factory=db_session.get_session,
        tickers=["AAPL"],
        price_source="yfinance",
    )

    with db_session.get_session() as session:
        rows = session.execute(select(models.DailyPrice)).scalars().all()
        assert len(rows) == 1
        row = rows[0]
        assert float(row.open) == 10.0
        assert float(row.high) == 20.0
        assert float(row.low) == 5.0
        assert float(row.close) == 15.0
        assert row.volume == 999
