"""API endpoint to refresh data by running ingest + analyze."""

from __future__ import annotations

from datetime import date
import threading

from fastapi import APIRouter, HTTPException, Query, status

from dipdetector.analyze.run import analyze
from dipdetector.ingest.ingest_prices import ingest_prices

router = APIRouter()

_refresh_lock = threading.Lock()


@router.post("/refresh")
def refresh(days: int = Query(30, ge=1, le=3650)) -> dict[str, str | int]:
    if not _refresh_lock.acquire(blocking=False):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Refresh already running.",
        )
    try:
        ingest_prices(days=days)
        asof_date = date.today()
        analyze(asof_date)
        return {"status": "ok", "days": days, "asof": asof_date.isoformat()}
    finally:
        _refresh_lock.release()
