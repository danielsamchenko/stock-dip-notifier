export type DipRow = {
  symbol: string;
  date: string;
  rule: string;
  value: number | null;
  created_at: string | null;
};

export type AlertRow = {
  symbol: string;
  date: string;
  rule: string;
  magnitude: number | null;
  threshold: number | null;
  details: Record<string, unknown> | null;
  created_at: string | null;
};

export type PriceRow = {
  symbol: string;
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  source: string | null;
};

export type TickerDetail = {
  symbol: string;
  name: string | null;
  active: boolean | null;
  latest_price: PriceRow | null;
  recent_signals: DipRow[];
  recent_alerts: AlertRow[];
};
