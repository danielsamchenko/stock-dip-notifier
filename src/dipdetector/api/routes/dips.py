"""Signals API routes for dips."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from dipdetector import config
from dipdetector.api.deps import get_db_session
from dipdetector.api.schemas import CurrentDipItem, CurrentDipsResponse, SignalOut, to_float
from dipdetector.analyze.current_dips import compute_best_recent_drawdown
from dipdetector.db.models import DailyPrice, Signal, Ticker

router = APIRouter(tags=["dips"])
DEFAULT_WINDOWS = [1, 2, 3, 5, 7, 10, 14]


def _parse_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD") from exc


def _clamp_limit(limit: int, max_limit: int) -> int:
    if limit <= 0:
        return 1
    return min(limit, max_limit)


def _parse_windows(value: str | None) -> list[int]:
    if not value:
        return DEFAULT_WINDOWS.copy()

    windows: list[int] = []
    seen: set[int] = set()
    for part in value.split(","):
        text = part.strip()
        if not text:
            continue
        try:
            window = int(text)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="windows must be integers") from exc
        if window <= 0:
            raise HTTPException(status_code=400, detail="windows must be positive integers")
        if window not in seen:
            windows.append(window)
            seen.add(window)

    return windows or DEFAULT_WINDOWS.copy()


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


@router.get("/dips/current", response_model=CurrentDipsResponse)
def list_current_dips(
    asof: str | None = Query(default=None),
    windows: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1),
    min_dip: float = Query(default=-5.0),
    session: Session = Depends(get_db_session),
) -> CurrentDipsResponse:
    limit = _clamp_limit(limit, 200)
    window_list = _parse_windows(windows)
    source = config.get_price_source()

    if asof:
        asof_date = _parse_date(asof)
    else:
        asof_date = session.execute(
            select(func.max(DailyPrice.date)).where(DailyPrice.source == source)
        ).scalar_one()
        if not asof_date:
            return CurrentDipsResponse(asof=None, windows=window_list, items=[])

    lookback = max(window_list)
    if 1 in window_list:
        lookback = max(lookback, 2)
    tickers = (
        session.execute(select(Ticker).where(Ticker.active.is_(True))).scalars().all()
    )

    items: list[CurrentDipItem] = []
    for ticker in tickers:
        rows = session.execute(
            select(DailyPrice.date, DailyPrice.close)
            .where(
                DailyPrice.ticker_id == ticker.id,
                DailyPrice.date <= asof_date,
                DailyPrice.source == source,
            )
            .order_by(DailyPrice.date.desc())
            .limit(lookback)
        ).all()

        prices = [(row.date, to_float(row.close)) for row in rows]
        prices.reverse()
        result = compute_best_recent_drawdown(prices, asof_date, window_list)
        if not result:
            continue

        dip_value, window_days = result
        if dip_value <= min_dip:
            items.append(
                CurrentDipItem(
                    symbol=ticker.symbol,
                    date=asof_date,
                    dip=float(dip_value),
                    window_days=window_days,
                )
            )

    items.sort(key=lambda item: item.dip)
    return CurrentDipsResponse(asof=asof_date, windows=window_list, items=items[:limit])
