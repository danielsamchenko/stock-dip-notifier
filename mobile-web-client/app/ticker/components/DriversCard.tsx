import { useEffect, useRef, useState } from "react";
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { TernaryDriverPlot } from "../../../src/components/TernaryDriverPlot";
import { Theme } from "./theme";

type DriverData = {
  market: number;
  industry: number;
  company: number;
  confidence: number;
  summary: string;
};

type DriversCardProps = {
  theme: Theme;
  driverData: DriverData;
  plotSize: number;
  style?: StyleProp<ViewStyle>;
};

export function DriversCard({ theme, driverData, plotSize, style }: DriversCardProps) {
  const [showHelp, setShowHelp] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const driverAccent = "#60a5fa";

  const clearHelpHideTimeout = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  const queueHelpHide = () => {
    clearHelpHideTimeout();
    hideTimeoutRef.current = setTimeout(() => {
      setShowHelp(false);
    }, 120);
  };

  useEffect(() => {
    return () => {
      clearHelpHideTimeout();
    };
  }, []);

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, style]}>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>What's Driving the Dip?</Text>
        <View style={styles.helpWrap}>
          <Pressable
            onPress={() => setShowHelp((prev) => !prev)}
            onHoverIn={() => {
              clearHelpHideTimeout();
              setShowHelp(true);
            }}
            onHoverOut={queueHelpHide}
            accessibilityRole="button"
            accessibilityLabel="Explain the drivers triangle"
            style={styles.helpButton}
          >
            <Ionicons name="help-circle-outline" size={22} color={theme.muted} />
          </Pressable>
          {showHelp ? (
            <Pressable
              style={[styles.helpTooltip, { backgroundColor: theme.background, borderColor: theme.border }]}
              onHoverIn={() => {
                clearHelpHideTimeout();
                setShowHelp(true);
              }}
              onHoverOut={queueHelpHide}
            >
              <Text style={[styles.helpTitle, { color: theme.text }]}>What the triangle means</Text>
              <Text style={[styles.helpText, { color: theme.muted }]}>
                This is a 3-way breakdown of what's likely behind the dip. The marker "leans"
                toward the dominant driver.
              </Text>
              <Text style={[styles.helpText, { color: theme.muted }]}>
                - <Text style={styles.helpStrong}>Market:</Text> index-level selling, rates, macro
                headlines
              </Text>
              <Text style={[styles.helpText, { color: theme.muted }]}>
                - <Text style={styles.helpStrong}>Industry:</Text> sector-wide moves, peer sympathy,
                thematic rotation
              </Text>
              <Text style={[styles.helpText, { color: theme.muted }]}>
                - <Text style={styles.helpStrong}>Company:</Text> earnings, guidance, news, or
                firm-specific fundamentals
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <View style={styles.driversColumn}>
        <View style={[styles.driversPlotCard, { borderColor: theme.border, alignSelf: "stretch" }]}>
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
        <Text style={[styles.driversSummary, { color: theme.text }]}>{driverData.summary}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
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
});
