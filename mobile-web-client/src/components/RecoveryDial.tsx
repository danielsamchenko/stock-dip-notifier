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
  gradientFrom?: string;
  gradientTo?: string;
};

export function RecoveryDial({
  score,
  size = 160,
  textColor = "#111827",
  trackColor = "rgba(148, 163, 184, 0.35)",
  needleColor = "#e2e8f0",
  gradientFrom = "#7f1d1d",
  gradientTo = "#86efac",
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

  const needleLength = radius - stroke * 0.4;
  const needleEnd = polarToCartesian(center.x, center.y, needleLength, valueAngle);
  const baseHalfWidth = 6;
  const leftBase = polarToCartesian(center.x, center.y, baseHalfWidth, valueAngle - 90);
  const rightBase = polarToCartesian(center.x, center.y, baseHalfWidth, valueAngle + 90);

  return (
    <Svg width={size} height={size * 0.75}>
      <Defs>
        <LinearGradient id="dial-gradient" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor={gradientFrom} stopOpacity={0.9} />
          <Stop offset="35%" stopColor="#f97316" stopOpacity={0.9} />
          <Stop offset="65%" stopColor="#facc15" stopOpacity={0.9} />
          <Stop offset="100%" stopColor={gradientTo} stopOpacity={0.9} />
        </LinearGradient>
      </Defs>

      <Path
        d={trackPath}
        stroke={trackColor}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
      />
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
