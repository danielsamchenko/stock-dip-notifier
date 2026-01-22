"""Massive (Polygon) provider implementation."""

from __future__ import annotations

from datetime import date, datetime, time as time_of_day, timezone, timedelta
import time
from typing import Any
from zoneinfo import ZoneInfo

from massive import RESTClient

from dipdetector.providers.base import DailyPriceBar, PriceProvider


class MassiveProvider(PriceProvider):
    """Fetches daily OHLCV bars from Massive (Polygon).

    Notes:
        - The `end` date is treated as inclusive, matching the Massive aggregates API.
        - Uses adjusted prices by default.
    """

    def __init__(self, api_key: str, base_url: str | None = None):
        if not api_key:
            raise ValueError("MASSIVE_API_KEY is required to fetch prices.")
        if base_url:
            try:
                self._client = RESTClient(api_key, base_url=base_url)
            except TypeError:
                self._client = RESTClient(api_key)
        else:
            self._client = RESTClient(api_key)

    def fetch_daily_prices(self, symbol: str, start: date, end: date) -> list[DailyPriceBar]:
        start_str = start.isoformat()
        end_str = end.isoformat()
        retries = [0.5, 1.5, 3.0]
        last_error: Exception | None = None

        for attempt in range(len(retries) + 1):
            try:
                aggs = self._client.list_aggs(
                    ticker=symbol,
                    multiplier=1,
                    timespan="day",
                    from_=start_str,
                    to=end_str,
                    limit=50000,
                    adjusted=True,
                )
                bars = [_agg_to_bar(agg) for agg in aggs]
                cleaned = [bar for bar in bars if bar is not None]
                cleaned.sort(key=lambda bar: bar.date)
                return cleaned
            except Exception as exc:  # pragma: no cover - retry behavior tested separately
                last_error = exc
                if attempt < len(retries):
                    time.sleep(retries[attempt])

        if last_error:
            raise last_error
        return []

    def fetch_intraday_bars(
        self,
        symbol: str,
        lookback_minutes: int,
        timespan: str = "minute",
        multiplier: int = 1,
    ) -> list[dict[str, float | int]]:
        if lookback_minutes <= 0:
            return []

        end_dt = _get_session_end(datetime.now(timezone.utc))
        start_dt = end_dt - timedelta(minutes=lookback_minutes)
        session_start = _get_session_start(end_dt)
        if start_dt < session_start:
            start_dt = session_start
        start_ms = int(start_dt.timestamp() * 1000)
        end_ms = int(end_dt.timestamp() * 1000)
        retries = [0.5, 1.5, 3.0]
        last_error: Exception | None = None

        for attempt in range(len(retries) + 1):
            try:
                aggs = self._client.list_aggs(
                    ticker=symbol,
                    multiplier=multiplier,
                    timespan=timespan,
                    from_=start_ms,
                    to=end_ms,
                    limit=50000,
                    adjusted=True,
                )
                bars = [_agg_to_intraday_bar(agg) for agg in aggs]
                cleaned = [bar for bar in bars if bar is not None]
                cleaned.sort(key=lambda bar: bar["t"])
                return cleaned
            except Exception as exc:  # pragma: no cover - retry behavior tested elsewhere
                last_error = exc
                if attempt < len(retries):
                    time.sleep(retries[attempt])

        if last_error:
            raise last_error
        return []

    def fetch_aggregate_bars(
        self,
        symbol: str,
        start_dt: datetime,
        end_dt: datetime,
        timespan: str,
        multiplier: int = 1,
    ) -> list[dict[str, float | int]]:
        start_ms = int(start_dt.timestamp() * 1000)
        end_ms = int(end_dt.timestamp() * 1000)
        retries = [0.5, 1.5, 3.0]
        last_error: Exception | None = None

        for attempt in range(len(retries) + 1):
            try:
                aggs = self._client.list_aggs(
                    ticker=symbol,
                    multiplier=multiplier,
                    timespan=timespan,
                    from_=start_ms,
                    to=end_ms,
                    limit=50000,
                    adjusted=True,
                )
                bars = [_agg_to_intraday_bar(agg) for agg in aggs]
                cleaned = [bar for bar in bars if bar is not None]
                cleaned.sort(key=lambda bar: bar["t"])
                return cleaned
            except Exception as exc:  # pragma: no cover - retry behavior tested elsewhere
                last_error = exc
                if attempt < len(retries):
                    time.sleep(retries[attempt])

        if last_error:
            raise last_error
        return []


def _agg_to_bar(agg: Any) -> DailyPriceBar | None:
    timestamp = _get_agg_value(agg, "timestamp", "t")
    if timestamp is None:
        return None

    open_price = _get_agg_value(agg, "open", "o")
    high = _get_agg_value(agg, "high", "h")
    low = _get_agg_value(agg, "low", "l")
    close = _get_agg_value(agg, "close", "c")
    if open_price is None or high is None or low is None or close is None:
        return None

    volume = _get_agg_value(agg, "volume", "v")
    volume_value = int(volume) if volume is not None else None

    bar_date = datetime.fromtimestamp(int(timestamp) / 1000, tz=timezone.utc).date()
    return DailyPriceBar(
        date=bar_date,
        open=float(open_price),
        high=float(high),
        low=float(low),
        close=float(close),
        volume=volume_value,
    )


def _agg_to_intraday_bar(agg: Any) -> dict[str, float | int] | None:
    timestamp = _get_agg_value(agg, "timestamp", "t")
    if timestamp is None:
        return None

    open_price = _get_agg_value(agg, "open", "o")
    high = _get_agg_value(agg, "high", "h")
    low = _get_agg_value(agg, "low", "l")
    close = _get_agg_value(agg, "close", "c")
    if open_price is None or high is None or low is None or close is None:
        return None

    volume = _get_agg_value(agg, "volume", "v")
    volume_value = float(volume) if volume is not None else 0.0

    return {
        "t": int(timestamp),
        "o": float(open_price),
        "h": float(high),
        "l": float(low),
        "c": float(close),
        "v": volume_value,
    }


def _get_agg_value(agg: Any, *names: str) -> Any | None:
    for name in names:
        if hasattr(agg, name):
            value = getattr(agg, name)
        elif isinstance(agg, dict) and name in agg:
            value = agg[name]
        else:
            continue
        if value is not None:
            return value
    return None


def _get_session_start(value: datetime) -> datetime:
    eastern = ZoneInfo("America/New_York")
    local = value.astimezone(eastern)
    session_date = _resolve_session_date(local)
    return datetime.combine(session_date, time_of_day(9, 30), tzinfo=eastern)


def _get_session_end(value: datetime) -> datetime:
    eastern = ZoneInfo("America/New_York")
    local = value.astimezone(eastern)
    session_date = _resolve_session_date(local)
    session_start = datetime.combine(session_date, time_of_day(9, 30), tzinfo=eastern)
    session_close = datetime.combine(session_date, time_of_day(16, 0), tzinfo=eastern)

    if session_start <= local <= session_close:
        return local
    return session_close


def _resolve_session_date(local: datetime) -> date:
    session_date = local.date()
    if local.weekday() >= 5:
        session_date = _previous_weekday(session_date - timedelta(days=1))
    elif local.time() < time_of_day(9, 30):
        session_date = _previous_weekday(session_date - timedelta(days=1))
    return session_date


def _previous_weekday(value: date) -> date:
    while value.weekday() >= 5:
        value -= timedelta(days=1)
    return value
