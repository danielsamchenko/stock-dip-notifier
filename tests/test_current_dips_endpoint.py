from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from dipdetector.api.deps import get_db_session
from dipdetector.api.main import app
from dipdetector.db import models
from dipdetector.db import session as db_session


def _seed_prices(
    session,
    ticker: models.Ticker,
    start_date: date,
    closes: list[float],
) -> None:
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


def test_current_dips_endpoint(tmp_path):
    db_url = f"sqlite+pysqlite:///{tmp_path / 'test.db'}"
    db_session.configure_engine(db_url)
    models.Base.metadata.create_all(db_session.get_engine())

    start_date = date(2024, 1, 1)
    asof_date = start_date + timedelta(days=13)

    with db_session.get_session() as session:
        ticker_a = models.Ticker(symbol="A")
        ticker_b = models.Ticker(symbol="B")
        ticker_c = models.Ticker(symbol="C")
        session.add_all([ticker_a, ticker_b, ticker_c])
        session.flush()

        _seed_prices(
            session,
            ticker_a,
            start_date,
            [
                98,
                97,
                99,
                96,
                95,
                97,
                98,
                99,
                97,
                100,
                90,
                85,
                87,
                90,
            ],
        )
        _seed_prices(
            session,
            ticker_b,
            start_date,
            [
                110,
                112,
                111,
                113,
                115,
                114,
                116,
                117,
                118,
                119,
                118,
                117,
                120,
                100,
            ],
        )
        _seed_prices(
            session,
            ticker_c,
            start_date,
            [
                100,
                99,
                100,
                98,
                99,
                100,
                99,
                98,
                99,
                100,
                99,
                100,
                98,
                99,
            ],
        )

    def override_get_db():
        with db_session.get_session() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_get_db
    try:
        client = TestClient(app)
        response = client.get("/dips/current", params={"min_dip": -5})
        assert response.status_code == 200
        payload = response.json()
        assert payload["asof"] == asof_date.isoformat()

        items = payload["items"]
        symbols = [item["symbol"] for item in items]
        assert symbols == ["B", "A"]

        item_b = items[0]
        item_a = items[1]
        assert item_b["window_days"] == 1
        assert item_a["window_days"] == 5
        assert item_b["dip"] == pytest.approx(-16.6667, abs=0.01)
        assert item_a["dip"] == pytest.approx(-10.0, abs=0.01)
    finally:
        app.dependency_overrides.clear()
