import { useEffect, useRef, useState } from "react";
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { RecoveryDial } from "../../../src/components/RecoveryDial";
import { Theme } from "./theme";

type RecoveryData = {
  score: number;
  label: string;
};

type RecoveryCardProps = {
  theme: Theme;
  recovery: RecoveryData;
  dialSize: number;
  style?: StyleProp<ViewStyle>;
};

export function RecoveryCard({ theme, recovery, dialSize, style }: RecoveryCardProps) {
  const [showHelp, setShowHelp] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Recovery Outlook</Text>
        <View style={styles.helpWrap}>
          <Pressable
            onPress={() => setShowHelp((prev) => !prev)}
            onHoverIn={() => {
              clearHelpHideTimeout();
              setShowHelp(true);
            }}
            onHoverOut={queueHelpHide}
            accessibilityRole="button"
            accessibilityLabel="Explain recovery outlook"
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
              <Text style={[styles.helpTitle, { color: theme.text }]}>Recovery outlook</Text>
              <Text style={[styles.helpText, { color: theme.muted }]}>
                Recovery Outlook is a confidence score for rebound potential. It estimates how
                likely this stock is to recover back to its pre-dip stock price, not how quickly it
                might happen.
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <View style={styles.recoveryBody}>
        <Text style={[styles.recoveryScore, { color: theme.text }]}>Recovery Score: {recovery.score}/100</Text>
        <Text style={[styles.recoveryLabel, { color: theme.muted }]}>{recovery.label}</Text>
        <View style={styles.recoveryDialWrap}>
          <RecoveryDial
            score={recovery.score}
            size={dialSize}
            textColor={theme.text}
            trackColor={theme.border}
            needleColor={theme.text}
          />
        </View>
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
  helpText: {
    fontSize: 11,
    lineHeight: 14,
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
});
