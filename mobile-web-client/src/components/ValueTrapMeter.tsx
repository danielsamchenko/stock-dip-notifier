import { StyleSheet, View } from "react-native";

type ValueTrapMeterProps = {
  score: number;
  plateColor: string;
  trackColor: string;
};

const DIAL_SIZE = 46;
const ARC_INSET = 4;
const ARC_START_DEG = -85;
const ARC_SWEEP_DEG = 170;
const INNER_SIZE = DIAL_SIZE - ARC_INSET * 2;
const NEEDLE_LENGTH = INNER_SIZE / 2 - 6;
const SEGMENTS = 12;
const SEGMENT_LENGTH = 8;
const SEGMENT_THICKNESS = 3;

export function ValueTrapMeter({
  score,
  plateColor,
  trackColor,
}: ValueTrapMeterProps) {
  const clamped = Math.min(Math.max(score, 0), 100);
  const fillColor = getFillColor(clamped);
  const angleDeg = ARC_START_DEG + (clamped / 100) * ARC_SWEEP_DEG;
  const radius = INNER_SIZE / 2 - 2;

  const segments = Array.from({ length: SEGMENTS }, (_, index) => {
    const ratio = SEGMENTS <= 1 ? 1 : index / (SEGMENTS - 1);
    const angle = ARC_START_DEG + ratio * ARC_SWEEP_DEG;
    const isFilled = clamped >= ratio * 100;
    const color = isFilled ? fillColor : trackColor;
    return (
      <View
        key={`seg-${index}`}
        style={[
          styles.segment,
          {
            backgroundColor: color,
            transform: [
              { rotate: `${angle}deg` },
              { translateY: -radius },
            ],
          },
        ]}
      />
    );
  });

  return (
    <View style={styles.wrapper}>
      <View style={[styles.dialContainer, { backgroundColor: plateColor }]}>
        <View style={styles.dialClip}>
          {segments}
          <View style={[styles.needlePivot, { transform: [{ rotate: `${angleDeg}deg` }] }]}>
            <View style={[styles.needle, { backgroundColor: fillColor }]} />
          </View>
          <View style={[styles.needleBase, { backgroundColor: fillColor }]} />
        </View>
      </View>
    </View>
  );
}

function getFillColor(score: number): string {
  if (score <= 20) {
    return "#ef4444";
  }
  if (score <= 40) {
    return "#f97316";
  }
  if (score <= 60) {
    return "#facc15";
  }
  if (score <= 80) {
    return "#16a34a";
  }
  return "#00ff66";
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "flex-start",
    justifyContent: "center",
  },
  dialContainer: {
    padding: 4,
    borderRadius: 10,
    alignItems: "flex-start",
  },
  dialClip: {
    width: DIAL_SIZE,
    height: DIAL_SIZE / 2 + 14,
    overflow: "hidden",
    position: "relative",
  },
  segment: {
    position: "absolute",
    width: SEGMENT_LENGTH,
    height: SEGMENT_THICKNESS,
    borderRadius: SEGMENT_THICKNESS / 2,
    left: DIAL_SIZE / 2 - SEGMENT_LENGTH / 2,
    top: DIAL_SIZE / 2 - SEGMENT_THICKNESS / 2,
  },
  needlePivot: {
    position: "absolute",
    top: ARC_INSET,
    left: ARC_INSET,
    width: INNER_SIZE,
    height: INNER_SIZE,
  },
  needle: {
    position: "absolute",
    width: 2,
    height: NEEDLE_LENGTH,
    left: INNER_SIZE / 2 - 1,
    top: INNER_SIZE / 2 - NEEDLE_LENGTH,
    borderRadius: 1,
  },
  needleBase: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    left: DIAL_SIZE / 2 - 3,
    top: DIAL_SIZE / 2 - 3,
  },
});
