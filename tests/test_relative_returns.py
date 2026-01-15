from __future__ import annotations

from datetime import date

from dipdetector.market.returns import compute_return_pct


def test_compute_return_pct_exact_dates():
    closes = [
        (date(2024, 1, 1), 100.0),
        (date(2024, 1, 2), 110.0),
        (date(2024, 1, 3), 105.0),
    ]
    value = compute_return_pct(closes, date(2024, 1, 1), date(2024, 1, 3))
    assert value == 5.0


def test_compute_return_pct_nearest_days():
    closes = [
        (date(2024, 1, 1), 100.0),
        (date(2024, 1, 2), 102.0),
        (date(2024, 1, 5), 104.0),
    ]
    value = compute_return_pct(closes, date(2024, 1, 3), date(2024, 1, 6))
    assert value == 0.0

    value = compute_return_pct(closes, date(2024, 1, 1), date(2024, 1, 4))
    assert value == 2.0


def test_compute_return_pct_missing_window():
    closes = [
        (date(2024, 1, 1), 100.0),
        (date(2024, 1, 2), 102.0),
    ]
    value = compute_return_pct(closes, date(2024, 1, 10), date(2024, 1, 11))
    assert value is None
