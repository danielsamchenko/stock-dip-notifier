import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  Image,
  Linking,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { LineChart } from "../../src/components/LineChart";
import { RecoveryDial } from "../../src/components/RecoveryDial";
import { RecoveryTimeline } from "../../src/components/RecoveryTimeline";
import { TernaryDriverPlot } from "../../src/components/TernaryDriverPlot";
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
  const [showDriversHelp, setShowDriversHelp] = useState(false);
  const theme = darkTheme;

  const symbol = parseStringParam(params.symbol) ?? "—";
  const dipValue = parseNumber(params.dip);
  const dipDays = parseNumber(params.window_days);
  const dipWindowDays = dipDays && dipDays > 0 ? Math.round(dipDays) : null;
  const currency = guessCurrency(symbol);
  const changeLabel = getChangeLabel(selectedRange);
  const dailyLookbackDays = getDailyLookbackDays(selectedRange, dipWindowDays);
  const dailyTimespan = getDailyTimespan(selectedRange);
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
        : getDailyChart(symbol, dailyLookbackDays, dailyTimespan);

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
  }, [symbol, selectedRange, chartReload, dailyLookbackDays, dailyTimespan]);

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
  const changeColor = changeInfo && changeInfo.delta < 0 ? theme.negative : theme.positive;
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
  const driverAccent = "#60a5fa";
  const plotSize = isWide ? 200 : Math.min(260, width - 64);
  const cardWidth = isWide ? (width - 48) / 2 : width - 32;
  const dialBase = isWide ? 200 : Math.min(260, width - 64);
  const dialSize = Math.min(dialBase * 2, cardWidth - 32);
  const overviewText = overview?.overview ?? "Overview unavailable right now.";
  const overviewFactors = overview?.key_factors ?? [];
  const overviewSources = overview?.sources ?? [];

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

        <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.chartContent}>
            <View style={styles.priceRow}>
              <View style={styles.priceLeft}>
                {lastBar ? (
                  <>
                    <Text style={[styles.priceText, { color: theme.text }]}>
                      {lastBar.c.toFixed(2)}
                    </Text>
                    <Text style={[styles.currencyText, { color: theme.muted }]}>
                      {currency}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.priceText, { color: theme.text }]}>—</Text>
                )}
              </View>
              {changeInfo ? (
                <Text style={[styles.changeText, { color: changeColor }]}>
                  {changeInfo.text}
                </Text>
              ) : null}
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
                stroke={chartStroke}
                textColor={theme.text}
                fillColor={chartFill}
                labelMode={chartLabelMode}
              />
            )}
          </View>
        </View>

        <View style={[styles.overviewCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Overview</Text>
          {overviewLoading ? (
            <Text style={[styles.chartSubtitle, { color: theme.muted }]}>Loading overview…</Text>
          ) : overviewError ? (
            <View style={styles.chartPlaceholder}>
              <Text style={[styles.chartSubtitle, { color: theme.error }]}>Overview unavailable</Text>
              <Pressable
                style={[styles.retryButton, { borderColor: theme.border }]}
                onPress={() => setOverviewReload((prev) => prev + 1)}
              >
                <Text style={[styles.retryText, { color: theme.text }]}>Retry</Text>
              </Pressable>
            </View>
          ) : overview ? (
            <>
              <Text style={[styles.overviewText, { color: theme.text }]}>{overviewText}</Text>
              {overviewFactors.length ? (
                <View style={styles.factorList}>
                  {overviewFactors.map((factor, index) => (
                    <Text
                      key={`${factor}-${index}`}
                      style={[styles.factorItem, { color: theme.text }]}
                    >
                      • {factor}
                    </Text>
                  ))}
                </View>
              ) : null}
              {overviewSources.length ? (
                <View style={styles.articleList}>
                  {overviewSources.map((source, index) => (
                    <Pressable
                      key={`${source.url ?? source.title ?? index}`}
                      style={styles.articleRow}
                      onPress={() => source.url && Linking.openURL(source.url)}
                    >
                      <Text
                        numberOfLines={1}
                        style={[styles.articleTitle, { color: theme.text }]}
                      >
                        {source.title ?? "Source"}
                      </Text>
                      <Text style={[styles.articleMeta, { color: theme.muted }]}>
                        {formatArticleMeta(source.publisher, source.published_utc)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <Text style={[styles.chartSubtitle, { color: theme.muted }]}>
              Overview unavailable right now.
            </Text>
          )}
        </View>

        <View style={[styles.dualRow, { flexDirection: isWide ? "row" : "column" }]}>
          <View
            style={[
              styles.dualCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                flex: isWide ? 1 : undefined,
              },
            ]}
          >
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                What's Driving the Dip?
              </Text>
              <View style={styles.helpWrap}>
                <Pressable
                  onPress={() => setShowDriversHelp((prev) => !prev)}
                  onHoverIn={() => setShowDriversHelp(true)}
                  onHoverOut={() => setShowDriversHelp(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Explain the drivers triangle"
                  style={styles.helpButton}
                >
                  <Ionicons name="help-circle-outline" size={22} color={theme.muted} />
                </Pressable>
                {showDriversHelp ? (
                  <View
                    style={[
                      styles.helpTooltip,
                      { backgroundColor: theme.background, borderColor: theme.border },
                    ]}
                  >
                    <Text style={[styles.helpTitle, { color: theme.text }]}>
                      What the triangle means
                    </Text>
                    <Text style={[styles.helpText, { color: theme.muted }]}>
                      This is a 3-way breakdown of what's likely behind the dip. The marker “leans”
                      toward the dominant driver.
                    </Text>
                    <Text style={[styles.helpText, { color: theme.muted }]}>
                      • <Text style={styles.helpStrong}>Market:</Text> index-level selling, rates,
                      macro headlines
                    </Text>
                    <Text style={[styles.helpText, { color: theme.muted }]}>
                      • <Text style={styles.helpStrong}>Industry:</Text> sector-wide moves, peer
                      sympathy, thematic rotation
                    </Text>
                    <Text style={[styles.helpText, { color: theme.muted }]}>
                      • <Text style={styles.helpStrong}>Company:</Text> earnings, guidance, news, or
                      firm-specific fundamentals
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={styles.driversColumn}>
              <View
                style={[
                  styles.driversPlotCard,
                  {
                    borderColor: theme.border,
                    alignSelf: "stretch",
                  },
                ]}
              >
                <TernaryDriverPlot
                  market={driverData.market}
                  industry={driverData.industry}
                  company={driverData.company}
                  confidence={driverData.confidence}
                  size={plotSize}
                  color={driverAccent}
                  textColor={theme.text}
                  borderColor={theme.border}
                  backgroundColor="transparent"
                />
              </View>
              <Text style={[styles.driversLabel, { color: theme.muted }]}>Driver Summary</Text>
              <Text style={[styles.driversSummary, { color: theme.text }]}>
                {driverData.summary}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.dualCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                flex: isWide ? 1 : undefined,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Recovery Outlook</Text>
            <View style={styles.recoveryBody}>
              <View style={styles.recoveryDialWrap}>
                <RecoveryDial
                  score={recovery.score}
                  size={dialSize}
                  textColor={theme.text}
                  trackColor={theme.border}
                  needleColor={theme.text}
                />
              </View>
              <Text style={[styles.recoveryScore, { color: theme.text }]}>
                Recovery Score: {recovery.score}/100
              </Text>
              <Text style={[styles.recoveryLabel, { color: theme.muted }]}>
                {recovery.label}
              </Text>
            </View>
          </View>
        </View>

        <RecoveryTimeline symbol={symbol} theme={theme} />
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

type Theme = {
  background: string;
  card: string;
  plotField: string;
  text: string;
  muted: string;
  mutedLight: string;
  border: string;
  accent: string;
  accentText: string;
  error: string;
  positive: string;
  negative: string;
};

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
  chartCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  chartContent: {
    gap: 12,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "flex-start",
    gap: 10,
  },
  priceLeft: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  priceText: {
    fontSize: 20,
    fontWeight: "700",
  },
  currencyText: {
    fontSize: 12,
    fontWeight: "400",
  },
  changeText: {
    fontSize: 13,
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
  overviewCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  dualRow: {
    gap: 16,
    marginBottom: 24,
  },
  dualCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  helpWrap: {
    position: "relative",
    alignItems: "flex-end",
  },
  helpButton: {
    padding: 4,
  },
  helpTooltip: {
    position: "absolute",
    top: 22,
    right: 0,
    width: 220,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 6,
  },
  helpTitle: {
    fontSize: 12,
    fontWeight: "700",
  },
  helpStrong: {
    fontWeight: "700",
  },
  helpText: {
    fontSize: 11,
    lineHeight: 14,
  },
  driversRow: {
    gap: 12,
    alignItems: "center",
  },
  driversColumn: {
    alignItems: "center",
    gap: 12,
    marginTop: 6,
  },
  driversPlotCard: {
    padding: 8,
    borderRadius: 12,
    alignItems: "center",
    paddingTop: 2,
  },
  driversLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    textAlign: "center",
    marginTop: 12,
  },
  driversSummary: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  recoveryBody: {
    alignItems: "center",
    gap: 10,
    flex: 1,
    justifyContent: "flex-start",
    marginTop: -18,
  },
  recoveryDialWrap: {
    marginTop: -64,
  },
  recoveryScore: {
    fontSize: 13,
    fontWeight: "600",
  },
  recoveryLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  overviewText: {
    fontSize: 13,
    lineHeight: 18,
  },
  factorList: {
    gap: 6,
  },
  factorItem: {
    fontSize: 12,
    lineHeight: 16,
  },
  articleList: {
    gap: 10,
  },
  articleRow: {
    gap: 2,
  },
  articleTitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  articleMeta: {
    fontSize: 12,
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

function formatArticleMeta(publisher: string | null, publishedUtc: string | null): string {
  const parts: string[] = [];
  if (publisher) {
    parts.push(publisher);
  }
  if (publishedUtc) {
    const label = formatRelativeTime(publishedUtc);
    if (label) {
      parts.push(label);
    }
  }
  return parts.join(" • ");
}

function formatRelativeTime(value: string): string | null {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }
  const diffMs = Date.now() - parsed;
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  return `${days}d ago`;
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

function getDailyTimespan(range: (typeof TIME_RANGES)[number]): "hour" | "day" {
  switch (range) {
    case "DIP":
      return "hour";
    case "1W":
    case "1M":
      return "hour";
    default:
      return "day";
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
