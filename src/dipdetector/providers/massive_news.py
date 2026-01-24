"""Massive (Polygon) news fetcher for AI overview input."""

from __future__ import annotations

from typing import Any

import requests


def fetch_ticker_news(
    symbol: str,
    *,
    limit: int,
    base_url: str,
    api_key: str,
) -> list[dict[str, Any]]:
    """Fetch and normalize recent news for a ticker.

    Returns compact dicts with: title, publisher, published_utc, summary, url.
    """
    url = f"{base_url.rstrip('/')}/v2/reference/news"
    params = {
        "ticker": symbol,
        "limit": limit,
        "order": "desc",
        "sort": "published_utc",
        "apiKey": api_key,
    }

    try:
        response = requests.get(url, params=params, timeout=10)
    except requests.RequestException:
        return []

    if response.status_code != 200:
        return []

    try:
        payload = response.json()
    except ValueError:
        return []

    raw_items = payload.get("results", []) if isinstance(payload, dict) else []
    items: list[dict[str, Any]] = []

    for raw in raw_items:
        if not isinstance(raw, dict):
            continue
        title = _truncate(raw.get("title"), 140)
        publisher = _truncate(_extract_publisher(raw), 60)
        published = raw.get("published_utc")
        summary = _truncate(raw.get("summary"), 260)
        url_value = raw.get("article_url") or raw.get("url")

        items.append(
            {
                "title": title,
                "publisher": publisher,
                "published_utc": published,
                "summary": summary,
                "url": url_value,
            }
        )

        if len(items) >= limit:
            break

    return items


def _extract_publisher(raw: dict[str, Any]) -> str | None:
    publisher = raw.get("publisher")
    if isinstance(publisher, dict):
        return publisher.get("name")
    if isinstance(publisher, str):
        return publisher
    return None


def _truncate(value: Any, max_len: int) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if len(text) <= max_len:
        return text
    return text[: max_len - 3].rstrip() + "..."
