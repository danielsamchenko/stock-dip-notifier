from __future__ import annotations

from datetime import date

import pytest

from dipdetector.analyze import rules


def test_compute_1d_drop():
    prices = [
        (date(2024, 1, 1), 100.0),
        (date(2024, 1, 2), 90.0),
    ]

    value = rules.compute_1d_drop(prices, date(2024, 1, 2))
    assert value == pytest.approx(-10.0)


def test_compute_drawdown_with_details():
    prices = [
        (date(2024, 1, 1), 100.0),
        (date(2024, 1, 2), 105.0),
        (date(2024, 1, 3), 102.0),
        (date(2024, 1, 4), 98.0),
        (date(2024, 1, 5), 99.0),
    ]

    result = rules.compute_drawdown(prices, date(2024, 1, 5), window=3)
    assert result is not None
    value, details = result

    assert value == pytest.approx((99.0 - 102.0) / 102.0 * 100.0)
    assert details["window"] == 3
    assert details["rolling_max_date"] == "2024-01-03"
    assert details["rolling_max_close"] == 102.0
    assert details["asof_close"] == 99.0
