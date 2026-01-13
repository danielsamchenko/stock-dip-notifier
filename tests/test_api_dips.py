from __future__ import annotations

from datetime import date

from fastapi.testclient import TestClient

from dipdetector.api.deps import get_db_session
from dipdetector.api.main import app
from dipdetector.db import models
from dipdetector.db import session as db_session


def test_api_dips_ordering(tmp_path):
    db_url = f"sqlite+pysqlite:///{tmp_path / 'test.db'}"
    db_session.configure_engine(db_url)
    models.Base.metadata.create_all(db_session.get_engine())

    with db_session.get_session() as session:
        ticker_a = models.Ticker(symbol="AAPL")
        ticker_b = models.Ticker(symbol="MSFT")
        session.add_all([ticker_a, ticker_b])
        session.flush()
        session.add_all(
            [
                models.Signal(
                    ticker_id=ticker_a.id,
                    date=date(2024, 1, 10),
                    rule="drawdown_20d",
                    value=-2.0,
                ),
                models.Signal(
                    ticker_id=ticker_b.id,
                    date=date(2024, 1, 10),
                    rule="drawdown_20d",
                    value=-10.0,
                ),
            ]
        )

    def override_get_db():
        with db_session.get_session() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_get_db
    try:
        client = TestClient(app)
        response = client.get("/dips", params={"rule": "drawdown_20d", "date": "2024-01-10"})
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["symbol"] == "MSFT"
        assert data[1]["symbol"] == "AAPL"
    finally:
        app.dependency_overrides.clear()
