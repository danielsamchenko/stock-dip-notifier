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

import { getDips } from "../src/lib/api";
import { formatPercent } from "../src/lib/format";
import { DipRow } from "../src/types";

const RULES = ["drawdown_20d", "drop_1d", "drawdown_252d"] as const;

export default function DipsScreen() {
  const [rule, setRule] = useState<string>("drawdown_20d");
  const [dips, setDips] = useState<DipRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadDips = useCallback(async () => {
    setError(null);
    try {
      const data = await getDips(rule, 25);
      const sorted = [...data].sort((a, b) => {
        const av = a.value ?? Number.POSITIVE_INFINITY;
        const bv = b.value ?? Number.POSITIVE_INFINITY;
        return av - bv;
      });
      setDips(sorted);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load dips";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [rule]);

  useEffect(() => {
    setLoading(true);
    loadDips();
  }, [loadDips]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDips();
  };

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
        <Pressable style={styles.refreshButton} onPress={loadDips}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      <View style={styles.ruleRow}>
        {RULES.map((item) => {
          const active = item === rule;
          return (
            <Pressable
              key={item}
              onPress={() => setRule(item)}
              style={[styles.ruleButton, active && styles.ruleButtonActive]}
            >
              <Text style={[styles.ruleText, active && styles.ruleTextActive]}>
                {item}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={dips}
        keyExtractor={(item) => `${item.symbol}-${item.date}-${item.rule}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.helperText}>No dips found.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View>
              <Text style={styles.symbol}>{item.symbol}</Text>
              <Text style={styles.date}>{item.date || "n/a"}</Text>
            </View>
            <Text style={styles.value}>{formatPercent(item.value)}</Text>
          </View>
        )}
      />
      </View>
    </SafeAreaView>
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
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
  },
  refreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#111827",
  },
  refreshText: {
    color: "#fff",
    fontWeight: "600",
  },
  ruleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  ruleButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d1d5db",
    marginRight: 8,
    marginBottom: 8,
  },
  ruleButtonActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  ruleText: {
    color: "#111827",
    fontSize: 12,
  },
  ruleTextActive: {
    color: "#fff",
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
