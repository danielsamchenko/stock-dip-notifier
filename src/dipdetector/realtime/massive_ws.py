"""Massive WebSocket fanout for intraday bars."""

from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from typing import Any

import websockets

from dipdetector import config

logger = logging.getLogger(__name__)


class MassiveWSFanout:
    def __init__(self, api_key: str, ws_url: str):
        if not api_key:
            raise ValueError("MASSIVE_API_KEY is required to stream live bars.")
        self._api_key = api_key
        self._ws_url = ws_url
        self._ws: websockets.WebSocketClientProtocol | None = None
        self._runner_task: asyncio.Task[None] | None = None
        self._lock = asyncio.Lock()
        self._connected_event = asyncio.Event()
        self._active_symbols: set[str] = set()
        self._subscribers: dict[str, set[Any]] = defaultdict(set)

    async def ensure_connected(self) -> None:
        async with self._lock:
            if self._runner_task and not self._runner_task.done():
                return
            self._runner_task = asyncio.create_task(self._run())

    async def register_client(self, symbol: str, ws: Any) -> None:
        symbol = symbol.upper()
        await self.ensure_connected()
        async with self._lock:
            subscribers = self._subscribers[symbol]
            new_symbol = not subscribers
            subscribers.add(ws)
            if new_symbol:
                self._active_symbols.add(symbol)
        if new_symbol:
            await self._subscribe_symbols({symbol})

    async def unregister_client(self, symbol: str, ws: Any) -> None:
        symbol = symbol.upper()
        async with self._lock:
            subscribers = self._subscribers.get(symbol)
            if not subscribers:
                return
            subscribers.discard(ws)
            if subscribers:
                return
            self._subscribers.pop(symbol, None)
            self._active_symbols.discard(symbol)
        await self._unsubscribe_symbols({symbol})

    async def _run(self) -> None:
        backoffs = [0.5, 1.5, 3.0]
        attempt = 0
        while True:
            self._connected_event.clear()
            try:
                await self._connect_once()
                attempt = 0
            except Exception as exc:  # pragma: no cover - best effort reconnect
                logger.warning("Massive WS connection error: %s", exc)
            delay = backoffs[min(attempt, len(backoffs) - 1)]
            attempt += 1
            await asyncio.sleep(delay)

    async def _connect_once(self) -> None:
        async with websockets.connect(self._ws_url, ping_interval=20, ping_timeout=20) as ws:
            self._ws = ws
            await self._send_json({"action": "auth", "params": self._api_key})
            await self._wait_for_auth()
            await self._subscribe_symbols(self._active_symbols.copy())
            await self._listen()

    async def _wait_for_auth(self) -> None:
        try:
            await asyncio.wait_for(self._connected_event.wait(), timeout=5)
        except asyncio.TimeoutError as exc:
            raise RuntimeError("Massive WS auth timeout") from exc

    async def _listen(self) -> None:
        if not self._ws:
            return
        async for raw in self._ws:
            for message in _parse_messages(raw):
                if _is_auth_success(message):
                    self._connected_event.set()
                    continue
                if _is_auth_failed(message):
                    raise RuntimeError("Massive WS auth failed")
                bar = _parse_bar(message)
                if bar is None:
                    continue
                symbol = message.get("sym")
                if not symbol:
                    continue
                await self._forward(symbol, bar)

    async def _forward(self, symbol: str, bar: dict[str, float | int]) -> None:
        payload = {"type": "bar", "bar": bar}
        subscribers = list(self._subscribers.get(symbol, set()))
        if not subscribers:
            return
        dead: list[Any] = []
        for ws in subscribers:
            try:
                await ws.send_text(json.dumps(payload))
            except Exception:
                dead.append(ws)
        if dead:
            await self._cleanup_dead(symbol, dead)

    async def _cleanup_dead(self, symbol: str, dead: list[Any]) -> None:
        async with self._lock:
            subscribers = self._subscribers.get(symbol)
            if not subscribers:
                return
            for ws in dead:
                subscribers.discard(ws)
            if subscribers:
                return
            self._subscribers.pop(symbol, None)
            self._active_symbols.discard(symbol)

    async def _subscribe_symbols(self, symbols: set[str]) -> None:
        if not symbols:
            return
        await self._send_json({"action": "subscribe", "params": ",".join(_as_params(symbols))})

    async def _unsubscribe_symbols(self, symbols: set[str]) -> None:
        if not symbols:
            return
        await self._send_json({"action": "unsubscribe", "params": ",".join(_as_params(symbols))})

    async def _send_json(self, payload: dict[str, Any]) -> None:
        if not self._ws:
            return
        await self._ws.send(json.dumps(payload))


def _as_params(symbols: set[str]) -> list[str]:
    return [f"AM.{symbol}" for symbol in sorted(symbols)]


def _parse_messages(raw: str) -> list[dict[str, Any]]:
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if isinstance(parsed, list):
        return [msg for msg in parsed if isinstance(msg, dict)]
    if isinstance(parsed, dict):
        return [parsed]
    return []


def _is_auth_success(message: dict[str, Any]) -> bool:
    if message.get("ev") != "status":
        return False
    status = str(message.get("status", "")).lower()
    return "auth" in status and "fail" not in status


def _is_auth_failed(message: dict[str, Any]) -> bool:
    if message.get("ev") != "status":
        return False
    status = str(message.get("status", "")).lower()
    return "auth" in status and "fail" in status


def _parse_bar(message: dict[str, Any]) -> dict[str, float | int] | None:
    if message.get("ev") != "AM":
        return None
    t = message.get("t")
    o = message.get("o")
    h = message.get("h")
    l = message.get("l")
    c = message.get("c")
    v = message.get("v")
    if t is None or o is None or h is None or l is None or c is None:
        return None
    return {
        "t": int(t),
        "o": float(o),
        "h": float(h),
        "l": float(l),
        "c": float(c),
        "v": float(v) if v is not None else 0.0,
    }


def get_fanout() -> MassiveWSFanout:
    return MassiveWSFanout(config.get_massive_api_key(), config.get_massive_ws_url())
