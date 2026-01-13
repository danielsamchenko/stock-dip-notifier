"""Alerts API routes."""

from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from dipdetector.api.deps import get_db_session
from dipdetector.api.schemas import AlertOut, parse_details, to_float
from dipdetector.db.models import Alert, Ticker

router = APIRouter(tags=["alerts"])


def _parse_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD") from exc


def _clamp_limit(limit: int, max_limit: int) -> int:
    if limit <= 0:
        return 1
    return min(limit, max_limit)


@router.get("/alerts", response_model=list[AlertOut])
def list_alerts(
    date_str: str | None = Query(default=None, alias="date"),
    days: int = Query(default=7, ge=1),
    rule: str | None = Query(default=None),
    symbol: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1),
    session: Session = Depends(get_db_session),
) -> list[AlertOut]:
    limit = _clamp_limit(limit, 200)

    query = select(Alert, Ticker.symbol).join(Ticker, Ticker.id == Alert.ticker_id)

    if date_str:
        asof_date = _parse_date(date_str)
        query = query.where(Alert.date == asof_date)
    else:
        today = date.today()
        start_date = today - timedelta(days=days)
        query = query.where(Alert.date >= start_date, Alert.date <= today)

    if rule:
        query = query.where(Alert.rule == rule)

    if symbol:
        query = query.where(Ticker.symbol == symbol.strip().upper())

    query = query.order_by(Alert.date.desc(), Alert.created_at.desc()).limit(limit)

    rows = session.execute(query).all()

    results: list[AlertOut] = []
    for alert, ticker_symbol in rows:
        results.append(
            AlertOut(
                symbol=ticker_symbol,
                date=alert.date,
                rule=alert.rule,
                magnitude=to_float(alert.magnitude),
                threshold=to_float(alert.threshold),
                details=parse_details(alert.details_json),
                created_at=alert.created_at,
            )
        )

    return results
