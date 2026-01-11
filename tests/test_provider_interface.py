from __future__ import annotations

from datetime import date, timedelta

import pandas as pd
import yfinance as yf

from dipdetector.providers.yfinance_provider import YFinanceProvider


def test_yfinance_provider_parses_daily_bars(monkeypatch):
    start = date(2024, 1, 2)
    end = date(2024, 1, 3)

    columns = pd.MultiIndex.from_tuples(
        [
            ("Open", "AAPL"),
            ("High", "AAPL"),
            ("Low", "AAPL"),
            ("Close", "AAPL"),
            ("Volume", "AAPL"),
        ],
        names=["Price", "Ticker"],
    )
    frame = pd.DataFrame(
        [
            [10.0, 12.0, 9.0, 11.0, 100],
            [11.0, 13.0, 10.0, 12.0, 200],
        ],
        index=pd.to_datetime(["2024-01-02", "2024-01-03"]),
        columns=columns,
    )

    captured: dict[str, object] = {}

    def fake_download(symbol, start, end, progress, auto_adjust, actions):
        captured["symbol"] = symbol
        captured["start"] = start
        captured["end"] = end
        return frame

    monkeypatch.setattr(yf, "download", fake_download)

    provider = YFinanceProvider()
    bars = provider.fetch_daily_prices("AAPL", start, end)

    assert captured["symbol"] == "AAPL"
    assert captured["start"] == start
    assert captured["end"] == end + timedelta(days=1)
    assert len(bars) == 2
    assert bars[0].date == date(2024, 1, 2)
    assert bars[0].open == 10.0
    assert bars[1].date == date(2024, 1, 3)
    assert bars[1].close == 12.0
