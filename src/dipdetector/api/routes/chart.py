"""Chart data routes."""

from __future__ import annotations

from datetime import datetime, time as time_of_day, timezone, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect

from dipdetector import config
from dipdetector.api.schemas import IntradayBarOut, IntradayChartResponse
from dipdetector.providers.massive_provider import MassiveProvider
from dipdetector.realtime.massive_ws import MassiveWSFanout, get_fanout

router = APIRouter(tags=["chart"])
_fanout: MassiveWSFanout | None = None


def _get_provider() -> MassiveProvider:
    return MassiveProvider(
        config.get_massive_api_key(),
        config.get_massive_rest_base_url(),
    )


def _get_fanout() -> MassiveWSFanout:
    global _fanout
    if _fanout is None:
        _fanout = get_fanout()
    return _fanout


@router.get("/chart/intraday/{symbol}", response_model=IntradayChartResponse)
def get_intraday_chart(
    symbol: str,
    lookback_minutes: int | None = Query(default=None, ge=1, le=3900),
) -> IntradayChartResponse:
    lookback = lookback_minutes or config.get_live_chart_lookback_minutes()
    timespan = config.get_live_chart_timespan()
    multiplier = config.get_live_chart_multiplier()
    provider = _get_provider()
    try:
        bars = provider.fetch_intraday_bars(symbol, lookback, timespan, multiplier)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Failed to fetch intraday bars") from exc

    return IntradayChartResponse(
        symbol=symbol.upper(),
        timespan=timespan,
        bars=[IntradayBarOut(**bar) for bar in bars],
    )


@router.get("/chart/daily/{symbol}", response_model=IntradayChartResponse)
def get_daily_chart(
    symbol: str,
    lookback_days: int = Query(default=30, ge=1, le=5000),
    timespan: str = Query(default="day", pattern="^(minute|hour|day)$"),
    multiplier: int = Query(default=1, ge=1, le=60),
) -> IntradayChartResponse:
    provider = _get_provider()
    end_dt = _get_session_end(datetime.now(timezone.utc))
    eastern = ZoneInfo("America/New_York")
    end_local = end_dt.astimezone(eastern)
    start_date = end_local.date() - timedelta(days=lookback_days)
    start_dt = datetime.combine(start_date, time_of_day(9, 30), tzinfo=eastern)
    try:
        bars = provider.fetch_aggregate_bars(
            symbol,
            start_dt=start_dt,
            end_dt=end_dt,
            timespan=timespan,
            multiplier=multiplier,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Failed to fetch daily bars") from exc

    return IntradayChartResponse(
        symbol=symbol.upper(),
        timespan=timespan,
        bars=[IntradayBarOut(**bar) for bar in bars],
    )


@router.websocket("/ws/chart/intraday/{symbol}")
async def ws_intraday_chart(websocket: WebSocket, symbol: str) -> None:
    await websocket.accept()
    symbol = symbol.upper()
    fanout = _get_fanout()
    await fanout.register_client(symbol, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await fanout.unregister_client(symbol, websocket)


def _get_session_end(value: datetime) -> datetime:
    eastern = ZoneInfo("America/New_York")
    local = value.astimezone(eastern)
    session_date = _resolve_session_date(local)
    session_start = datetime.combine(session_date, time_of_day(9, 30), tzinfo=eastern)
    session_close = datetime.combine(session_date, time_of_day(16, 0), tzinfo=eastern)

    if session_start <= local <= session_close:
        return local
    return session_close


def _resolve_session_date(local: datetime) -> datetime.date:
    session_date = local.date()
    if local.weekday() >= 5:
        session_date = _previous_weekday(session_date - timedelta(days=1))
    elif local.time() < time_of_day(9, 30):
        session_date = _previous_weekday(session_date - timedelta(days=1))
    return session_date


def _previous_weekday(value: datetime.date) -> datetime.date:
    while value.weekday() >= 5:
        value -= timedelta(days=1)
    return value
