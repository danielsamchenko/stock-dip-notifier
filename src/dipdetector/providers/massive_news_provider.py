"""Massive (Polygon) ticker news provider."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from massive import RESTClient


@dataclass(frozen=True)
class NewsItem:
    title: str
    publisher: str | None
    published_utc: datetime | None
    url: str | None
    summary: str | None
    sentiment: str | None
    sentiment_reasoning: str | None


class MassiveNewsProvider:
    """Fetches recent ticker news from Massive (Polygon)."""

    def __init__(self, api_key: str, base_url: str | None = None):
        if not api_key:
            raise ValueError("MASSIVE_API_KEY is required to fetch news.")
        if base_url:
            try:
                self._client = RESTClient(api_key, base_url=base_url)
            except TypeError:
                self._client = RESTClient(api_key)
        else:
            self._client = RESTClient(api_key)

    def fetch_news(self, symbol: str, lookback_days: int, limit: int = 20) -> list[NewsItem]:
        published_from = (
            datetime.now(timezone.utc) - timedelta(days=lookback_days)
        ).date().isoformat()
        raw_items = self._call_news_api(symbol, published_from, limit)
        items: list[NewsItem] = []
        for raw in raw_items:
            item = _normalize_news_item(raw)
            if item:
                items.append(item)
        return items

    def _call_news_api(self, symbol: str, published_from: str, limit: int) -> list[Any]:
        method = None
        if hasattr(self._client, "list_ticker_news"):
            method = getattr(self._client, "list_ticker_news")
        elif hasattr(self._client, "get_ticker_news"):
            method = getattr(self._client, "get_ticker_news")

        if method is None:
            raise RuntimeError("Massive client does not support ticker news.")

        try:
            return list(
                method(
                    ticker=symbol,
                    published_utc_gte=published_from,
                    limit=limit,
                )
            )
        except TypeError:
            return list(method(ticker=symbol, limit=limit))


def _normalize_news_item(raw: Any) -> NewsItem | None:
    title = _get_value(raw, "title")
    url = _get_value(raw, "article_url", "url")
    if not title and not url:
        return None

    publisher_value = _get_value(raw, "publisher")
    publisher = _extract_publisher(publisher_value)

    published_value = _get_value(raw, "published_utc", "published_at")
    published_utc = _parse_datetime(published_value)

    summary = _get_value(raw, "summary", "description")
    sentiment = _get_value(raw, "sentiment")
    sentiment_reasoning = _get_value(raw, "sentiment_reasoning", "reasoning")

    insights = _get_value(raw, "insights")
    if isinstance(insights, list) and insights:
        sentiment = sentiment or _get_value(insights[0], "sentiment")
        sentiment_reasoning = sentiment_reasoning or _get_value(
            insights[0],
            "sentiment_reasoning",
            "reasoning",
        )

    return NewsItem(
        title=str(title) if title else "",
        publisher=publisher,
        published_utc=published_utc,
        url=str(url) if url else None,
        summary=str(summary) if summary else None,
        sentiment=str(sentiment) if sentiment else None,
        sentiment_reasoning=str(sentiment_reasoning) if sentiment_reasoning else None,
    )


def _extract_publisher(value: Any) -> str | None:
    if not value:
        return None
    if isinstance(value, dict):
        name = value.get("name")
        return str(name) if name else None
    if hasattr(value, "name"):
        name = getattr(value, "name")
        return str(name) if name else None
    return str(value)


def _parse_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            normalized = value.replace("Z", "+00:00")
            return datetime.fromisoformat(normalized)
        except ValueError:
            return None
    return None


def _get_value(raw: Any, *names: str) -> Any | None:
    for name in names:
        if hasattr(raw, name):
            value = getattr(raw, name)
        elif isinstance(raw, dict) and name in raw:
            value = raw[name]
        else:
            continue
        if value is not None:
            return value
    return None
