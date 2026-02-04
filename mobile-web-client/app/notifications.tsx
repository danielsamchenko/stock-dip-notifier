import { useMemo, useState } from "react";
import {
  GestureResponderEvent,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const MIN_DIP = 5;
const MAX_DIP = 20;
const STEP = 1;

export default function NotificationsScreen() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [dipThreshold, setDipThreshold] = useState(12);

  const helperText = useMemo(() => {
    if (!notificationsEnabled) {
      return "Notifications are off.";
    }
    return `You will be notified for dips at or above ${dipThreshold}%.`;
  }, [dipThreshold, notificationsEnabled]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <View style={styles.topRow}>
          <Pressable style={styles.backButton} onPress={() => router.replace("/")}>
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </Pressable>
          <Text style={styles.title}>Notifications</Text>
          <View style={styles.topRowSpacer} />
        </View>

        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <Text style={styles.label}>Enable notifications</Text>
            <Pressable
              onPress={() => setNotificationsEnabled((prev) => !prev)}
              style={[
                styles.toggleTrack,
                notificationsEnabled ? styles.toggleTrackOn : styles.toggleTrackOff,
              ]}
            >
              <View
                style={[
                  styles.toggleThumb,
                  notificationsEnabled ? styles.toggleThumbOn : styles.toggleThumbOff,
                ]}
              />
            </Pressable>
          </View>

          <View style={styles.sliderSection}>
            <Text style={[styles.label, !notificationsEnabled && styles.disabledText]}>
              Minimum dip threshold
            </Text>
            <ThresholdSlider
              min={MIN_DIP}
              max={MAX_DIP}
              step={STEP}
              value={dipThreshold}
              disabled={!notificationsEnabled}
              onChange={setDipThreshold}
            />
            <Text style={styles.helperText}>{helperText}</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function ThresholdSlider({
  min,
  max,
  step,
  value,
  disabled,
  onChange,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  disabled?: boolean;
  onChange: (next: number) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const percent = ((value - min) / (max - min)) * 100;

  const updateFromX = (event: GestureResponderEvent) => {
    if (disabled || trackWidth <= 0) {
      return;
    }
    const x = clamp(event.nativeEvent.locationX, 0, trackWidth);
    const raw = min + (x / trackWidth) * (max - min);
    const stepped = Math.round(raw / step) * step;
    const next = clamp(stepped, min, max);
    onChange(next);
  };

  return (
    <View>
      <View
        style={[styles.track, disabled && styles.trackDisabled]}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => !disabled}
        onMoveShouldSetResponder={() => !disabled}
        onResponderGrant={updateFromX}
        onResponderMove={updateFromX}
      >
        <View style={[styles.trackFill, { width: `${percent}%` }]} />
        <View style={[styles.thumb, { left: `${percent}%` }]} />
      </View>
      <View style={styles.sliderLabels}>
        <Text style={styles.sliderLabel}>{min}%</Text>
        <Text style={[styles.sliderValue, disabled && styles.sliderValueDisabled]}>{value}%</Text>
        <Text style={styles.sliderLabel}>{max}%</Text>
      </View>
    </View>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const theme = {
  background: "#000000",
  card: "#0b0b0b",
  text: "#f9fafb",
  muted: "#9ca3af",
  border: "#1f1f1f",
  accent: "#2563eb",
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: theme.background,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  topRowSpacer: {
    width: 32,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.text,
  },
  card: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    backgroundColor: theme.card,
    padding: 16,
    gap: 18,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.text,
  },
  disabledText: {
    color: theme.muted,
  },
  sliderSection: {
    gap: 10,
  },
  toggleTrack: {
    width: 52,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  toggleTrackOn: {
    backgroundColor: "#1d4ed8",
    borderColor: "#3b82f6",
  },
  toggleTrackOff: {
    backgroundColor: "#1f2937",
    borderColor: "#374151",
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  toggleThumbOn: {
    marginLeft: "auto",
    backgroundColor: "#dbeafe",
  },
  toggleThumbOff: {
    marginLeft: 0,
    backgroundColor: "#9ca3af",
  },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#1f2937",
    overflow: "visible",
    justifyContent: "center",
  },
  trackDisabled: {
    opacity: 0.45,
  },
  trackFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: theme.accent,
  },
  thumb: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#bfdbfe",
    borderWidth: 1,
    borderColor: "#93c5fd",
    marginLeft: -8,
  },
  sliderLabels: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sliderLabel: {
    fontSize: 12,
    color: theme.muted,
  },
  sliderValue: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.text,
  },
  sliderValueDisabled: {
    color: theme.muted,
  },
  helperText: {
    fontSize: 12,
    color: theme.muted,
    lineHeight: 16,
  },
});
