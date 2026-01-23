"""Simple in-memory TTL cache."""

from __future__ import annotations

import time
from typing import Any


class TTLCache:
    """Tiny TTL cache for short-lived API responses."""

    def __init__(self, ttl_seconds: int):
        if ttl_seconds <= 0:
            raise ValueError("ttl_seconds must be positive.")
        self._ttl_seconds = ttl_seconds
        self._items: dict[str, tuple[float, Any]] = {}

    def get(self, key: str) -> Any | None:
        entry = self._items.get(key)
        if not entry:
            return None
        expires_at, value = entry
        if time.time() > expires_at:
            self._items.pop(key, None)
            return None
        return value

    def set(self, key: str, value: Any) -> None:
        self._items[key] = (time.time() + self._ttl_seconds, value)
