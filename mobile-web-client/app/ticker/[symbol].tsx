import { useEffect, useMemo, useState } from "react";
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

import { getTicker } from "../../src/lib/api";
import { formatPercent, formatSignedPoints } from "../../src/lib/format";
import { TickerDetail } from "../../src/types";

const TIME_RANGES = ["1D", "1W", "1M", "1Y", "ALL"] as const;

export default function TickerScreen() {
  const params = useLocalSearchParams();
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState<boolean>(systemScheme === "dark");
  const [selectedRange, setSelectedRange] = useState<(typeof TIME_RANGES)[number]>("1M");
  const [detail, setDetail] = useState<TickerDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const theme = isDark ? darkTheme : lightTheme;

  const symbol = parseStringParam(params.symbol) ?? "—";
  const dip = parseNumberParam(params.dip);
  const windowDays = parseNumberParam(params.window_days);
  const asOfDate = parseStringParam(params.date);
  const marketSymbol = parseStringParam(params.market_symbol) ?? "SPY";
  const sectorSymbol = parseStringParam(params.sector_symbol);
  const relativeSpy = parseNumberParam(params.relative_to_spy_pp);
  const relativeSector = parseNumberParam(params.relative_to_sector_pp);

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

  const dipLabel = useMemo(() => {
    if (dip === null) {
      return "Not available yet";
    }
    return `${formatPercent(dip)} ${formatWindow(windowDays)}`;
  }, [dip, windowDays]);

  const asOfLabel = asOfDate ? asOfDate : "Not available yet";
  const relSpyLabel = relativeSpy === null ? "Not available yet" : formatSignedPoints(relativeSpy);
  const relSectorLabel =
    relativeSector === null ? "Not available yet" : formatSignedPoints(relativeSector);

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
            <Ionicons
              name={isDark ? "sunny-outline" : "moon-outline"}
              size={18}
              color={theme.text}
            />
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
                <Text
                  style={[
                    styles.rangeText,
                    { color: active ? theme.background : theme.text },
                  ]}
                >
                  {range}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.chartTitle, { color: theme.text }]}>Chart coming soon</Text>
          <Text style={[styles.chartSubtitle, { color: theme.muted }]}>
            (Will be populated after I upgrade data provider)
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Stock Dip Analysis</Text>
          <Text style={[styles.sectionHint, { color: theme.mutedLight }]}>
            pp = percentage points vs benchmark
          </Text>

          <MetricRow
            label={`Relative vs ${marketSymbol}`}
            value={relSpyLabel}
            theme={theme}
          />
          <MetricRow
            label={sectorSymbol ? `Relative vs Sector (${sectorSymbol})` : "Relative vs Sector"}
            value={relSectorLabel}
            theme={theme}
          />
          <MetricRow label="Current Dip" value={dipLabel} theme={theme} />
          <MetricRow label="As of" value={asOfLabel} theme={theme} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricRow({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: Theme;
}) {
  return (
    <View style={[styles.metricRow, { borderBottomColor: theme.border }]}>
      <Text style={[styles.metricLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

function parseStringParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function parseNumberParam(value: string | string[] | undefined): number | null {
  const text = Array.isArray(value) ? value[0] : value;
  if (!text) {
    return null;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatWindow(value: number | null): string {
  if (!value) {
    return "";
  }
  return `(${value}d)`;
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
  accent: "#f9fafb",
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
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 24,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  chartSubtitle: {
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 11,
    marginBottom: 12,
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  metricLabel: {
    fontSize: 13,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: "600",
  },
});
