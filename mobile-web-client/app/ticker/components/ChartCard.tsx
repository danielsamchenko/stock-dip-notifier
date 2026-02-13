import { Pressable, StyleSheet, Text, View } from "react-native";

import { LineChart } from "../../../src/components/LineChart";
import { IntradayBar } from "../../../src/types";
import { Theme } from "./theme";

type ChangeInfo = { text: string; delta: number } | null;

type ChartCardProps = {
  theme: Theme;
  currency: string;
  lastBar: IntradayBar | null;
  changeInfo: ChangeInfo;
  chartBars: IntradayBar[];
  chartError: string | null;
  chartLoading: boolean;
  chartLabelMode: "time" | "date" | "monthYear" | "none";
  chartStroke: string;
  chartFill?: string;
  onRetry: () => void;
};

export function ChartCard({
  theme,
  currency,
  lastBar,
  changeInfo,
  chartBars,
  chartError,
  chartLoading,
  chartLabelMode,
  chartStroke,
  chartFill,
  onRetry,
}: ChartCardProps) {
  const changeColor = changeInfo && changeInfo.delta < 0 ? theme.negative : theme.positive;

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.content}>
        <View style={styles.priceRow}>
          <View style={styles.priceLeft}>
            {lastBar ? (
              <>
                <Text style={[styles.priceText, { color: theme.text }]}>
                  {lastBar.c.toFixed(2)}
                </Text>
                <Text style={[styles.currencyText, { color: theme.muted }]}>{currency}</Text>
              </>
            ) : (
              <Text style={[styles.priceText, { color: theme.text }]}>-</Text>
            )}
          </View>
          {changeInfo ? (
            <Text style={[styles.changeText, { color: changeColor }]}>{changeInfo.text}</Text>
          ) : null}
        </View>
        {chartError ? (
          <View style={styles.chartPlaceholder}>
            <Text style={[styles.chartSubtitle, { color: theme.error }]}>{chartError}</Text>
            <Pressable
              style={[styles.retryButton, { borderColor: theme.border }]}
              onPress={onRetry}
            >
              <Text style={[styles.retryText, { color: theme.text }]}>Retry</Text>
            </Pressable>
          </View>
        ) : chartLoading ? (
          <Text style={[styles.chartSubtitle, { color: theme.muted }]}>Loading chart...</Text>
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
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  content: {
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
});
