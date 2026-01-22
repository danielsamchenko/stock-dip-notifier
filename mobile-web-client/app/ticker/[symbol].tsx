import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { LineChart } from "../../src/components/LineChart";
import { buildWsUrl, getIntradayChart, getTicker } from "../../src/lib/api";
import { IntradayBar, TickerDetail } from "../../src/types";

const TIME_RANGES = ["1D", "1W", "1M", "1Y", "ALL"] as const;
const MAX_BARS = 500;
const DEFAULT_LOOKBACK_MINUTES = 390;

export default function TickerScreen() {
  const params = useLocalSearchParams();
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState<boolean>(systemScheme === "dark");
  const [selectedRange, setSelectedRange] = useState<(typeof TIME_RANGES)[number]>("1D");
  const [detail, setDetail] = useState<TickerDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [chartBars, setChartBars] = useState<IntradayBar[]>([]);
  const [chartError, setChartError] = useState<string | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartReload, setChartReload] = useState(0);
  const [liveStatus, setLiveStatus] = useState<"online" | "offline">("offline");
  const theme = isDark ? darkTheme : lightTheme;

  const symbol = parseStringParam(params.symbol) ?? "—";

  useEffect(() => {
    if (!symbol || symbol === "—") {
      return;
    }
    let isMounted = true;
    setDetailError(null);
    getTicker(symbol)
      .then((data) => {
        if (isMounted) {
          setDetail(data);
        }
      })
      .catch((err) => {
        if (!isMounted) {
          return;
        }
        const message = err instanceof Error ? err.message : "Failed to load ticker";
        setDetailError(message);
      });

    return () => {
      isMounted = false;
    };
  }, [symbol]);

  useEffect(() => {
    if (!symbol || symbol === "—" || selectedRange !== "1D") {
      return;
    }
    let isMounted = true;
    setChartError(null);
    setChartLoading(true);
    getIntradayChart(symbol, DEFAULT_LOOKBACK_MINUTES)
      .then((data) => {
        if (isMounted) {
          setChartBars(data.bars);
        }
      })
      .catch((err) => {
        if (!isMounted) {
          return;
        }
        const message = err instanceof Error ? err.message : "Failed to load chart";
        setChartError(message);
      })
      .finally(() => {
        if (isMounted) {
          setChartLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [symbol, selectedRange, chartReload]);

  useEffect(() => {
    if (!symbol || symbol === "—" || selectedRange !== "1D") {
      setLiveStatus("offline");
      return;
    }

    const wsUrl = buildWsUrl(`/ws/chart/intraday/${symbol}`);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => setLiveStatus("online");
    ws.onerror = () => setLiveStatus("offline");
    ws.onclose = () => setLiveStatus("offline");

    ws.onmessage = (event) => {
      const parsed = safeJsonParse(event.data);
      const messages = Array.isArray(parsed) ? parsed : [parsed];
      for (const message of messages) {
        if (!message || typeof message !== "object") {
          continue;
        }
        const bar = extractBar(message as Record<string, unknown>);
        if (!bar) {
          continue;
        }
        setChartBars((prev) => upsertBar(prev, bar));
      }
    };

    return () => {
      ws.close();
    };
  }, [symbol, selectedRange]);

  const companyName = detail?.name?.trim();
  const headerName = companyName ? companyName : "Name not available yet";

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <ScrollView
        contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </Pressable>
          <Pressable
            style={[styles.toggleButton, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => setIsDark((prev) => !prev)}
          >
            <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={18} color={theme.text} />
          </Pressable>
        </View>

        <View style={styles.headerBlock}>
          <Text style={[styles.tickerText, { color: theme.text }]}>{symbol}</Text>
          <Text style={[styles.companyText, { color: theme.muted }]}>{headerName}</Text>
          {detailError ? (
            <Text style={[styles.errorText, { color: theme.error }]}>{detailError}</Text>
          ) : null}
        </View>

        <View style={styles.rangeRow}>
          {TIME_RANGES.map((range) => {
            const active = range === selectedRange;
            return (
              <Pressable
                key={range}
                style={[
                  styles.rangeButton,
                  {
                    backgroundColor: active ? theme.text : theme.card,
                    borderColor: theme.border,
                  },
                ]}
                onPress={() => setSelectedRange(range)}
              >
                <Text style={[styles.rangeText, { color: active ? theme.background : theme.text }]}>
                  {range}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {selectedRange !== "1D" ? (
            <View style={styles.chartPlaceholder}>
              <Text style={[styles.chartTitle, { color: theme.text }]}>Coming soon</Text>
              <Text style={[styles.chartSubtitle, { color: theme.muted }]}
              >
                Intraday chart only for now.
              </Text>
            </View>
          ) : (
            <View style={styles.chartContent}>
              <View style={styles.chartHeaderRow}>
                <Text style={[styles.chartTitle, { color: theme.text }]}>Intraday</Text>
                <Text
                  style={[
                    styles.liveStatus,
                    { color: liveStatus === "online" ? theme.accent : theme.muted },
                  ]}
                >
                  {liveStatus === "online" ? "Live" : "Live: offline"}
                </Text>
              </View>
              {chartError ? (
                <View style={styles.chartPlaceholder}>
                  <Text style={[styles.chartSubtitle, { color: theme.error }]}>{chartError}</Text>
                  <Pressable
                    style={[styles.retryButton, { borderColor: theme.border }]}
                    onPress={() => setChartReload((prev) => prev + 1)}
                  >
                    <Text style={[styles.retryText, { color: theme.text }]}>Retry</Text>
                  </Pressable>
                </View>
              ) : chartLoading ? (
                <Text style={[styles.chartSubtitle, { color: theme.muted }]}>Loading chart…</Text>
              ) : (
                <LineChart
                  data={chartBars.map((bar) => ({ t: bar.t, c: bar.c }))}
                  stroke={theme.accent}
                  textColor={theme.text}
                />
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function parseStringParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function parseNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractBar(message: Record<string, unknown>): IntradayBar | null {
  if (message.type !== "bar" || typeof message.bar !== "object" || !message.bar) {
    return null;
  }
  const bar = message.bar as Record<string, unknown>;
  const t = parseNumber(bar.t);
  const o = parseNumber(bar.o);
  const h = parseNumber(bar.h);
  const l = parseNumber(bar.l);
  const c = parseNumber(bar.c);
  const v = parseNumber(bar.v);
  if (t === null || o === null || h === null || l === null || c === null || v === null) {
    return null;
  }
  return { t: Math.round(t), o, h, l, c, v };
}

function upsertBar(bars: IntradayBar[], nextBar: IntradayBar): IntradayBar[] {
  if (!bars.length) {
    return [nextBar];
  }
  const last = bars[bars.length - 1];
  if (last.t === nextBar.t) {
    return [...bars.slice(0, -1), nextBar];
  }
  const updated = [...bars, nextBar];
  if (updated.length > MAX_BARS) {
    return updated.slice(updated.length - MAX_BARS);
  }
  return updated;
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

type Theme = {
  background: string;
  card: string;
  text: string;
  muted: string;
  mutedLight: string;
  border: string;
  accent: string;
  accentText: string;
  error: string;
};

const lightTheme: Theme = {
  background: "#ffffff",
  card: "#ffffff",
  text: "#111827",
  muted: "#6b7280",
  mutedLight: "#9ca3af",
  border: "#e5e7eb",
  accent: "#111827",
  accentText: "#ffffff",
  error: "#b91c1c",
};

const darkTheme: Theme = {
  background: "#000000",
  card: "#0b0b0b",
  text: "#f9fafb",
  muted: "#9ca3af",
  mutedLight: "#6b7280",
  border: "#1f1f1f",
  accent: "#22c55e",
  accentText: "#111827",
  error: "#f87171",
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    padding: 16,
    backgroundColor: "#fff",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backButton: {
    padding: 6,
  },
  toggleButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBlock: {
    marginBottom: 16,
  },
  tickerText: {
    fontSize: 32,
    fontWeight: "700",
  },
  companyText: {
    fontSize: 14,
    marginTop: 4,
  },
  errorText: {
    marginTop: 8,
    fontSize: 12,
  },
  rangeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  rangeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  rangeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  chartCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  chartContent: {
    gap: 12,
  },
  chartHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  chartSubtitle: {
    fontSize: 12,
    textAlign: "center",
  },
  chartPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  liveStatus: {
    fontSize: 12,
    fontWeight: "600",
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  retryText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
