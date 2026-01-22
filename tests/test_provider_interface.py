from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone

from dipdetector.providers import massive_provider
from dipdetector.providers.massive_provider import MassiveProvider


@dataclass
class FakeAgg:
    t: int
    o: float
    h: float
    l: float
    c: float
    v: int


def _ts(value: str) -> int:
    return int(datetime.fromisoformat(value).replace(tzinfo=timezone.utc).timestamp() * 1000)


def test_massive_provider_maps_daily_bars(monkeypatch):
    start = date(2024, 1, 2)
    end = date(2024, 1, 3)

    captured: dict[str, object] = {}

    class FakeClient:
        def __init__(self, api_key: str):
            captured["api_key"] = api_key

        def list_aggs(self, **kwargs):
            captured.update(kwargs)
            return [
                FakeAgg(_ts("2024-01-02T00:00:00"), 10.0, 12.0, 9.0, 11.0, 100),
                FakeAgg(_ts("2024-01-03T00:00:00"), 11.0, 13.0, 10.0, 12.0, 200),
            ]

    monkeypatch.setattr(massive_provider, "RESTClient", FakeClient)

    provider = MassiveProvider("test-key")
    bars = provider.fetch_daily_prices("AAPL", start, end)

    assert captured["api_key"] == "test-key"
    assert captured["ticker"] == "AAPL"
    assert captured["from_"] == start.isoformat()
    assert captured["to"] == end.isoformat()
    assert captured["timespan"] == "day"
    assert captured["multiplier"] == 1
    assert captured["adjusted"] is True
    assert len(bars) == 2
    assert bars[0].date == date(2024, 1, 2)
    assert bars[0].open == 10.0
    assert bars[1].date == date(2024, 1, 3)
    assert bars[1].close == 12.0


def test_massive_provider_retries(monkeypatch):
    start = date(2024, 1, 2)
    end = date(2024, 1, 2)
    calls = {"count": 0}

    class FakeClient:
        def __init__(self, api_key: str):
            pass

        def list_aggs(self, **kwargs):
            calls["count"] += 1
            if calls["count"] == 1:
                raise RuntimeError("temporary failure")
            return [FakeAgg(_ts("2024-01-02T00:00:00"), 10.0, 12.0, 9.0, 11.0, 100)]

    monkeypatch.setattr(massive_provider, "RESTClient", FakeClient)
    monkeypatch.setattr(massive_provider.time, "sleep", lambda _: None)

    provider = MassiveProvider("test-key")
    bars = provider.fetch_daily_prices("AAPL", start, end)

    assert calls["count"] == 2
    assert len(bars) == 1
