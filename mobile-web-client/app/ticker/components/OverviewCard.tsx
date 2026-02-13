import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { OverviewResponse } from "../../../src/types";
import { Theme } from "./theme";

type OverviewCardProps = {
  theme: Theme;
  overview: OverviewResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

export function OverviewCard({ theme, overview, loading, error, onRetry }: OverviewCardProps) {
  const overviewText = overview?.overview ?? "Overview unavailable right now.";
  const overviewFactors = overview?.key_factors ?? [];
  const overviewSources = overview?.sources ?? [];

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Overview</Text>
      {loading ? (
        <Text style={[styles.chartSubtitle, { color: theme.muted }]}>Loading overview...</Text>
      ) : error ? (
        <View style={styles.chartPlaceholder}>
          <Text style={[styles.chartSubtitle, { color: theme.error }]}>Overview unavailable</Text>
          <Pressable style={[styles.retryButton, { borderColor: theme.border }]} onPress={onRetry}>
            <Text style={[styles.retryText, { color: theme.text }]}>Retry</Text>
          </Pressable>
        </View>
      ) : overview ? (
        <>
          <Text style={[styles.overviewText, { color: theme.text }]}>{overviewText}</Text>
          {overviewFactors.length ? (
            <View style={styles.factorList}>
              {overviewFactors.map((factor, index) => (
                <Text key={`${factor}-${index}`} style={[styles.factorItem, { color: theme.text }]}>
                  - {factor}
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
                  <Text numberOfLines={1} style={[styles.articleTitle, { color: theme.text }]}>
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
  );
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
  return parts.join(" - ");
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

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
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
