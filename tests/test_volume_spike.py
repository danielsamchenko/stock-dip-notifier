from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from dipdetector.api.deps import get_db_session
from dipdetector.api.main import app
from dipdetector.db import models
from dipdetector.db import session as db_session
from dipdetector.market.volume import compute_volume_spike


def _seed_volumes(
    session,
    ticker: models.Ticker,
    start_date: date,
    volumes: list[int],
) -> None:
    for offset, volume in enumerate(volumes):
        day = start_date + timedelta(days=offset)
        session.add(
            models.DailyPrice(
                ticker_id=ticker.id,
                date=day,
                open=1.0,
                high=1.0,
                low=1.0,
                close=1.0,
                volume=volume,
                source="yfinance",
            )
        )


def test_compute_volume_spike():
    start = date(2024, 1, 1)
    series = [(start + timedelta(days=i), i + 1) for i in range(25)]

    result = compute_volume_spike(series, start + timedelta(days=24), avg_window=20)
    assert result is not None
    assert result["asof_date"] == start + timedelta(days=24)
    assert result["volume"] == 25
    assert result["avg_volume_20d"] == pytest.approx(14.5, abs=0.01)
    assert result["spike_ratio"] == pytest.approx(25 / 14.5, abs=0.01)


def test_compute_volume_spike_insufficient_history():
    start = date(2024, 1, 1)
    series = [(start + timedelta(days=i), 100 + i) for i in range(10)]
    result = compute_volume_spike(series, start + timedelta(days=9), avg_window=20)
    assert result is None


def test_volume_spike_endpoint(tmp_path):
    db_url = f"sqlite+pysqlite:///{tmp_path / 'test.db'}"
    db_session.configure_engine(db_url)
    models.Base.metadata.create_all(db_session.get_engine())

    start = date(2024, 1, 1)
    volumes = [i + 1 for i in range(25)]
    asof_date = start + timedelta(days=24)

    with db_session.get_session() as session:
        ticker = models.Ticker(symbol="AAPL")
        session.add(ticker)
        session.flush()
        _seed_volumes(session, ticker, start, volumes)

    def override_get_db():
        with db_session.get_session() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_get_db
    try:
        client = TestClient(app)
        response = client.get("/tickers/AAPL", params={"asof": asof_date.isoformat()})
        assert response.status_code == 200
        payload = response.json()
        spike = payload["volume_spike"]
        assert spike is not None
        assert spike["asof_date"] == asof_date.isoformat()
        assert spike["volume"] == 25
        assert spike["avg_volume_20d"] == pytest.approx(14.5, abs=0.01)
        assert spike["spike_ratio"] == pytest.approx(25 / 14.5, abs=0.01)
    finally:
        app.dependency_overrides.clear()
