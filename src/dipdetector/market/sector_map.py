"""Sector ETF mappings for tickers (MVP)."""

from __future__ import annotations

MARKET_BENCHMARK = "SPY"

SECTOR_MAP: dict[str, str] = {
    "AAPL": "XLK",
    "MSFT": "XLK",
    "NVDA": "XLK",
    "AVGO": "XLK",
    "AMD": "XLK",
    "INTC": "XLK",
    "ADBE": "XLK",
    "ORCL": "XLK",
    "AMZN": "XLY",
    "TSLA": "XLY",
    "HD": "XLY",
    "DIS": "XLY",
    "NKE": "XLY",
    "META": "XLC",
    "GOOGL": "XLC",
    "NFLX": "XLC",
    "JPM": "XLF",
    "BAC": "XLF",
    "WFC": "XLF",
    "GS": "XLF",
    "MS": "XLF",
    "BLK": "XLF",
    "XOM": "XLE",
    "CVX": "XLE",
    "SLB": "XLE",
    "JNJ": "XLV",
    "UNH": "XLV",
    "PFE": "XLV",
    "TMO": "XLV",
    "GE": "XLI",
    "CAT": "XLI",
    "RTX": "XLI",
    "LMT": "XLI",
    "BA": "XLI",
    "UPS": "XLI",
    "WMT": "XLP",
    "COST": "XLP",
    "KO": "XLP",
    "PEP": "XLP",
}


def get_sector_etf(symbol: str) -> str | None:
    return SECTOR_MAP.get(symbol.strip().upper())
