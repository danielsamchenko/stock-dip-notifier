from __future__ import annotations

import pandas as pd
from fastapi.testclient import TestClient

from dipdetector.api.main import app
from dipdetector.api.routes import tickers as tickers_routes
from dipdetector.providers.analyst_base import AnalystRecommendation
from dipdetector.providers import yfinance_analyst_provider as provider_module


def test_analyst_provider_parses_trend_dataframe(monkeypatch):
    frame = pd.DataFrame(
        [
            {
                "strongBuy": 4,
                "buy": 2,
                "hold": 1,
                "sell": 0,
                "strongSell": 0,
            }
        ]
    )

    class FakeTicker:
        recommendation_trend = frame

    monkeypatch.setattr(provider_module.yf, "Ticker", lambda symbol: FakeTicker())

    provider = provider_module.YFinanceAnalystProvider()
    recommendation = provider.get_recommendation("AAPL")

    assert recommendation is not None
    assert recommendation.strong_buy == 4
    assert recommendation.buy == 2
    assert recommendation.hold == 1
    assert recommendation.sell == 0
    assert recommendation.strong_sell == 0
    assert recommendation.summary == "Strong Buy"


def test_analyst_provider_fallback_recommendations_dataframe(monkeypatch):
    frame = pd.DataFrame(
        [
            {"To Grade": "Strong Buy"},
            {"To Grade": "Buy"},
            {"To Grade": "Hold"},
            {"To Grade": "Sell"},
            {"To Grade": "Strong Sell"},
        ]
    )

    class FakeTicker:
        recommendation_trend = None
        recommendation_summary = None
        recommendations_summary = None
        recommendations = frame

    monkeypatch.setattr(provider_module.yf, "Ticker", lambda symbol: FakeTicker())

    provider = provider_module.YFinanceAnalystProvider()
    recommendation = provider.get_recommendation("MSFT")

    assert recommendation is not None
    assert recommendation.strong_buy == 1
    assert recommendation.buy == 1
    assert recommendation.hold == 1
    assert recommendation.sell == 1
    assert recommendation.strong_sell == 1
    assert recommendation.summary == "Hold"


def test_recommendation_endpoint_caches(monkeypatch):
    calls = {"count": 0}

    class FakeProvider:
        def get_recommendation(self, symbol: str) -> AnalystRecommendation | None:
            calls["count"] += 1
            return AnalystRecommendation(
                strong_buy=1,
                buy=2,
                hold=3,
                sell=0,
                strong_sell=0,
                summary="Hold",
            )

    monkeypatch.setattr(tickers_routes, "_recommendation_provider", FakeProvider())
    tickers_routes._recommendation_cache.clear()

    client = TestClient(app)
    response = client.get("/tickers/AAPL/recommendation")
    assert response.status_code == 200
    assert response.json()["summary"] == "Hold"

    response = client.get("/tickers/AAPL/recommendation")
    assert response.status_code == 200
    assert calls["count"] == 1


def test_recommendation_endpoint_not_available(monkeypatch):
    class FakeProvider:
        def get_recommendation(self, symbol: str) -> AnalystRecommendation | None:
            return None

    monkeypatch.setattr(tickers_routes, "_recommendation_provider", FakeProvider())
    tickers_routes._recommendation_cache.clear()

    client = TestClient(app)
    response = client.get("/tickers/INTU/recommendation")
    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"] == "Not available"
    assert payload["strong_buy"] == 0
    assert payload["buy"] == 0
    assert payload["hold"] == 0
    assert payload["sell"] == 0
    assert payload["strong_sell"] == 0
