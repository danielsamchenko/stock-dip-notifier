"""Run dip analysis and generate alerts."""

from __future__ import annotations

import argparse
import logging
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from dipdetector import config
from dipdetector.analyze import rules
from dipdetector.db.models import Alert, DailyPrice, Signal, Ticker
from dipdetector.db.session import get_session
from dipdetector.utils.logging import configure_logging

logger = logging.getLogger(__name__)


def _load_prices(
    session: Session,
    ticker_id: int,
    source: str,
    asof_date: date,
    limit: int,
) -> list[tuple[date, float]]:
    rows = session.execute(
        select(DailyPrice.date, DailyPrice.close)
        .where(
            DailyPrice.ticker_id == ticker_id,
            DailyPrice.source == source,
            DailyPrice.date <= asof_date,
        )
        .order_by(DailyPrice.date.desc())
        .limit(limit)
    ).all()

    prices = [(row.date, float(row.close)) for row in rows]
    prices.reverse()
    return prices


def _upsert_signal(
    session: Session,
    ticker_id: int,
    asof_date: date,
    rule: str,
    value: float,
) -> bool:
    existing = session.execute(
        select(Signal).where(
            Signal.ticker_id == ticker_id,
            Signal.date == asof_date,
            Signal.rule == rule,
        )
    ).scalar_one_or_none()

    if existing:
        existing.value = value
        return False

    session.add(
        Signal(
            ticker_id=ticker_id,
            date=asof_date,
            rule=rule,
            value=value,
        )
    )
    return True


def _upsert_alert(
    session: Session,
    ticker_id: int,
    asof_date: date,
    rule: str,
    magnitude: float,
    threshold: float,
    details: dict[str, object] | None,
) -> bool:
    existing = session.execute(
        select(Alert).where(
            Alert.ticker_id == ticker_id,
            Alert.date == asof_date,
            Alert.rule == rule,
        )
    ).scalar_one_or_none()

    if existing:
        existing.magnitude = magnitude
        existing.threshold = threshold
        existing.details_json = details
        return False

    session.add(
        Alert(
            ticker_id=ticker_id,
            date=asof_date,
            rule=rule,
            magnitude=magnitude,
            threshold=threshold,
            details_json=details,
        )
    )
    return True


def analyze(
    asof_date: date,
    session_factory=get_session,
    price_source: str | None = None,
) -> None:
    source = price_source or config.get_price_source()
    dip_1d_threshold = config.get_dip_1d_threshold()
    dip_nday_window = config.get_dip_nday_window()
    dip_nday_threshold = config.get_dip_nday_threshold()
    dip_52w_window = config.get_dip_52w_window()
    dip_52w_threshold = config.get_dip_52w_threshold()

    lookback = max(dip_nday_window, dip_52w_window) + 1

    with session_factory() as session:
        tickers = (
            session.execute(select(Ticker).where(Ticker.active.is_(True))).scalars().all()
        )

    for ticker in tickers:
        with session_factory() as session:
            prices = _load_prices(session, ticker.id, source, asof_date, lookback)
            if not prices:
                logger.info("Ticker %s: no price data", ticker.symbol)
                continue

            signal_values: dict[str, float] = {}
            alerts_triggered = 0

            value_1d = rules.compute_1d_drop(prices, asof_date)
            if value_1d is not None:
                signal_values["drop_1d"] = value_1d
                _upsert_signal(session, ticker.id, asof_date, "drop_1d", value_1d)
                if value_1d <= dip_1d_threshold:
                    details = rules.get_prev_close_details(prices, asof_date)
                    if details is not None:
                        details["threshold"] = dip_1d_threshold
                    _upsert_alert(
                        session,
                        ticker.id,
                        asof_date,
                        "drop_1d",
                        value_1d,
                        dip_1d_threshold,
                        details,
                    )
                    alerts_triggered += 1

            drawdown_20 = rules.compute_drawdown(prices, asof_date, dip_nday_window)
            if drawdown_20 is not None:
                value, details = drawdown_20
                signal_values[f"drawdown_{dip_nday_window}d"] = value
                _upsert_signal(
                    session,
                    ticker.id,
                    asof_date,
                    f"drawdown_{dip_nday_window}d",
                    value,
                )
                if value <= dip_nday_threshold:
                    details["threshold"] = dip_nday_threshold
                    _upsert_alert(
                        session,
                        ticker.id,
                        asof_date,
                        f"drawdown_{dip_nday_window}d",
                        value,
                        dip_nday_threshold,
                        details,
                    )
                    alerts_triggered += 1

            drawdown_52w = rules.compute_drawdown(prices, asof_date, dip_52w_window)
            if drawdown_52w is not None:
                value, details = drawdown_52w
                signal_values[f"drawdown_{dip_52w_window}d"] = value
                _upsert_signal(
                    session,
                    ticker.id,
                    asof_date,
                    f"drawdown_{dip_52w_window}d",
                    value,
                )
                if value <= dip_52w_threshold:
                    details["threshold"] = dip_52w_threshold
                    _upsert_alert(
                        session,
                        ticker.id,
                        asof_date,
                        f"drawdown_{dip_52w_window}d",
                        value,
                        dip_52w_threshold,
                        details,
                    )
                    alerts_triggered += 1

            logger.info(
                "Ticker %s: signals %s, alerts triggered %d",
                ticker.symbol,
                signal_values,
                alerts_triggered,
            )


def _parse_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError("--asof must be YYYY-MM-DD") from exc


def main() -> None:
    parser = argparse.ArgumentParser(description="Run dip analysis and alerts.")
    parser.add_argument("--asof", type=str, help="As-of date (YYYY-MM-DD)")
    args = parser.parse_args()

    configure_logging(config.get_log_level())
    asof_date = _parse_date(args.asof) if args.asof else date.today()
    analyze(asof_date)


if __name__ == "__main__":
    main()
