from __future__ import annotations

from fastapi.testclient import TestClient

from dipdetector.api.main import app
from dipdetector.api.routes import chart as chart_routes


class FakeProvider:
    def fetch_intraday_bars(self, symbol, lookback_minutes, timespan, multiplier):
        assert symbol == "AAPL"
        assert lookback_minutes == 60
        assert timespan == "minute"
        assert multiplier == 1
        return [
            {"t": 1, "o": 10.0, "h": 12.0, "l": 9.0, "c": 11.0, "v": 100.0},
            {"t": 2, "o": 11.0, "h": 13.0, "l": 10.0, "c": 12.0, "v": 200.0},
        ]


def test_chart_intraday_endpoint(monkeypatch):
    monkeypatch.setattr(chart_routes, "_get_provider", lambda: FakeProvider())
    monkeypatch.setattr(chart_routes.config, "get_live_chart_timespan", lambda: "minute")
    monkeypatch.setattr(chart_routes.config, "get_live_chart_multiplier", lambda: 1)
    monkeypatch.setattr(chart_routes.config, "get_live_chart_lookback_minutes", lambda: 390)

    client = TestClient(app)
    response = client.get("/chart/intraday/AAPL", params={"lookback_minutes": 60})
    assert response.status_code == 200
    payload = response.json()
    assert payload["symbol"] == "AAPL"
    assert payload["timespan"] == "minute"
    assert len(payload["bars"]) == 2
    assert payload["bars"][0]["t"] == 1


class FakeFanout:
    async def register_client(self, symbol, ws):
        await ws.send_json(
            {
                "type": "bar",
                "bar": {"t": 1, "o": 10.0, "h": 12.0, "l": 9.0, "c": 11.0, "v": 100.0},
            }
        )

    async def unregister_client(self, symbol, ws):
        return None


def test_chart_intraday_websocket():
    client = TestClient(app)
    original = chart_routes._get_fanout
    chart_routes._get_fanout = lambda: FakeFanout()
    try:
        with client.websocket_connect("/ws/chart/intraday/AAPL") as ws:
            message = ws.receive_json()
            assert message["type"] == "bar"
            assert message["bar"]["c"] == 11.0
    finally:
        chart_routes._get_fanout = original
