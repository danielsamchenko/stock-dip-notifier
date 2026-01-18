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
  market_symbol: string | null;
  sector_symbol: string | null;
  ticker_return_pct: number | null;
  spy_return_pct: number | null;
  sector_return_pct: number | null;
  relative_to_spy_pp: number | null;
  relative_to_sector_pp: number | null;
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

export type VolumeSpike = {
  asof_date: string;
  volume: number;
  avg_volume_20d: number;
  spike_ratio: number;
};

export type TickerDetail = {
  symbol: string;
  name: string | null;
  active: boolean | null;
  latest_price: PriceRow | null;
  recent_signals: DipRow[];
  recent_alerts: AlertRow[];
  volume_spike: VolumeSpike | null;
};

export type AnalystRecommendationResponse = {
  symbol: string;
  summary: string;
  strong_buy: number;
  buy: number;
  hold: number;
  sell: number;
  strong_sell: number;
  source: string | null;
};
