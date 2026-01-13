"""Signals API routes for dips."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from dipdetector import config
from dipdetector.api.deps import get_db_session
from dipdetector.api.schemas import SignalOut, to_float
from dipdetector.db.models import Signal, Ticker

router = APIRouter(tags=["dips"])


def _parse_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD") from exc


def _clamp_limit(limit: int, max_limit: int) -> int:
    if limit <= 0:
        return 1
    return min(limit, max_limit)


@router.get("/dips", response_model=list[SignalOut])
def list_dips(
    date_str: str | None = Query(default=None, alias="date"),
    rule: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1),
    min_value: float | None = Query(default=None),
    session: Session = Depends(get_db_session),
) -> list[SignalOut]:
    limit = _clamp_limit(limit, 200)

    if rule is None:
        rule = f"drawdown_{config.get_dip_nday_window()}d"

    if date_str:
        asof_date = _parse_date(date_str)
    else:
        asof_date = session.execute(
            select(func.max(Signal.date)).where(Signal.rule == rule)
        ).scalar_one()
        if not asof_date:
            return []

    query = (
        select(Signal, Ticker.symbol)
        .join(Ticker, Ticker.id == Signal.ticker_id)
        .where(Signal.date == asof_date, Signal.rule == rule)
    )

    if min_value is not None:
        query = query.where(Signal.value <= min_value)

    query = query.order_by(Signal.value.asc()).limit(limit)

    rows = session.execute(query).all()

    results: list[SignalOut] = []
    for signal, ticker_symbol in rows:
        results.append(
            SignalOut(
                symbol=ticker_symbol,
                date=signal.date,
                rule=signal.rule,
                value=to_float(signal.value),
                created_at=signal.created_at,
            )
        )

    return results
