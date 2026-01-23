from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi.testclient import TestClient

from dipdetector.api.deps import get_db_session
from dipdetector.api.main import app
from dipdetector.ai import overview_service
from dipdetector.db import models
from dipdetector.db import session as db_session


def test_overview_endpoint_uses_cache(tmp_path, monkeypatch):
    monkeypatch.setenv("AI_OVERVIEW_TTL_MIN", "360")

    db_url = f"sqlite+pysqlite:///{tmp_path / 'test.db'}"
    db_session.configure_engine(db_url)
    models.Base.metadata.create_all(db_session.get_engine())

    asof_date = date(2026, 1, 16)

    with db_session.get_session() as session:
        ticker = models.Ticker(symbol="AAPL", name="Apple Inc.")
        session.add(ticker)
        session.add(
            models.AIOverview(
                symbol="AAPL",
                asof=asof_date,
                overview_json={
                    "symbol": "AAPL",
                    "asof": asof_date.isoformat(),
                    "overview": "Cached overview",
                    "drivers": {"market": 0.2, "industry": 0.3, "company": 0.5},
                    "key_factors": ["Factor 1"],
                    "sources": [],
                },
                model_id="test-model",
                created_at=datetime.now(timezone.utc),
            )
        )

    def override_get_db():
        with db_session.get_session() as session:
            yield session

    def should_not_call(_: dict) -> dict:
        raise AssertionError("Lambda was called unexpectedly")

    app.dependency_overrides[get_db_session] = override_get_db
    monkeypatch.setattr(overview_service, "invoke_overview", should_not_call)

    try:
        client = TestClient(app)
        response = client.get("/tickers/AAPL/overview?asof=2026-01-16")
        assert response.status_code == 200
        payload = response.json()
        assert payload["overview"] == "Cached overview"
        assert payload["key_factors"] == ["Factor 1"]
    finally:
        app.dependency_overrides.clear()


def test_overview_endpoint_populates_cache(tmp_path, monkeypatch):
    monkeypatch.setenv("AI_OVERVIEW_TTL_MIN", "360")

    db_url = f"sqlite+pysqlite:///{tmp_path / 'test.db'}"
    db_session.configure_engine(db_url)
    models.Base.metadata.create_all(db_session.get_engine())

    with db_session.get_session() as session:
        session.add(models.Ticker(symbol="INTU", name="Intuit Inc."))

    def override_get_db():
        with db_session.get_session() as session:
            yield session

    calls = {"count": 0}

    def fake_invoke(_: dict) -> dict:
        calls["count"] += 1
        return {
            "symbol": "INTU",
            "asof": "2026-01-16",
            "overview": "AI overview text",
            "drivers": {"market": 0.3, "industry": 0.4, "company": 0.3},
            "key_factors": ["Factor A", "Factor B"],
            "sources": [{"title": "Source"}],
        }

    app.dependency_overrides[get_db_session] = override_get_db
    monkeypatch.setattr(overview_service, "invoke_overview", fake_invoke)

    try:
        client = TestClient(app)
        response = client.get("/tickers/INTU/overview?asof=2026-01-16")
        assert response.status_code == 200
        payload = response.json()
        assert payload["overview"] == "AI overview text"
        assert calls["count"] == 1

        with db_session.get_session() as session:
            cached = session.query(models.AIOverview).filter_by(symbol="INTU").first()
            assert cached is not None
            assert cached.overview_json["overview"] == "AI overview text"
    finally:
        app.dependency_overrides.clear()


def test_overview_endpoint_handles_lambda_failure(tmp_path, monkeypatch):
    monkeypatch.setenv("AI_OVERVIEW_TTL_MIN", "360")

    db_url = f"sqlite+pysqlite:///{tmp_path / 'test.db'}"
    db_session.configure_engine(db_url)
    models.Base.metadata.create_all(db_session.get_engine())

    with db_session.get_session() as session:
        session.add(models.Ticker(symbol="MSFT", name="Microsoft"))

    def override_get_db():
        with db_session.get_session() as session:
            yield session

    def raise_error(_: dict) -> dict:
        raise RuntimeError("boom")

    app.dependency_overrides[get_db_session] = override_get_db
    monkeypatch.setattr(overview_service, "invoke_overview", raise_error)

    try:
        client = TestClient(app)
        response = client.get("/tickers/MSFT/overview?asof=2026-01-16")
        assert response.status_code == 200
        payload = response.json()
        assert payload["overview"].startswith("Overview unavailable")
        assert payload["sources"] == []
    finally:
        app.dependency_overrides.clear()
