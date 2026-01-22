from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import func, select

from dipdetector.analyze import run as analyze_run
from dipdetector.db import models
from dipdetector.db import session as db_session


def test_alert_idempotency(tmp_path, monkeypatch):
    monkeypatch.setenv("DIP_1D_THRESHOLD", "-5.0")
    monkeypatch.setenv("DIP_NDAY_WINDOW", "5")
    monkeypatch.setenv("DIP_NDAY_THRESHOLD", "-10.0")
    monkeypatch.setenv("DIP_52W_WINDOW", "10")
    monkeypatch.setenv("DIP_52W_THRESHOLD", "-10.0")

    db_url = f"sqlite+pysqlite:///{tmp_path / 'test.db'}"
    db_session.configure_engine(db_url)
    models.Base.metadata.create_all(db_session.get_engine())

    start_date = date(2024, 1, 1)
    closes = [100.0, 102.0, 101.0, 99.0, 98.0, 97.0, 96.0, 95.0, 90.0, 80.0]
    asof_date = start_date + timedelta(days=len(closes) - 1)

    with db_session.get_session() as session:
        ticker = models.Ticker(symbol="AAPL")
        session.add(ticker)
        session.flush()
        for offset, close in enumerate(closes):
            day = start_date + timedelta(days=offset)
            session.add(
                models.DailyPrice(
                    ticker_id=ticker.id,
                    date=day,
                    open=close,
                    high=close,
                    low=close,
                    close=close,
                    volume=100,
                    source="massive",
                )
            )

    analyze_run.analyze(asof_date, session_factory=db_session.get_session)
    analyze_run.analyze(asof_date, session_factory=db_session.get_session)

    with db_session.get_session() as session:
        signals_count = session.execute(select(func.count(models.Signal.id))).scalar_one()
        alerts_count = session.execute(select(func.count(models.Alert.id))).scalar_one()

    assert signals_count == 3
    assert alerts_count == 3
