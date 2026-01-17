"""YFinance analyst recommendation provider."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import pandas as pd
import yfinance as yf

from dipdetector.providers.analyst_base import (
    AnalystProvider,
    AnalystRecommendation,
    summarize_counts,
)


class YFinanceAnalystProvider(AnalystProvider):
    """Fetch analyst recommendations from yfinance with defensive parsing."""

    def get_recommendation(self, symbol: str) -> AnalystRecommendation | None:
        ticker = yf.Ticker(symbol)

        counts = _extract_counts_from_ticker(ticker)
        if counts is None:
            return None

        summary = summarize_counts(**counts)
        return AnalystRecommendation(
            strong_buy=counts["strong_buy"],
            buy=counts["buy"],
            hold=counts["hold"],
            sell=counts["sell"],
            strong_sell=counts["strong_sell"],
            summary=summary,
        )


def _extract_counts_from_ticker(ticker: Any) -> dict[str, int] | None:
    summary_attrs = [
        "recommendation_trend",
        "recommendationTrend",
        "recommendations_summary",
        "recommendation_summary",
        "recommendationsSummary",
        "recommendationSummary",
    ]

    for attr in summary_attrs:
        value = getattr(ticker, attr, None)
        counts = _counts_from_value(value)
        if counts is not None:
            return counts

    recommendations = getattr(ticker, "recommendations", None)
    counts = _counts_from_recommendations(recommendations)
    if counts is not None:
        return counts

    return None


def _counts_from_value(value: Any) -> dict[str, int] | None:
    if value is None:
        return None
    if isinstance(value, pd.DataFrame):
        return _counts_from_dataframe(value)
    if isinstance(value, Mapping):
        return _counts_from_mapping(value)
    return None


def _counts_from_dataframe(frame: pd.DataFrame) -> dict[str, int] | None:
    if frame.empty:
        return None
    row = frame.iloc[-1]
    return _counts_from_mapping(row.to_dict())


def _counts_from_mapping(mapping: Mapping[str, Any]) -> dict[str, int] | None:
    counts = {
        "strong_buy": 0,
        "buy": 0,
        "hold": 0,
        "sell": 0,
        "strong_sell": 0,
    }
    found = False
    for key, value in mapping.items():
        normalized = _normalize_key(str(key))
        if normalized == "strongbuy":
            counts["strong_buy"] = _safe_int(value)
            found = True
        elif normalized == "buy":
            counts["buy"] = _safe_int(value)
            found = True
        elif normalized == "hold":
            counts["hold"] = _safe_int(value)
            found = True
        elif normalized == "sell":
            counts["sell"] = _safe_int(value)
            found = True
        elif normalized == "strongsell":
            counts["strong_sell"] = _safe_int(value)
            found = True

    if not found:
        return None
    return counts


def _counts_from_recommendations(frame: pd.DataFrame | None) -> dict[str, int] | None:
    if not isinstance(frame, pd.DataFrame) or frame.empty:
        return None

    counts = {
        "strong_buy": 0,
        "buy": 0,
        "hold": 0,
        "sell": 0,
        "strong_sell": 0,
    }
    found = False
    columns = {col.lower(): col for col in frame.columns}
    grade_key = columns.get("to grade") or columns.get("to_grade") or columns.get("grade")
    action_key = columns.get("action")

    sample = frame.tail(30)
    for _, row in sample.iterrows():
        grade = row.get(grade_key) if grade_key else None
        action = row.get(action_key) if action_key else None
        bucket = _bucket_from_text(grade) or _bucket_from_text(action)
        if bucket is None:
            continue
        counts[bucket] += 1
        found = True

    if not found:
        return None
    return counts


def _bucket_from_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip().lower()
    if not text:
        return None

    if "strong buy" in text or "strongbuy" in text:
        return "strong_buy"
    if "strong sell" in text or "strongsell" in text:
        return "strong_sell"
    if "buy" in text or "outperform" in text or "overweight" in text:
        return "buy"
    if "sell" in text or "underperform" in text or "underweight" in text:
        return "sell"
    if "hold" in text or "neutral" in text or "market perform" in text:
        return "hold"
    return None


def _normalize_key(value: str) -> str:
    return "".join(char for char in value.lower() if char.isalnum())


def _safe_int(value: Any) -> int:
    if value is None:
        return 0
    try:
        if pd.isna(value):
            return 0
    except TypeError:
        pass
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0
