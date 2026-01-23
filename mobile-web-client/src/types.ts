export type DipRow = {
  symbol: string;
  date: string;
  rule: string;
  value: number | null;
  created_at: string | null;
};

export type CurrentDipRow = {
  symbol: string;
  date: string;
  dip: number | null;
  window_days: number | null;
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

export type IntradayBar = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

export type IntradayChartResponse = {
  symbol: string;
  timespan: string;
  bars: IntradayBar[];
};

export type OverviewSource = {
  title: string | null;
  publisher: string | null;
  published_utc: string | null;
  url: string | null;
};

export type OverviewResponse = {
  symbol: string;
  asof: string;
  overview: string;
  drivers?: Record<string, number> | null;
  key_factors: string[];
  sources: OverviewSource[];
};
