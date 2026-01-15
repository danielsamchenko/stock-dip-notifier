"""Signals API routes for dips."""

from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from dipdetector import config
from dipdetector.api.deps import get_db_session
from dipdetector.api.schemas import CurrentDipItem, CurrentDipsResponse, SignalOut, to_float
from dipdetector.analyze.current_dips import compute_best_recent_drawdown
from dipdetector.db.models import DailyPrice, Signal, Ticker
from dipdetector.market.returns import compute_return_pct, get_closes_for_symbol
from dipdetector.market.sector_map import MARKET_BENCHMARK, get_sector_etf

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


def _window_start_date(
    prices: list[tuple[date, float]],
    asof_date: date,
    window_days: int,
) -> date | None:
    filtered = [(day, close) for day, close in prices if day <= asof_date]
    if not filtered:
        return None

    if window_days == 1:
        if len(filtered) < 2:
            return None
        return filtered[-2][0]

    if len(filtered) < window_days:
        return None
    return filtered[-window_days][0]


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

    start_floor = asof_date - timedelta(days=lookback * 2)
    tickers = (
        session.execute(select(Ticker).where(Ticker.active.is_(True))).scalars().all()
    )
    sector_symbols = {get_sector_etf(ticker.symbol) for ticker in tickers}
    benchmark_symbols = {MARKET_BENCHMARK}
    preload_symbols = {symbol for symbol in sector_symbols if symbol} | benchmark_symbols
    closes_cache: dict[str, list[tuple[date, float]]] = {}
    for symbol in preload_symbols:
        closes_cache[symbol] = get_closes_for_symbol(session, symbol, start_floor, asof_date)

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
            window_start = _window_start_date(prices, asof_date, window_days)
            ticker_return = (
                compute_return_pct(prices, window_start, asof_date)
                if window_start
                else None
            )

            spy_closes = closes_cache.get(MARKET_BENCHMARK, [])
            spy_return = (
                compute_return_pct(spy_closes, window_start, asof_date)
                if window_start
                else None
            )

            sector_symbol = get_sector_etf(ticker.symbol)
            sector_return = None
            if sector_symbol and window_start:
                sector_closes = closes_cache.get(sector_symbol, [])
                if sector_closes:
                    sector_return = compute_return_pct(sector_closes, window_start, asof_date)

            relative_to_spy = (
                ticker_return - spy_return
                if ticker_return is not None and spy_return is not None
                else None
            )
            relative_to_sector = (
                ticker_return - sector_return
                if ticker_return is not None and sector_return is not None
                else None
            )
            items.append(
                CurrentDipItem(
                    symbol=ticker.symbol,
                    date=asof_date,
                    dip=float(dip_value),
                    window_days=window_days,
                    market_symbol=MARKET_BENCHMARK,
                    sector_symbol=sector_symbol,
                    ticker_return_pct=ticker_return,
                    spy_return_pct=spy_return,
                    sector_return_pct=sector_return,
                    relative_to_spy_pp=relative_to_spy,
                    relative_to_sector_pp=relative_to_sector,
                )
            )

    items.sort(key=lambda item: item.dip)
    return CurrentDipsResponse(asof=asof_date, windows=window_list, items=items[:limit])
