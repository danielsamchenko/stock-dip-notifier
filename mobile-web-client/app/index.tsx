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
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { getCurrentDips, getTicker, refreshBackend } from "../src/lib/api";
import { formatPercent } from "../src/lib/format";
import { getLogoUrl } from "../src/lib/logos";
import { getMockSignalsForSymbol } from "../src/lib/mockSignals";
import { CurrentDipRow } from "../src/types";
import { ValueTrapMeter } from "../src/components/ValueTrapMeter";

export default function DipsScreen() {
  const [dips, setDips] = useState<CurrentDipRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [companyNames, setCompanyNames] = useState<Record<string, string | null>>({});
  const theme = darkTheme;

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

  useEffect(() => {
    let isMounted = true;
    const symbols = Array.from(
      new Set(dips.map((dip) => dip.symbol).filter((symbol) => symbol)),
    );
    const missing = symbols.filter((symbol) => companyNames[symbol] === undefined);
    if (!missing.length) {
      return () => {
        isMounted = false;
      };
    }

    Promise.allSettled(
      missing.map(async (symbol) => {
        try {
          const data = await getTicker(symbol);
          return { symbol, name: data.name?.trim() ?? null };
        } catch {
          return { symbol, name: null };
        }
      }),
    ).then((results) => {
      if (!isMounted) {
        return;
      }
      setCompanyNames((prev) => {
        const next = { ...prev };
        for (const result of results) {
          if (result.status === "fulfilled") {
            next[result.value.symbol] = result.value.name;
          }
        }
        return next;
      });
    });

    return () => {
      isMounted = false;
    };
  }, [companyNames, dips]);

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
        <StatusBar barStyle="light-content" />
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
        <StatusBar barStyle="light-content" />
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
      <StatusBar barStyle="light-content" />
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.headerRow}>
          <View style={styles.titleWrap}>
            <View style={styles.titleRow}>
              <Image
                source={require("../assets/app-logo.png")}
                style={styles.appLogo}
                resizeMode="contain"
              />
              <Text
                style={[styles.title, { color: theme.text }]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                Stock Dips
              </Text>
            </View>
          </View>
          <Pressable
            style={[styles.notificationsButton, { borderColor: theme.border, backgroundColor: theme.card }]}
            onPress={() => router.push("/notifications")}
          >
            <Text style={[styles.notificationsButtonText, { color: theme.text }]}>
              Notifications
            </Text>
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
          renderItem={({ item }) => {
            const companyName = companyNames[item.symbol];
            const companyLabel =
              companyName === undefined ? "Loading..." : companyName ?? "—";

            return (
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
                  <Text
                    numberOfLines={1}
                    style={[styles.companyName, { color: theme.muted }]}
                  >
                    {companyLabel}
                  </Text>
                </View>
              </View>
              <View style={styles.rightGroup}>
                <View style={styles.meterRow}>
                  <View style={styles.meterWrapper}>
                    <RowMeter symbol={item.symbol} />
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
            );
          }}
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

function RowMeter({ symbol }: { symbol: string }) {
  const signals = getMockSignalsForSymbol(symbol);
  return (
    <ValueTrapMeter
      score={signals.score}
      plateColor="#111111"
      trackColor="#2a2a2a"
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
  notificationsButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  notificationsButtonText: {
    fontSize: 12,
    fontWeight: "600",
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  appLogo: {
    width: 28,
    height: 28,
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
    flexShrink: 1,
    paddingVertical: 2,
    gap: 2,
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
  companyName: {
    fontSize: 12,
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
});
