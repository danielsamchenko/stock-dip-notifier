"""YFinance provider implementation."""

from __future__ import annotations

from datetime import date, timedelta
import time

import pandas as pd
import yfinance as yf

from dipdetector.providers.base import DailyPriceBar, PriceProvider


class YFinanceProvider(PriceProvider):
    """Fetches daily OHLCV bars from yfinance.

    Notes:
        - The `end` date is treated as inclusive. yfinance's `end` is exclusive,
          so we pass end + 1 day to include the requested end date.
    """

    def fetch_daily_prices(self, symbol: str, start: date, end: date) -> list[DailyPriceBar]:
        end_exclusive = end + timedelta(days=1)
        retries = [0.5, 1.0]
        last_error: Exception | None = None

        for attempt in range(len(retries) + 1):
            try:
                frame = yf.download(
                    symbol,
                    start=start,
                    end=end_exclusive,
                    progress=False,
                    auto_adjust=False,
                    actions=False,
                )
                normalized = _normalize_frame(frame, symbol)
                return _frame_to_bars(normalized)
            except Exception as exc:  # pragma: no cover - retries tested indirectly
                last_error = exc
                if attempt < len(retries):
                    time.sleep(retries[attempt])

        if last_error:
            raise last_error
        return []


def _normalize_frame(frame: pd.DataFrame | None, symbol: str) -> pd.DataFrame | None:
    if frame is None or frame.empty:
        return frame

    if isinstance(frame.columns, pd.MultiIndex):
        for level in range(frame.columns.nlevels):
            level_values = frame.columns.get_level_values(level)
            if symbol in level_values:
                frame = frame.xs(symbol, level=level, axis=1)
                break
        else:
            last_level = frame.columns.get_level_values(-1)
            if len(set(last_level)) == 1:
                frame = frame.droplevel(-1, axis=1)
            else:
                raise ValueError(
                    f"yfinance returned multiple tickers for {symbol}: {sorted(set(last_level))}"
                )

    return frame


def _frame_to_bars(frame: pd.DataFrame | None) -> list[DailyPriceBar]:
    if frame is None or frame.empty:
        return []

    bars: list[DailyPriceBar] = []
    for timestamp, row in frame.iterrows():
        if pd.isna(row.get("Open")):
            continue
        bar = DailyPriceBar(
            date=timestamp.date(),
            open=float(row["Open"]),
            high=float(row["High"]),
            low=float(row["Low"]),
            close=float(row["Close"]),
            volume=int(row["Volume"]) if not pd.isna(row.get("Volume")) else None,
        )
        bars.append(bar)
    return bars
