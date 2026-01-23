"""Compose a short news overview for a ticker."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

from dipdetector import config
from dipdetector.providers.massive_news_provider import NewsItem


@dataclass(frozen=True)
class OverviewArticle:
    title: str
    publisher: str | None
    published_utc: str | None
    url: str | None
    sentiment: str | None


@dataclass(frozen=True)
class OverviewResponse:
    symbol: str
    asof: date
    overview: str
    articles: list[OverviewArticle]


def compose_overview(
    symbol: str,
    company_name: str | None,
    items: list[NewsItem],
    asof: date | None = None,
) -> OverviewResponse:
    asof_date = asof or date.today()
    if not items:
        return OverviewResponse(
            symbol=symbol,
            asof=asof_date,
            overview="No recent news overview available.",
            articles=[],
        )

    max_items = config.get_news_max_items()
    sorted_items = sorted(
        items,
        key=lambda item: item.published_utc or datetime.min,
        reverse=True,
    )
    unique_items = _dedupe_items(sorted_items)
    top_items = unique_items[:max_items]

    snippets = _collect_snippets(top_items)
    overview_text = _build_overview_text(symbol, company_name, snippets, top_items)

    articles = [
        OverviewArticle(
            title=item.title,
            publisher=item.publisher,
            published_utc=item.published_utc.isoformat() if item.published_utc else None,
            url=item.url,
            sentiment=item.sentiment,
        )
        for item in top_items
    ]

    return OverviewResponse(
        symbol=symbol,
        asof=asof_date,
        overview=overview_text,
        articles=articles,
    )


def _dedupe_items(items: list[NewsItem]) -> list[NewsItem]:
    seen: set[str] = set()
    unique: list[NewsItem] = []
    for item in items:
        key = (item.url or item.title).lower()
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique


def _collect_snippets(items: list[NewsItem]) -> list[str]:
    snippets: list[str] = []
    for item in items:
        text = item.summary or item.title
        cleaned = _clean_sentence(text)
        if cleaned:
            snippets.append(cleaned)
    return snippets


def _build_overview_text(
    symbol: str,
    company_name: str | None,
    snippets: list[str],
    items: list[NewsItem],
) -> str:
    if not snippets:
        return "No recent news overview available."

    name = f"{symbol} ({company_name})" if company_name else symbol
    sentences: list[str] = []
    sentences.append(f"Recent headlines for {name} suggest {snippets[0]}.")

    if len(snippets) > 1:
        sentences.append(f"Other coverage mentions {snippets[1]}.")

    sentiment = _summarize_sentiment(items)
    if sentiment:
        sentences.append(f"Overall sentiment in recent coverage appears {sentiment}.")

    return " ".join(sentences[:3])


def _summarize_sentiment(items: list[NewsItem]) -> str | None:
    counts = {"positive": 0, "negative": 0, "neutral": 0}
    for item in items:
        if not item.sentiment:
            continue
        key = item.sentiment.lower()
        if key in counts:
            counts[key] += 1
    total = sum(counts.values())
    if total == 0:
        return None
    if counts["positive"] and counts["negative"]:
        return "mixed"
    if counts["positive"] >= counts["negative"] and counts["positive"] >= counts["neutral"]:
        return "positive"
    if counts["negative"] >= counts["positive"] and counts["negative"] >= counts["neutral"]:
        return "negative"
    return "neutral"


def _clean_sentence(text: str | None) -> str:
    if not text:
        return ""
    cleaned = " ".join(str(text).strip().split())
    cleaned = cleaned.rstrip(".")
    return cleaned
