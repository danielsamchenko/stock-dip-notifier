"""AI overview orchestration and caching."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from dipdetector import config
from dipdetector.ai.lambda_client import invoke_overview
from dipdetector.db.models import AIOverview, DailyPrice, Ticker


def get_overview(session: Session, symbol: str, asof: date | None) -> dict[str, Any]:
    normalized = symbol.strip().upper()
    ticker = session.execute(
        select(Ticker).where(Ticker.symbol == normalized)
    ).scalar_one_or_none()
    if not ticker:
        raise ValueError("Ticker not found")

    asof_date = asof or _latest_price_date(session, ticker.id) or date.today()

    cached = _get_cached_overview(session, normalized, asof_date)
    if cached:
        return cached.overview_json

    dip_context = _compute_dip_context(session, ticker.id, asof_date)
    news_items: list[dict[str, Any]] = []

    payload = {
        "symbol": normalized,
        "asof": asof_date.isoformat(),
        "dip_context": dip_context or {},
        "news_items": news_items,
    }

    model_id: str | None = None
    try:
        raw = invoke_overview(payload)
        model_id = raw.get("model_id") if isinstance(raw, dict) else None
        result = _normalize_result(raw, normalized, asof_date)
    except Exception:
        result = _fallback_response(normalized, asof_date)

    _upsert_overview(session, normalized, asof_date, result, model_id)
    return result


def _latest_price_date(session: Session, ticker_id: int) -> date | None:
    return session.execute(
        select(func.max(DailyPrice.date)).where(DailyPrice.ticker_id == ticker_id)
    ).scalar_one_or_none()


def _get_cached_overview(
    session: Session, symbol: str, asof_date: date
) -> AIOverview | None:
    ttl_minutes = config.get_ai_overview_ttl_min()
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=ttl_minutes)

    cached = session.execute(
        select(AIOverview)
        .where(AIOverview.symbol == symbol, AIOverview.asof == asof_date)
        .order_by(AIOverview.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()

    if not cached:
        return None

    created_at = cached.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    if created_at >= cutoff:
        return cached

    return None


def _compute_dip_context(
    session: Session, ticker_id: int, asof_date: date, window_days: int = 5
) -> dict[str, Any] | None:
    rows = session.execute(
        select(DailyPrice.date, DailyPrice.close)
        .where(DailyPrice.ticker_id == ticker_id, DailyPrice.date <= asof_date)
        .order_by(DailyPrice.date.desc())
        .limit(window_days + 1)
    ).all()

    if len(rows) < 2:
        return None

    sorted_rows = sorted(rows, key=lambda row: row[0])
    asof_close = float(sorted_rows[-1][1])
    baseline_close = float(sorted_rows[0][1])

    if baseline_close == 0:
        return None

    dip_pct = (asof_close / baseline_close - 1) * 100

    return {
        "window_days": min(window_days, len(sorted_rows) - 1),
        "dip_pct": round(dip_pct, 4),
    }




def _normalize_result(raw: dict[str, Any], symbol: str, asof_date: date) -> dict[str, Any]:
    if not isinstance(raw, dict):
        return _fallback_response(symbol, asof_date)

    overview_text = raw.get("overview")
    if not isinstance(overview_text, str) or not overview_text.strip():
        overview_text = "Overview unavailable right now."

    drivers = raw.get("drivers") if isinstance(raw.get("drivers"), dict) else None
    key_factors = raw.get("key_factors") if isinstance(raw.get("key_factors"), list) else []
    sources = raw.get("sources") if isinstance(raw.get("sources"), list) else []

    return {
        "symbol": raw.get("symbol", symbol),
        "asof": raw.get("asof", asof_date.isoformat()),
        "overview": overview_text,
        "drivers": drivers,
        "key_factors": key_factors,
        "sources": sources,
    }


def _fallback_response(symbol: str, asof_date: date) -> dict[str, Any]:
    return {
        "symbol": symbol,
        "asof": asof_date.isoformat(),
        "overview": "Overview unavailable right now.",
        "drivers": None,
        "key_factors": [],
        "sources": [],
    }


def _upsert_overview(
    session: Session,
    symbol: str,
    asof_date: date,
    overview_json: dict[str, Any],
    model_id: str | None,
) -> None:
    existing = session.execute(
        select(AIOverview).where(AIOverview.symbol == symbol, AIOverview.asof == asof_date)
    ).scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if existing:
        existing.overview_json = overview_json
        existing.model_id = model_id
        existing.created_at = now
        return

    session.add(
        AIOverview(
            symbol=symbol,
            asof=asof_date,
            overview_json=overview_json,
            model_id=model_id,
            created_at=now,
        )
    )
