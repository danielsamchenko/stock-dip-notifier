import { useMemo, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";

type ChartPoint = {
  t: number;
  c: number;
};

type LineChartProps = {
  data: ChartPoint[];
  height?: number;
  stroke?: string;
  textColor?: string;
};

export function LineChart({
  data,
  height = 180,
  stroke = "#111827",
  textColor = "#111827",
}: LineChartProps) {
  const [width, setWidth] = useState(0);

  const lastClose = data.length ? data[data.length - 1]?.c : null;
  const labelIndices = getLabelIndices(data.length, 3);
  const axisLabels = labelIndices.map((index) => formatTime(data[index]?.t));

  const points = useMemo(() => {
    if (!width || data.length < 2) {
      return "";
    }
    const closes = data.map((item) => item.c);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;

    return data
      .map((item, index) => {
        const x = (index / (data.length - 1)) * width;
        const y = height - ((item.c - min) / range) * height;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }, [data, height, width]);

  function handleLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  return (
    <View onLayout={handleLayout} style={styles.container}>
      <Text style={[styles.lastPrice, { color: textColor }]}>
        {lastClose === null ? "—" : lastClose.toFixed(2)}
      </Text>
      <View style={styles.chartArea}>
        {width > 0 && data.length >= 2 ? (
          <View style={styles.chartWrapper}>
            <Svg width={width} height={height}>
              <Polyline points={points} fill="none" stroke={stroke} strokeWidth={2} />
            </Svg>
            {axisLabels.length ? (
              <View style={styles.axisRow}>
                {axisLabels.map((label, idx) => (
                  <Text key={`${label}-${idx}`} style={[styles.axisLabel, { color: textColor }]}>
                    {label}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <Text style={[styles.placeholder, { color: textColor }]}>No data yet</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  lastPrice: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  chartArea: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 180,
  },
  chartWrapper: {
    width: "100%",
  },
  axisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  axisLabel: {
    fontSize: 10,
  },
  placeholder: {
    fontSize: 12,
  },
});

function getLabelIndices(length: number, count: number): number[] {
  if (length <= 1 || count <= 0) {
    return [];
  }
  if (length <= count) {
    return Array.from({ length }, (_, idx) => idx);
  }
  const indices = new Set<number>();
  indices.add(0);
  indices.add(length - 1);
  if (count > 2) {
    const step = (length - 1) / (count - 1);
    for (let i = 1; i < count - 1; i += 1) {
      indices.add(Math.round(step * i));
    }
  }
  return Array.from(indices).sort((a, b) => a - b);
}

function formatTime(timestamp?: number): string {
  if (!timestamp) {
    return "--:--";
  }
  const date = new Date(timestamp);
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/New_York",
    }).format(date);
  } catch {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  }
}
