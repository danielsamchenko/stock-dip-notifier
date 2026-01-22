import { useMemo, useState } from "react";
import { LayoutChangeEvent, Platform, StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Line,
  Polygon,
  Polyline,
  Stop,
} from "react-native-svg";

type ChartPoint = {
  t: number;
  c: number;
};

type LineChartProps = {
  data: ChartPoint[];
  height?: number;
  stroke?: string;
  textColor?: string;
  fillColor?: string;
  labelMode?: "time" | "date" | "monthYear" | "none";
};

export function LineChart({
  data,
  height = 180,
  stroke = "#111827",
  textColor = "#111827",
  fillColor,
  labelMode = "time",
}: LineChartProps) {
  const [width, setWidth] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const labelIndices = getLabelIndices(data.length, 5);
  const axisLabels =
    labelMode === "none"
      ? []
      : labelIndices.map((index) => formatLabel(data[index]?.t, labelMode));

  const { linePoints, areaPoints, coords } = useMemo(() => {
    if (!width || data.length < 2) {
      return { linePoints: "", areaPoints: "", coords: [] as ChartPointWithXY[] };
    }
    const closes = data.map((item) => item.c);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;

    const coords = data.map((item, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((item.c - min) / range) * height;
      return { x, y, c: item.c, t: item.t };
    });

    const linePoints = coords
      .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
      .join(" ");

    const areaPoints = [
      ...coords,
      { x: coords[coords.length - 1]?.x ?? width, y: height },
      { x: coords[0]?.x ?? 0, y: height },
    ]
      .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
      .join(" ");

    return { linePoints, areaPoints, coords };
  }, [data, height, width]);

  const hoverPoint = hoverIndex !== null ? coords[hoverIndex] : null;
  const hoverX = hoverPoint?.x ?? 0;
  const hoverY = hoverPoint?.y ?? 0;
  const tooltipLeft = clamp(hoverX - 44, 4, Math.max(4, width - 88));
  const tooltipTop = clamp(hoverY - 44, 4, Math.max(4, height - 44));

  function handleLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  const webHandlers: any =
    Platform.OS === "web"
      ? {
          onMouseMove: (event: any) => {
            if (!width || data.length < 2) {
              return;
            }
            const rawX = getWebMouseX(event);
            const locationX = clamp(rawX, 0, width);
            const ratio = Math.max(0, Math.min(1, locationX / width));
            const idx = Math.round(ratio * (data.length - 1));
            setHoverIndex(idx);
          },
          onMouseLeave: () => setHoverIndex(null),
        }
      : {};

  return (
    <View onLayout={handleLayout} style={styles.container}>
      <View style={styles.chartArea}>
        {width > 0 && data.length >= 2 ? (
          <View style={styles.chartWrapper} {...webHandlers}>
            <Svg width={width} height={height}>
              {fillColor ? (
                <Defs>
                  <LinearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <Stop offset="0%" stopColor={fillColor} stopOpacity="0.25" />
                    <Stop offset="100%" stopColor={fillColor} stopOpacity="0.0" />
                  </LinearGradient>
                </Defs>
              ) : null}
              {fillColor ? (
                <Polygon points={areaPoints} fill="url(#lineGradient)" />
              ) : null}
              <Polyline points={linePoints} fill="none" stroke={stroke} strokeWidth={2} />
              {hoverPoint ? (
                <>
                  <Line
                    x1={hoverX}
                    y1={0}
                    x2={hoverX}
                    y2={height}
                    stroke={stroke}
                    strokeOpacity={0.25}
                    strokeWidth={1}
                  />
                  <Circle cx={hoverX} cy={hoverY} r={3.5} fill={stroke} />
                </>
              ) : null}
            </Svg>
            {hoverPoint ? (
              <View
                pointerEvents="none"
                style={[styles.tooltip, { left: tooltipLeft, top: tooltipTop }]}
              >
                <Text style={[styles.tooltipText, { color: textColor }]}>
                  {formatLabel(hoverPoint.t, labelMode)}
                </Text>
                <Text style={[styles.tooltipText, { color: textColor }]}>
                  {hoverPoint.c.toFixed(2)}
                </Text>
              </View>
            ) : null}
            {axisLabels.length ? (
              <View pointerEvents="none" style={styles.axisRow}>
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
  chartArea: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 180,
  },
  chartWrapper: {
    width: "100%",
  },
  tooltip: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tooltipText: {
    fontSize: 10,
    fontWeight: "600",
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

type ChartPointWithXY = ChartPoint & { x: number; y: number };

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

function formatLabel(
  timestamp: number | undefined,
  mode: "time" | "date" | "monthYear" | "none",
): string {
  if (mode === "none") {
    return "";
  }
  if (mode === "time") {
    return formatTime(timestamp);
  }
  if (mode === "monthYear") {
    return formatMonthYear(timestamp);
  }
  return formatDate(timestamp);
}

function formatTime(timestamp?: number): string {
  if (!timestamp) {
    return "--:--";
  }
  const date = new Date(timestamp);
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/New_York",
    }).format(date);
  } catch {
    const hours = date.getHours().toString().padStart(2, "0");
    return `${hours}:00`;
  }
}

function formatDate(timestamp?: number): string {
  if (!timestamp) {
    return "--";
  }
  const date = new Date(timestamp);
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      timeZone: "America/New_York",
    }).format(date);
  } catch {
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    return `${month}/${day}`;
  }
}

function formatMonthYear(timestamp?: number): string {
  if (!timestamp) {
    return "--";
  }
  const date = new Date(timestamp);
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "America/New_York",
    }).format(date);
  } catch {
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${month}/${year}`;
  }
}

function getWebMouseX(event: any): number {
  const nativeEvent = event?.nativeEvent ?? event;
  const clientX = nativeEvent?.clientX ?? nativeEvent?.pageX;
  const target = event?.currentTarget;
  if (typeof clientX === "number" && target?.getBoundingClientRect) {
    const rect = target.getBoundingClientRect();
    return clientX - rect.left;
  }
  return 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
