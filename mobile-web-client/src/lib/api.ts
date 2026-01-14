import { API_BASE_URL } from "./config";
import { AlertRow, DipRow, PriceRow, TickerDetail } from "../types";

const REQUEST_TIMEOUT_MS = 8000;

function parseNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }

    return (await response.json()) as T;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function toDipRow(item: Record<string, unknown>): DipRow {
  return {
    symbol: String(item.symbol ?? ""),
    date: String(item.date ?? ""),
    rule: String(item.rule ?? ""),
    value: parseNumber(item.value),
    created_at: item.created_at ? String(item.created_at) : null,
  };
}

function toAlertRow(item: Record<string, unknown>): AlertRow {
  return {
    symbol: String(item.symbol ?? ""),
    date: String(item.date ?? ""),
    rule: String(item.rule ?? ""),
    magnitude: parseNumber(item.magnitude),
    threshold: parseNumber(item.threshold),
    details: typeof item.details === "object" ? (item.details as Record<string, unknown>) : null,
    created_at: item.created_at ? String(item.created_at) : null,
  };
}

function toPriceRow(item: Record<string, unknown>): PriceRow {
  return {
    symbol: String(item.symbol ?? ""),
    date: String(item.date ?? ""),
    open: parseNumber(item.open),
    high: parseNumber(item.high),
    low: parseNumber(item.low),
    close: parseNumber(item.close),
    volume: parseNumber(item.volume),
    source: item.source ? String(item.source) : null,
  };
}

export async function getDips(rule: string, limit: number): Promise<DipRow[]> {
  const query = `rule=${encodeURIComponent(rule)}&limit=${limit}`;
  const data = await fetchJson<unknown[]>(`/dips?${query}`);

  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((item) => toDipRow(item as Record<string, unknown>));
}

export async function getTicker(symbol: string): Promise<TickerDetail> {
  const data = await fetchJson<Record<string, unknown>>(`/tickers/${symbol}`);

  return {
    symbol: String(data.symbol ?? symbol),
    name: data.name ? String(data.name) : null,
    active: data.active === undefined ? null : Boolean(data.active),
    latest_price:
      data.latest_price && typeof data.latest_price === "object"
        ? toPriceRow(data.latest_price as Record<string, unknown>)
        : null,
    recent_signals: Array.isArray(data.recent_signals)
      ? data.recent_signals.map((item) => toDipRow(item as Record<string, unknown>))
      : [],
    recent_alerts: Array.isArray(data.recent_alerts)
      ? data.recent_alerts.map((item) => toAlertRow(item as Record<string, unknown>))
      : [],
  };
}
