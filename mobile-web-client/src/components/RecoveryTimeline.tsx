import { useMemo } from "react";
import { StyleSheet, Text, useColorScheme, View } from "react-native";

import { getMockRecoveryTimeline } from "../lib/mockRecoveryTimeline";

type RecoveryTimelineTheme = {
  card: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
};

type RecoveryTimelineProps = {
  symbol: string;
  theme?: RecoveryTimelineTheme;
};

const lightTheme: RecoveryTimelineTheme = {
  card: "#ffffff",
  border: "#e5e7eb",
  text: "#111827",
  muted: "#6b7280",
  accent: "#111827",
};

const darkTheme: RecoveryTimelineTheme = {
  card: "#0b0b0b",
  border: "#1f1f1f",
  text: "#f9fafb",
  muted: "#9ca3af",
  accent: "#22c55e",
};

export function RecoveryTimeline({ symbol, theme: themeOverride }: RecoveryTimelineProps) {
  const systemScheme = useColorScheme();
  const fallbackTheme = systemScheme === "dark" ? darkTheme : lightTheme;
  const theme = themeOverride ?? fallbackTheme;
  const timeline = useMemo(() => getMockRecoveryTimeline(symbol), [symbol]);

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.title, { color: theme.text }]}>Chance to Recover By</Text>
      <Text style={[styles.helper, { color: theme.muted }]}>
        Probability of revisiting the pre-dip price, based on historical behavior (mocked).
      </Text>
      <View style={styles.rows}>
        {timeline.map((row) => (
          <View key={row.days} style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={[styles.label, { color: theme.text }]}>{formatHorizon(row.days)}</Text>
              <Text style={[styles.value, { color: theme.text }]}>{row.probability}%</Text>
            </View>
            <View style={[styles.barTrack, { backgroundColor: theme.border }]}>
              <View
                style={[
                  styles.barFill,
                  { width: `${row.probability}%`, backgroundColor: theme.accent },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function formatHorizon(days: number): string {
  return `${days} days`;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
  },
  helper: {
    fontSize: 12,
    lineHeight: 16,
  },
  rows: {
    gap: 12,
  },
  row: {
    gap: 6,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
  value: {
    fontSize: 13,
    fontWeight: "700",
  },
  barTrack: {
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
  },
  disclaimer: {
    fontSize: 11,
  },
});
