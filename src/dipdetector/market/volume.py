"""Volume spike calculation helpers."""

from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from dipdetector import config
from dipdetector.db.models import DailyPrice, Ticker

VolumePoint = tuple[date, int]


def get_volume_series(
    session: Session,
    symbol: str,
    end_date: date,
    lookback_days: int,
) -> list[VolumePoint]:
    source = config.get_price_source()
    rows = session.execute(
        select(DailyPrice.date, DailyPrice.volume)
        .join(Ticker, Ticker.id == DailyPrice.ticker_id)
        .where(
            Ticker.symbol == symbol,
            DailyPrice.source == source,
            DailyPrice.date <= end_date,
            DailyPrice.volume.is_not(None),
        )
        .order_by(DailyPrice.date.desc())
        .limit(lookback_days)
    ).all()

    series = [(row.date, int(row.volume)) for row in rows if row.volume is not None]
    series.reverse()
    return series


def compute_volume_spike(
    volume_series: list[VolumePoint],
    asof_date: date,
    avg_window: int = 20,
) -> dict[str, object] | None:
    if avg_window <= 0:
        return None
    if not volume_series:
        return None

    series = sorted(volume_series, key=lambda item: item[0])
    asof_index = None
    for idx, (day, _) in enumerate(series):
        if day <= asof_date:
            asof_index = idx
        else:
            break

    if asof_index is None:
        return None

    asof_day, asof_volume = series[asof_index]
    prior = series[:asof_index]
    if len(prior) < avg_window:
        return None

    window = prior[-avg_window:]
    volumes = [volume for _, volume in window]
    if len(volumes) < avg_window:
        return None

    avg_volume = sum(volumes) / avg_window
    if avg_volume <= 0:
        return None

    spike_ratio = asof_volume / avg_volume
    return {
        "asof_date": asof_day,
        "volume": int(asof_volume),
        "avg_volume_20d": float(avg_volume),
        "spike_ratio": float(spike_ratio),
    }
