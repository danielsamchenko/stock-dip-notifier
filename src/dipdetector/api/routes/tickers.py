"""Ticker API routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from dipdetector.api.deps import get_db_session
from dipdetector.api.schemas import (
    AlertOut,
    PriceOut,
    SignalOut,
    TickerDetailOut,
    TickerSummaryOut,
    parse_details,
    to_float,
)
from dipdetector.db.models import Alert, DailyPrice, Signal, Ticker

router = APIRouter(tags=["tickers"])


def _clamp_limit(limit: int, max_limit: int) -> int:
    if limit <= 0:
        return 1
    return min(limit, max_limit)


def _normalize_symbol(symbol: str) -> str:
    return symbol.strip().upper()


@router.get("/tickers", response_model=list[TickerSummaryOut])
def list_tickers(
    active_only: bool = Query(default=True),
    limit: int = Query(default=500, ge=1),
    session: Session = Depends(get_db_session),
) -> list[TickerSummaryOut]:
    limit = _clamp_limit(limit, 2000)

    latest_subq = (
        select(DailyPrice.ticker_id, func.max(DailyPrice.date).label("latest_price_date"))
        .group_by(DailyPrice.ticker_id)
        .subquery()
    )

    query = (
        select(Ticker, latest_subq.c.latest_price_date)
        .outerjoin(latest_subq, latest_subq.c.ticker_id == Ticker.id)
        .order_by(Ticker.symbol.asc())
        .limit(limit)
    )

    if active_only:
        query = query.where(Ticker.active.is_(True))

    rows = session.execute(query).all()

    results: list[TickerSummaryOut] = []
    for ticker, latest_date in rows:
        results.append(
            TickerSummaryOut(
                symbol=ticker.symbol,
                name=ticker.name,
                active=ticker.active,
                latest_price_date=latest_date,
            )
        )

    return results


@router.get("/tickers/{symbol}", response_model=TickerDetailOut)
def get_ticker(
    symbol: str,
    session: Session = Depends(get_db_session),
) -> TickerDetailOut:
    normalized = _normalize_symbol(symbol)
    ticker = session.execute(
        select(Ticker).where(Ticker.symbol == normalized)
    ).scalar_one_or_none()

    if not ticker:
        raise HTTPException(status_code=404, detail="Ticker not found")

    latest_price_row = session.execute(
        select(DailyPrice)
        .where(DailyPrice.ticker_id == ticker.id)
        .order_by(DailyPrice.date.desc())
        .limit(1)
    ).scalar_one_or_none()

    latest_price: PriceOut | None = None
    if latest_price_row:
        latest_price = PriceOut(
            symbol=ticker.symbol,
            date=latest_price_row.date,
            open=to_float(latest_price_row.open),
            high=to_float(latest_price_row.high),
            low=to_float(latest_price_row.low),
            close=to_float(latest_price_row.close),
            volume=latest_price_row.volume,
            source=latest_price_row.source,
        )

    signal_rows = session.execute(
        select(Signal)
        .where(Signal.ticker_id == ticker.id)
        .order_by(Signal.date.desc(), Signal.created_at.desc())
        .limit(30)
    ).scalars()

    recent_signals = [
        SignalOut(
            symbol=ticker.symbol,
            date=row.date,
            rule=row.rule,
            value=to_float(row.value),
            created_at=row.created_at,
        )
        for row in signal_rows
    ]

    alert_rows = session.execute(
        select(Alert)
        .where(Alert.ticker_id == ticker.id)
        .order_by(Alert.date.desc(), Alert.created_at.desc())
        .limit(30)
    ).scalars()

    recent_alerts = [
        AlertOut(
            symbol=ticker.symbol,
            date=row.date,
            rule=row.rule,
            magnitude=to_float(row.magnitude),
            threshold=to_float(row.threshold),
            details=parse_details(row.details_json),
            created_at=row.created_at,
        )
        for row in alert_rows
    ]

    return TickerDetailOut(
        symbol=ticker.symbol,
        name=ticker.name,
        active=ticker.active,
        latest_price=latest_price,
        recent_signals=recent_signals,
        recent_alerts=recent_alerts,
    )
