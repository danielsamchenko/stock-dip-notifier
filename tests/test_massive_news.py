from __future__ import annotations

from dipdetector.providers.massive_news import fetch_ticker_news


class FakeResponse:
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


def test_fetch_ticker_news_limits_and_truncates(monkeypatch):
    long_title = "T" * 200
    long_summary = "S" * 400
    results = [
        {
            "title": f"{long_title} {i}",
            "publisher": {"name": "Publisher Name"},
            "published_utc": "2026-01-16T12:00:00Z",
            "summary": long_summary,
            "article_url": "https://example.com",
        }
        for i in range(12)
    ]

    def fake_get(*_args, **_kwargs):
        return FakeResponse(200, {"results": results})

    monkeypatch.setattr("dipdetector.providers.massive_news.requests.get", fake_get)

    items = fetch_ticker_news(
        "AAPL",
        limit=10,
        base_url="https://api.polygon.io",
        api_key="test",
    )

    assert len(items) == 10
    assert items[0]["title"] is not None and len(items[0]["title"]) <= 140
    assert items[0]["summary"] is not None and len(items[0]["summary"]) <= 260
