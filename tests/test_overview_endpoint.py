from __future__ import annotations

from datetime import datetime, timezone

from fastapi.testclient import TestClient

from dipdetector.api.deps import get_db_session
from dipdetector.api.main import app
from dipdetector.api.routes import tickers as tickers_route
from dipdetector.db import models
from dipdetector.db import session as db_session
from dipdetector.providers.massive_news_provider import NewsItem
from dipdetector.utils.ttl_cache import TTLCache


def test_overview_endpoint_caches(tmp_path, monkeypatch):
    db_url = f"sqlite+pysqlite:///{tmp_path / 'test.db'}"
    db_session.configure_engine(db_url)
    models.Base.metadata.create_all(db_session.get_engine())

    with db_session.get_session() as session:
        session.add(models.Ticker(symbol="AAPL", name="Apple Inc."))

    def override_get_db():
        with db_session.get_session() as session:
            yield session

    class StubProvider:
        def __init__(self) -> None:
            self.calls = 0

        def fetch_news(self, symbol: str, lookback_days: int, limit: int = 20) -> list[NewsItem]:
            self.calls += 1
            now = datetime(2026, 1, 16, tzinfo=timezone.utc)
            return [
                NewsItem(
                    title="Apple shares slide after downgrade",
                    publisher="Example News",
                    published_utc=now,
                    url="https://example.com/apple",
                    summary="Apple shares fell after analysts lowered guidance.",
                    sentiment="negative",
                    sentiment_reasoning=None,
                ),
                NewsItem(
                    title="Apple launches new product line",
                    publisher="Market Wire",
                    published_utc=now,
                    url="https://example.com/apple-2",
                    summary="The company unveiled a refreshed product lineup.",
                    sentiment="positive",
                    sentiment_reasoning=None,
                ),
            ]

    stub = StubProvider()

    app.dependency_overrides[get_db_session] = override_get_db
    monkeypatch.setattr(tickers_route, "_get_news_provider", lambda: stub)
    monkeypatch.setattr(tickers_route, "_overview_cache", TTLCache(ttl_seconds=3600))

    try:
        client = TestClient(app)
        response = client.get("/tickers/AAPL/overview")
        assert response.status_code == 200
        payload = response.json()
        assert payload["symbol"] == "AAPL"
        assert "Recent headlines" in payload["overview"]
        assert 1 <= len(payload["articles"]) <= 3
        assert stub.calls == 1

        response = client.get("/tickers/AAPL/overview")
        assert response.status_code == 200
        assert stub.calls == 1
    finally:
        app.dependency_overrides.clear()


def test_overview_endpoint_empty(monkeypatch, tmp_path):
    db_url = f"sqlite+pysqlite:///{tmp_path / 'test.db'}"
    db_session.configure_engine(db_url)
    models.Base.metadata.create_all(db_session.get_engine())

    with db_session.get_session() as session:
        session.add(models.Ticker(symbol="INTU", name="Intuit Inc."))

    def override_get_db():
        with db_session.get_session() as session:
            yield session

    class EmptyProvider:
        def fetch_news(self, symbol: str, lookback_days: int, limit: int = 20) -> list[NewsItem]:
            return []

    app.dependency_overrides[get_db_session] = override_get_db
    monkeypatch.setattr(tickers_route, "_get_news_provider", lambda: EmptyProvider())
    monkeypatch.setattr(tickers_route, "_overview_cache", TTLCache(ttl_seconds=3600))

    try:
        client = TestClient(app)
        response = client.get("/tickers/INTU/overview")
        assert response.status_code == 200
        payload = response.json()
        assert payload["overview"].startswith("No recent news")
        assert payload["articles"] == []
    finally:
        app.dependency_overrides.clear()
