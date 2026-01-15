from __future__ import annotations

from datetime import date

import pytest
from fastapi.testclient import TestClient

from dipdetector.api.deps import get_db_session
from dipdetector.api.main import app
from dipdetector.db import models
from dipdetector.db import session as db_session


def _seed_series(
    session,
    ticker: models.Ticker,
    dates: list[date],
    closes: list[float],
) -> None:
    for day, close in zip(dates, closes, strict=True):
        session.add(
            models.DailyPrice(
                ticker_id=ticker.id,
                date=day,
                open=close,
                high=close,
                low=close,
                close=close,
                volume=100,
                source="yfinance",
            )
        )


def test_dips_current_enrichment(tmp_path):
    db_url = f"sqlite+pysqlite:///{tmp_path / 'test.db'}"
    db_session.configure_engine(db_url)
    models.Base.metadata.create_all(db_session.get_engine())

    dates = [
        date(2024, 1, 2),
        date(2024, 1, 3),
        date(2024, 1, 4),
        date(2024, 1, 5),
        date(2024, 1, 8),
        date(2024, 1, 9),
        date(2024, 1, 10),
        date(2024, 1, 11),
    ]

    with db_session.get_session() as session:
        amzn = models.Ticker(symbol="AMZN")
        meta = models.Ticker(symbol="META")
        spy = models.Ticker(symbol="SPY")
        xly = models.Ticker(symbol="XLY")
        session.add_all([amzn, meta, spy, xly])
        session.flush()

        _seed_series(session, amzn, dates, [100, 98, 96, 94, 92, 90, 88, 86])
        _seed_series(session, meta, dates, [200, 200, 200, 200, 200, 200, 200, 190])
        _seed_series(session, spy, dates[:-1], [100, 100, 100, 100, 99, 99, 98])
        _seed_series(session, xly, dates, [105, 105, 104, 104, 103, 102, 101, 100])

    def override_get_db():
        with db_session.get_session() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_get_db
    try:
        client = TestClient(app)
        response = client.get("/dips/current", params={"min_dip": -5})
        assert response.status_code == 200
        payload = response.json()
        assert payload["asof"] == "2024-01-11"

        items = payload["items"]
        symbols = [item["symbol"] for item in items]
        assert symbols == ["AMZN", "META"]

        amzn_item = items[0]
        assert amzn_item["window_days"] == 7
        assert amzn_item["market_symbol"] == "SPY"
        assert amzn_item["sector_symbol"] == "XLY"
        assert amzn_item["ticker_return_pct"] == pytest.approx(-12.24, abs=0.05)
        assert amzn_item["spy_return_pct"] == pytest.approx(-2.0, abs=0.01)
        assert amzn_item["sector_return_pct"] == pytest.approx(-4.76, abs=0.05)
        assert amzn_item["relative_to_spy_pp"] == pytest.approx(-10.24, abs=0.05)
        assert amzn_item["relative_to_sector_pp"] == pytest.approx(-7.48, abs=0.05)

        meta_item = items[1]
        assert meta_item["window_days"] == 1
        assert meta_item["ticker_return_pct"] == pytest.approx(-5.0, abs=0.01)
        assert meta_item["spy_return_pct"] == pytest.approx(0.0, abs=0.01)
        assert meta_item["sector_symbol"] is None
        assert meta_item["sector_return_pct"] is None
        assert meta_item["relative_to_sector_pp"] is None
    finally:
        app.dependency_overrides.clear()
