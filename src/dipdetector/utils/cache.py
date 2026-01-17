"""Small in-memory TTL cache for lightweight API lookups."""

from __future__ import annotations

from collections.abc import Callable
import time
from typing import Generic, TypeVar

T = TypeVar("T")


class TTLCache(Generic[T]):
    def __init__(self, ttl_seconds: int = 6 * 60 * 60, now_fn: Callable[[], float] | None = None):
        self._ttl_seconds = max(ttl_seconds, 0)
        self._now_fn = now_fn or time.monotonic
        self._store: dict[str, tuple[float, T]] = {}

    def get(self, key: str) -> T | None:
        entry = self._store.get(key)
        if not entry:
            return None
        expires_at, value = entry
        if self._now_fn() >= expires_at:
            self._store.pop(key, None)
            return None
        return value

    def set(self, key: str, value: T) -> None:
        expires_at = self._now_fn() + self._ttl_seconds
        self._store[key] = (expires_at, value)

    def clear(self) -> None:
        self._store.clear()
