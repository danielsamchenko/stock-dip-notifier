import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getCurrentDips, refreshBackend } from "../src/lib/api";
import { formatPercent } from "../src/lib/format";
import { CurrentDipRow } from "../src/types";

export default function DipsScreen() {
  const [dips, setDips] = useState<CurrentDipRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

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

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
          <Text style={styles.helperText}>Loading dips...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={loadDips}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Stock Dips</Text>
        </View>
        <Pressable style={styles.updatedRow} onPress={refreshNow} disabled={refreshing}>
          <Text style={styles.updatedText}>
            Last updated: {lastUpdated ? formatUpdatedAt(lastUpdated) : "—"}
          </Text>
          <Text style={styles.updatedHint}>
            {refreshing ? "Updating now..." : "Tap to refresh"}
          </Text>
        </Pressable>

        <FlatList
          data={dips}
          keyExtractor={(item) => `${item.symbol}-${item.date}`}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshNow} />}
          ListEmptyComponent={<Text style={styles.helperText}>No current dips.</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View>
                <Text style={styles.symbol}>{item.symbol}</Text>
                <Text style={styles.date}>{item.date || "n/a"}</Text>
              </View>
              <View style={styles.valueGroup}>
                <Text style={styles.value}>{formatPercent(item.dip)}</Text>
                <Text style={styles.windowLabel}>{formatWindow(item.window_days)}</Text>
              </View>
            </View>
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
  updatedRow: {
    marginBottom: 12,
  },
  updatedText: {
    color: "#6b7280",
    fontSize: 12,
  },
  updatedHint: {
    color: "#9ca3af",
    fontSize: 11,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  symbol: {
    fontSize: 18,
    fontWeight: "600",
  },
  value: {
    fontSize: 16,
    color: "#111827",
  },
  valueGroup: {
    alignItems: "flex-end",
  },
  windowLabel: {
    color: "#6b7280",
    fontSize: 12,
  },
  date: {
    color: "#6b7280",
  },
  helperText: {
    marginTop: 8,
    color: "#6b7280",
  },
  errorText: {
    color: "#b91c1c",
    marginBottom: 12,
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#111827",
  },
  retryText: {
    color: "#fff",
    fontWeight: "600",
  },
});
