import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { getCurrentDips, refreshBackend } from "../src/lib/api";
import { formatPercent } from "../src/lib/format";
import { getLogoUrl } from "../src/lib/logos";
import { getMockSignalsForSymbol } from "../src/lib/mockSignals";
import { CurrentDipRow } from "../src/types";
import { ValueTrapMeter } from "../src/components/ValueTrapMeter";

export default function DipsScreen() {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState<boolean>(systemScheme === "dark");
  const [dips, setDips] = useState<CurrentDipRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const theme = isDark ? darkTheme : lightTheme;

  const loadDips = useCallback(async () => {
    setError(null);
    try {
      const data = await getCurrentDips(50);
      const sorted = [...data].sort((a, b) => {
        const av = a.dip ?? Number.POSITIVE_INFINITY;
        const bv = b.dip ?? Number.POSITIVE_INFINITY;
        return av - bv;
      });
      setDips(sorted);
      setLastUpdated(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load dips";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadDips();
  }, [loadDips]);

  const refreshNow = useCallback(async () => {
    if (refreshing) {
      return;
    }
    setRefreshing(true);
    setError(null);
    try {
      await refreshBackend();
      await loadDips();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to refresh data";
      setError(message);
    } finally {
      setRefreshing(false);
    }
  }, [loadDips, refreshing]);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshNow();
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refreshNow]);

  useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }
    if (typeof document === "undefined") {
      return;
    }
    const style = document.createElement("style");
    style.textContent = `
      #dips-list::-webkit-scrollbar { display: none; }
      #dips-list { -ms-overflow-style: none; scrollbar-width: none; }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <View style={[styles.centered, { backgroundColor: theme.background }]}>
          <ActivityIndicator size="large" color={theme.text} />
          <Text style={[styles.helperText, { color: theme.muted }]}>Loading dips...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <View style={[styles.centered, { backgroundColor: theme.background }]}>
          <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
          <Pressable style={[styles.retryButton, { backgroundColor: theme.accent }]} onPress={loadDips}>
            <Text style={[styles.retryText, { color: theme.accentText }]}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.headerRow}>
          <View style={styles.titleWrap}>
            <Text
              style={[styles.title, { color: theme.text }]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              Stock Dips
            </Text>
          </View>
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
        <Pressable style={styles.updatedRow} onPress={refreshNow} disabled={refreshing}>
          <Text style={[styles.updatedText, { color: theme.muted }]}>
            Last updated: {lastUpdated ? formatUpdatedAt(lastUpdated) : "—"}
          </Text>
          <Text style={[styles.updatedHint, { color: theme.mutedLight }]}>
            {refreshing ? "Updating now..." : "Tap to refresh"}
          </Text>
        </Pressable>
        <FlatList
          data={dips}
          nativeID="dips-list"
          keyExtractor={(item) => `${item.symbol}-${item.date}`}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshNow}
              tintColor={theme.text}
              colors={[theme.text]}
            />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={[styles.helperText, { color: theme.muted }]}>No current dips.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: theme.border, opacity: pressed ? 0.6 : 1 },
              ]}
              onPress={() =>
                router.push({
                  pathname: "/ticker/[symbol]",
                  params: {
                    symbol: item.symbol,
                    dip: item.dip?.toString() ?? "",
                    window_days: item.window_days?.toString() ?? "",
                    date: item.date ?? "",
                  },
                })
              }
              accessibilityRole="button"
            >
              <View style={styles.rowLeft}>
                <Logo symbol={item.symbol} theme={theme} />
                <View style={styles.symbolBlock}>
                  <Text style={[styles.symbol, { color: theme.text }]}>{item.symbol}</Text>
                  <Text style={[styles.date, { color: theme.muted }]}>
                    As of {item.date || "n/a"}
                  </Text>
                </View>
              </View>
              <View style={styles.rightGroup}>
                <View style={styles.meterRow}>
                  <View style={styles.meterWrapper}>
                    <RowMeter symbol={item.symbol} isDark={isDark} />
                    <Text style={[styles.meterLabel, { color: theme.mutedLight }]}>
                      Recovery Score
                    </Text>
                  </View>
                  <View style={styles.valueGroup}>
                    <Text style={[styles.value, { color: theme.text }]}>
                      {formatPercent(item.dip)}
                    </Text>
                    <Text style={[styles.windowLabel, { color: theme.muted }]}>
                      {formatWindow(item.window_days)}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

function formatUpdatedAt(value: Date): string {
  return value.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
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

function RowMeter({
  symbol,
  isDark,
}: {
  symbol: string;
  isDark: boolean;
}) {
  const signals = getMockSignalsForSymbol(symbol);
  return (
    <ValueTrapMeter
      score={signals.score}
      plateColor={isDark ? "#111111" : "#f8fafc"}
      trackColor={isDark ? "#2a2a2a" : "#e5e7eb"}
    />
  );
}

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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#fff",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: "#fff",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  titleWrap: {
    flex: 1,
    paddingRight: 12,
  },
  updatedRow: {
    marginBottom: 12,
  },
  updatedText: {
    color: "#6b7280",
    fontSize: 12,
  },
  updatedHint: {
    fontSize: 11,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  symbolBlock: {
    marginLeft: 10,
  },
  logoContainer: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 24,
    height: 24,
  },
  logoFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontSize: 12,
    fontWeight: "600",
  },
  symbol: {
    fontSize: 18,
    fontWeight: "600",
  },
  rightGroup: {
    alignItems: "flex-end",
  },
  meterLabel: {
    fontSize: 10,
    marginTop: 0,
    textAlign: "center",
  },
  meterRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  meterWrapper: {
    alignItems: "center",
    marginRight: 8,
  },
  valueGroup: {
    alignItems: "flex-end",
    minWidth: 64,
  },
  value: {
    fontSize: 16,
    fontWeight: "600",
  },
  windowLabel: {
    fontSize: 12,
  },
  date: {
    fontSize: 12,
    marginTop: 2,
  },
  helperText: {
    marginTop: 8,
  },
  errorText: {
    marginBottom: 12,
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryText: {
    fontWeight: "600",
  },
  toggleButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
