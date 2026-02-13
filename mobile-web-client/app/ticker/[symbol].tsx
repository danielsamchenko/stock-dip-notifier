import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  Image,
  Platform,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { RecoveryTimeline } from "../../src/components/RecoveryTimeline";
import { ChartCard } from "./components/ChartCard";
import { DriversCard } from "./components/DriversCard";
import { OverviewCard } from "./components/OverviewCard";
import { RecoveryCard } from "./components/RecoveryCard";
import { Theme } from "./components/theme";
import {
  buildWsUrl,
  getDailyChart,
  getIntradayChart,
  getOverview,
  getTicker,
} from "../../src/lib/api";
import { getLogoUrl } from "../../src/lib/logos";
import { getMockDrivers } from "../../src/lib/mockDrivers";
import { getMockRecovery } from "../../src/lib/mockRecovery";
import { IntradayBar, OverviewResponse, TickerDetail } from "../../src/types";

const TIME_RANGES = ["DIP", "1D", "1W", "1M", "1Y", "ALL"] as const;
const MAX_BARS = 500;
const DEFAULT_LOOKBACK_MINUTES = 390;

export default function TickerScreen() {
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isWide = width >= 820;
  const [selectedRange, setSelectedRange] = useState<(typeof TIME_RANGES)[number]>("DIP");
  const [detail, setDetail] = useState<TickerDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [chartBars, setChartBars] = useState<IntradayBar[]>([]);
  const [chartError, setChartError] = useState<string | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartReload, setChartReload] = useState(0);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewReload, setOverviewReload] = useState(0);
  const [comment, setComment] = useState("");
  const theme = darkTheme;

  const symbol = parseStringParam(params.symbol) ?? "—";
  const dipValue = parseNumber(params.dip);
  const dipDays = parseNumber(params.window_days);
  const dipWindowDays = dipDays && dipDays > 0 ? Math.round(dipDays) : null;
  const currency = guessCurrency(symbol);
  const changeLabel = getChangeLabel(selectedRange);
  const dailyLookbackDays = getDailyLookbackDays(selectedRange, dipWindowDays);
  const dailyTimespan = getDailyTimespan(selectedRange);
  const dailyMultiplier = getDailyMultiplier(selectedRange);
  const chartLabelMode = getChartLabelMode(selectedRange);

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
    if (!symbol || symbol === "—") {
      return;
    }
    let isMounted = true;
    setChartError(null);
    setChartLoading(true);
    const promise =
      selectedRange === "1D"
        ? getIntradayChart(symbol, DEFAULT_LOOKBACK_MINUTES)
        : getDailyChart(symbol, dailyLookbackDays, dailyTimespan, dailyMultiplier);

    promise
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
  }, [symbol, selectedRange, chartReload, dailyLookbackDays, dailyTimespan, dailyMultiplier]);

  useEffect(() => {
    if (!symbol || symbol === "—" || selectedRange !== "1D") {
      return;
    }

    const wsUrl = buildWsUrl(`/ws/chart/intraday/${symbol}`);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {};
    ws.onerror = () => {};
    ws.onclose = () => {};

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

  useEffect(() => {
    if (!symbol || symbol === "—") {
      return;
    }
    let isMounted = true;
    setOverviewError(null);
    setOverviewLoading(true);
    getOverview(symbol)
      .then((data) => {
        if (isMounted) {
          setOverview(data);
        }
      })
      .catch((err) => {
        if (!isMounted) {
          return;
        }
        const message = err instanceof Error ? err.message : "Failed to load overview";
        setOverviewError(message);
      })
      .finally(() => {
        if (isMounted) {
          setOverviewLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [symbol, overviewReload]);

  const companyName = detail?.name?.trim();
  const headerName = companyName ? companyName : "Name not available yet";
  const lastBar = chartBars.length ? chartBars[chartBars.length - 1] : null;
  const firstBar = chartBars.length ? chartBars[0] : null;
  const changeInfo = buildChangeInfo(firstBar?.c, lastBar?.c, changeLabel);
  const chartStroke = changeInfo && changeInfo.delta < 0 ? theme.negative : theme.accent;
  const chartFill =
    changeInfo && changeInfo.delta < 0
      ? theme.negative
      : changeInfo && changeInfo.delta > 0
        ? theme.positive
        : undefined;
  const dipInfo = formatDipParts(dipValue, dipDays);
  const dipColor =
    dipInfo && dipInfo.value >= 0 ? theme.positive : dipInfo ? theme.negative : theme.muted;
  const driverData = getMockDrivers(symbol);
  const recovery = getMockRecovery(symbol);
  const plotSize = isWide ? 200 : Math.min(260, width - 64);
  const cardWidth = isWide ? (width - 48) / 2 : width - 32;
  const dialBase = isWide ? 200 : Math.min(260, width - 64);
  const dialSize = Math.min(dialBase * 2, cardWidth - 32);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <Pressable style={styles.backButton} onPress={() => router.replace("/")}>
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </Pressable>
        </View>

        <View style={styles.headerBlock}>
          <View style={styles.headerRow}>
            <Logo symbol={symbol} theme={theme} />
            <View style={styles.headerTextBlock}>
              <View style={styles.tickerRow}>
                <Text style={[styles.tickerText, { color: theme.text }]}>{symbol}</Text>
                {dipInfo ? (
                  <View style={styles.dipBadge}>
                    <Text style={[styles.dipPercent, { color: dipColor }]}>
                      {dipInfo.percentText}
                    </Text>
                    <Text style={[styles.dipDays, { color: theme.muted }]}>
                      {dipInfo.daysText}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.companyText, { color: theme.muted }]}>{headerName}</Text>
              {detailError ? (
                <Text style={[styles.errorText, { color: theme.error }]}>{detailError}</Text>
              ) : null}
            </View>
          </View>
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

        <ChartCard
          theme={theme}
          currency={currency}
          lastBar={lastBar}
          changeInfo={changeInfo}
          chartBars={chartBars}
          chartError={chartError}
          chartLoading={chartLoading}
          chartLabelMode={chartLabelMode}
          chartStroke={chartStroke}
          chartFill={chartFill}
          onRetry={() => setChartReload((prev) => prev + 1)}
        />

        <OverviewCard
          theme={theme}
          overview={overview}
          loading={overviewLoading}
          error={overviewError}
          onRetry={() => setOverviewReload((prev) => prev + 1)}
        />

        <View style={[styles.dualRow, { flexDirection: isWide ? "row" : "column" }]}>
          <DriversCard
            theme={theme}
            driverData={driverData}
            plotSize={plotSize}
            style={isWide ? styles.dualCardFlex : undefined}
          />
          <RecoveryCard
            theme={theme}
            recovery={recovery}
            dialSize={dialSize}
            style={isWide ? styles.dualCardFlex : undefined}
          />
        </View>

        <RecoveryTimeline symbol={symbol} theme={theme} />

        <View style={[styles.commentCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Add comment…"
            placeholderTextColor={theme.muted}
            selectionColor={theme.muted}
            style={[styles.commentInput, { color: theme.text }]}
          />
          <Pressable
            style={[
              styles.commentButton,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Post comment"
          >
            <Text style={[styles.commentButtonText, { color: theme.muted }]}>Comment</Text>
          </Pressable>
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
  if (value === null || value === undefined || value === "") {
    return null;
  }
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

function Logo({ symbol, theme }: { symbol: string; theme: Theme }) {
  const [failed, setFailed] = useState(false);
  const letter = symbol ? symbol[0] : "?";

  if (!symbol || failed) {
    return (
      <View
        style={[
          styles.logoContainer,
          styles.logoFallback,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.logoText, { color: theme.text }]}>{letter}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.logoContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Image
        source={{ uri: getLogoUrl(symbol) }}
        style={styles.logoImage}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
    </View>
  );
}

const darkTheme: Theme = {
  background: "#000000",
  card: "#0b0b0b",
  plotField: "#0b0b0b",
  text: "#f9fafb",
  muted: "#9ca3af",
  mutedLight: "#6b7280",
  border: "#1f1f1f",
  accent: "#22c55e",
  accentText: "#111827",
  error: "#f87171",
  positive: "#22c55e",
  negative: "#f87171",
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
  headerBlock: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerTextBlock: {
    flex: 1,
  },
  tickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tickerText: {
    fontSize: 32,
    fontWeight: "700",
  },
  dipBadge: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  dipPercent: {
    fontSize: 32,
    fontWeight: "700",
  },
  dipDays: {
    fontSize: 14,
    fontWeight: "500",
  },
  companyText: {
    fontSize: 14,
    marginTop: 4,
  },
  errorText: {
    marginTop: 8,
    fontSize: 12,
  },
  logoContainer: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoImage: {
    width: 40,
    height: 40,
  },
  logoFallback: {
    borderStyle: "dashed",
  },
  logoText: {
    fontSize: 18,
    fontWeight: "600",
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
  dualRow: {
    gap: 16,
    marginBottom: 24,
  },
  dualCardFlex: {
    flex: 1,
  },
  commentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 24,
  },
  commentInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 6,
    ...(Platform.OS === "web"
      ? {
          outlineStyle: "none",
          outlineWidth: 0,
        }
      : {}),
  },
  commentButton: {
    paddingHorizontal: 10,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  commentButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
});

function buildChangeInfo(
  start?: number,
  end?: number,
  label?: string,
): { text: string; delta: number } | null {
  if (start === undefined || end === undefined || start === 0) {
    return null;
  }
  const delta = end - start;
  const pct = (delta / start) * 100;
  const sign = delta >= 0 ? "+" : "";
  const text = `${sign}${delta.toFixed(2)} (${sign}${pct.toFixed(2)}%) ${label ?? ""}`.trim();
  return { text, delta };
}

function formatDipParts(
  value: number | null,
  days: number | null,
): { percentText: string; daysText: string; value: number } | null {
  if (value === null || days === null) {
    return null;
  }
  const sign = value >= 0 ? "+" : "";
  const roundedDays = Math.round(days);
  return {
    percentText: `${sign}${value.toFixed(2)}%`,
    daysText: `(${roundedDays}d)`,
    value,
  };
}

function getChangeLabel(range: (typeof TIME_RANGES)[number]): string {
  switch (range) {
    case "DIP":
      return "Dip window";
    case "1D":
      return "Today";
    case "1W":
      return "This week";
    case "1M":
      return "This month";
    case "1Y":
      return "This year";
    default:
      return "All time";
  }
}

function getDailyLookbackDays(
  range: (typeof TIME_RANGES)[number],
  dipDays: number | null,
): number {
  switch (range) {
    case "DIP":
      return dipDays ?? 14;
    case "1W":
      return 7;
    case "1M":
      return 30;
    case "1Y":
      return 365;
    case "ALL":
      return 1825;
    default:
      return 7;
  }
}

function getDailyTimespan(range: (typeof TIME_RANGES)[number]): "minute" | "hour" | "day" {
  switch (range) {
    case "DIP":
      return "minute";
    case "1W":
      return "minute";
    case "1M":
      return "hour";
    default:
      return "day";
  }
}

function getDailyMultiplier(range: (typeof TIME_RANGES)[number]): number {
  switch (range) {
    case "1W":
      return 5;
    default:
      return 1;
  }
}

function getChartLabelMode(
  range: (typeof TIME_RANGES)[number],
): "time" | "date" | "monthYear" | "none" {
  switch (range) {
    case "DIP":
      return "date";
    case "1D":
      return "none";
    case "1W":
    case "1M":
      return "date";
    default:
      return "monthYear";
  }
}

function guessCurrency(symbol: string): string {
  const upper = symbol.toUpperCase();
  if (upper.endsWith(".TO") || upper.endsWith(".V")) {
    return "CAD";
  }
  if (upper.endsWith(".L")) {
    return "GBP";
  }
  if (upper.endsWith(".AS")) {
    return "EUR";
  }
  if (upper.endsWith(".SW")) {
    return "CHF";
  }
  if (upper.endsWith(".T")) {
    return "JPY";
  }
  return "USD";
}
