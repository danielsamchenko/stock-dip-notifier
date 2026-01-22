"""Chart data routes."""

from __future__ import annotations

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
