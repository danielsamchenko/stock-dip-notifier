import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Polygon,
  Stop,
  Text as SvgText,
} from "react-native-svg";

type RecoveryDialProps = {
  score: number;
  size?: number;
  textColor?: string;
  trackColor?: string;
  needleColor?: string;
};

export function RecoveryDial({
  score,
  size = 160,
  textColor = "#111827",
  trackColor = "rgba(148, 163, 184, 0.35)",
  needleColor = "#e2e8f0",
}: RecoveryDialProps) {
  const clamped = clamp(score, 0, 100);
  const stroke = 10;
  const radius = size * 0.36;
  const center = { x: size / 2, y: size * 0.6 };

  const startAngle = 270;
  const endAngle = 90;
  const sweep = (endAngle - startAngle + 360) % 360;
  const valueAngle = (startAngle + sweep * (clamped / 100)) % 360;

  const trackPath = describeArcClockwise(center.x, center.y, radius, startAngle, endAngle);
  const valuePath = describeArcClockwise(center.x, center.y, radius, startAngle, valueAngle);
  const gradientStops = buildGradientStops(clamped);

  const needleLength = radius - stroke * 0.4;
  const needleEnd = polarToCartesian(center.x, center.y, needleLength, valueAngle);
  const baseHalfWidth = 6;
  const leftBase = polarToCartesian(center.x, center.y, baseHalfWidth, valueAngle - 90);
  const rightBase = polarToCartesian(center.x, center.y, baseHalfWidth, valueAngle + 90);

  return (
    <Svg width={size} height={size * 0.75}>
      <Path
        d={trackPath}
        stroke={trackColor}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
      />
      <Defs>
        <LinearGradient id="dial-gradient" x1="0" y1="0" x2="1" y2="0">
          {gradientStops.map((stop) => (
            <Stop
              key={`${stop.offset}-${stop.color}`}
              offset={`${stop.offset * 100}%`}
              stopColor={stop.color}
              stopOpacity={0.95}
            />
          ))}
        </LinearGradient>
      </Defs>

      <Path
        d={valuePath}
        stroke="url(#dial-gradient)"
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
      />
      <Polygon
        points={`${leftBase.x},${leftBase.y} ${rightBase.x},${rightBase.y} ${needleEnd.x},${needleEnd.y}`}
        fill={needleColor}
      />
      <Circle cx={center.x} cy={center.y} r={7} fill={needleColor} />
      <SvgText
        x={center.x}
        y={center.y - 8}
        fontSize={18}
        fontWeight="700"
        fill={textColor}
        textAnchor="middle"
      >
        {" "}
      </SvgText>
    </Svg>
  );
}

function describeArcClockwise(
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(x, y, radius, startAngle);
  const end = polarToCartesian(x, y, radius, endAngle);
  const sweep = (endAngle - startAngle + 360) % 360;
  const largeArcFlag = sweep > 180 ? "1" : "0";
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

function polarToCartesian(x: number, y: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: x + radius * Math.cos(angleInRadians),
    y: y + radius * Math.sin(angleInRadians),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

type ColorStop = { offset: number; color: string };

const BASE_STOPS: ColorStop[] = [
  { offset: 0, color: "#7f1d1d" },
  { offset: 0.35, color: "#f97316" },
  { offset: 0.65, color: "#facc15" },
  { offset: 1, color: "#22c55e" },
];

function buildGradientStops(score: number): ColorStop[] {
  const ratio = clamp(score, 0, 100) / 100;
  if (ratio <= 0) {
    return [
      { offset: 0, color: BASE_STOPS[0].color },
      { offset: 1, color: BASE_STOPS[0].color },
    ];
  }
  if (ratio >= 1) {
    return BASE_STOPS;
  }

  const stops: ColorStop[] = [];
  for (const stop of BASE_STOPS) {
    if (stop.offset <= ratio) {
      stops.push({ offset: stop.offset / ratio, color: stop.color });
    }
  }
  const endColor = interpolateColor(ratio);
  stops.push({ offset: 1, color: endColor });
  return stops;
}

function interpolateColor(position: number): string {
  for (let i = 0; i < BASE_STOPS.length - 1; i += 1) {
    const left = BASE_STOPS[i];
    const right = BASE_STOPS[i + 1];
    if (position >= left.offset && position <= right.offset) {
      const t = (position - left.offset) / (right.offset - left.offset);
      return mixHex(left.color, right.color, t);
    }
  }
  return BASE_STOPS[BASE_STOPS.length - 1].color;
}

function mixHex(left: string, right: string, t: number): string {
  const a = hexToRgb(left);
  const b = hexToRgb(right);
  if (!a || !b) {
    return right;
  }
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bVal = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r}, ${g}, ${bVal})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 6) {
    return null;
  }
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return { r, g, b };
}
