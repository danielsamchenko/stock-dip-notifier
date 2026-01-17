"""Analyst recommendation provider interfaces."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class AnalystRecommendation:
    strong_buy: int
    buy: int
    hold: int
    sell: int
    strong_sell: int
    summary: str
    source: str = "yfinance"


class AnalystProvider(Protocol):
    def get_recommendation(self, symbol: str) -> AnalystRecommendation | None:
        """Return analyst recommendation counts for the symbol, if available."""
        ...


def summarize_counts(
    strong_buy: int,
    buy: int,
    hold: int,
    sell: int,
    strong_sell: int,
) -> str:
    """Return a simple summary label based on analyst counts (MVP heuristic)."""
    total = strong_buy + buy + hold + sell + strong_sell
    if total == 0:
        return "Not available"

    score = (strong_buy * 2 + buy) - (sell + strong_sell * 2)
    normalized = score / max(total, 1)

    if normalized >= 0.8:
        return "Strong Buy"
    if normalized >= 0.3:
        return "Buy"
    if normalized > -0.3:
        return "Hold"
    if normalized > -0.8:
        return "Sell"
    return "Strong Sell"
