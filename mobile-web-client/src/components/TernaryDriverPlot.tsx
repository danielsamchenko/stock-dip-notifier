import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import Svg, { Polygon, Rect } from "react-native-svg";

type TernaryDriverPlotProps = {
  market: number;
  industry: number;
  company: number;
  confidence: number;
  size?: number;
  color?: string;
  textColor?: string;
  borderColor?: string;
  backgroundColor?: string;
};

export function TernaryDriverPlot({
  market,
  industry,
  company,
  confidence,
  size = 190,
  color = "#22c55e",
  textColor = "#111827",
  borderColor = "rgba(17, 24, 39, 0.2)",
  backgroundColor = "rgba(255, 255, 255, 0.04)",
}: TernaryDriverPlotProps) {
  const [timeMs, setTimeMs] = useState(0);
  const [snapUntil, setSnapUntil] = useState(0);
  const padding = size * 0.1;
  const side = size - padding * 2;
  const height = side * 0.866;
  const containerHeight = height + padding * 2;

  const top = { x: size / 2, y: padding };
  const bottomLeft = { x: padding, y: padding + height };
  const bottomRight = { x: padding + side, y: padding + height };

  const normalized = normalizeWeights(market, industry, company);
  const point = {
    x: normalized.market * top.x + normalized.industry * bottomRight.x + normalized.company * bottomLeft.x,
    y: normalized.market * top.y + normalized.industry * bottomRight.y + normalized.company * bottomLeft.y,
  };

  const maxSpread = side * 0.14;
  const minSpread = side * 0.05;
  const baseSpread = lerp(maxSpread, minSpread, clamp(confidence, 0, 1));

  const particles = useMemo(() => {
    const seed = hashString(
      `${normalized.market.toFixed(4)}|${normalized.industry.toFixed(4)}|${normalized.company.toFixed(4)}`,
    );
    return generateParticles(seed, point, { top, bottomLeft, bottomRight }, maxSpread, 85);
  }, [normalized.market, normalized.industry, normalized.company, point.x, point.y, maxSpread]);

  useEffect(() => {
    let frameId = 0;
    let last = 0;
    const step = (now: number) => {
      if (now - last >= 33) {
        setTimeMs(now);
        last = now;
      }
      frameId = requestAnimationFrame(step);
    };
    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const snapFactor = clamp((snapUntil - Date.now()) / 1000, 0, 1);
  const spread = baseSpread * (1 - 0.55 * snapFactor);
  const spreadScale = spread / maxSpread;
  const jitterAmplitude = maxSpread * 0.07;

  const trianglePoints = `${top.x},${top.y} ${bottomRight.x},${bottomRight.y} ${bottomLeft.x},${bottomLeft.y}`;

  const handleSnap = () => {
    setSnapUntil(Date.now() + 1000);
  };

  return (
    <Pressable
      style={[styles.container, { width: size, height: containerHeight }]}
      onPressIn={handleSnap}
      onHoverIn={handleSnap}
    >
      <Svg width={size} height={containerHeight}>
        <Polygon points={trianglePoints} fill={backgroundColor} stroke={borderColor} strokeWidth={1} />

        {particles.map((particle, index) => {
          const time = timeMs / 1000;
          const driftX =
            Math.sin(time * particle.speed + particle.phaseX) * jitterAmplitude * 0.6;
          const driftY =
            Math.cos(time * particle.speed + particle.phaseY) * jitterAmplitude * 0.6;
          const rawX = point.x + particle.ox * spreadScale + driftX;
          const rawY = point.y + particle.oy * spreadScale + driftY;
          const x = Math.round(rawX);
          const y = Math.round(rawY);
          const opacity = lerp(0.2, 0.85, 1 - particle.norm);
          const pixel = particle.size;
          return (
            <Rect
              key={`${index}-${x}-${y}`}
              x={x - pixel / 2}
              y={y - pixel / 2}
              width={pixel}
              height={pixel}
              fill={withAlpha(color, opacity)}
            />
          );
        })}
      </Svg>

      <Text style={[styles.label, { color: textColor, left: 0, right: 0, top: 0 }]}>Market</Text>
      <Text style={[styles.label, { color: textColor, left: 0, bottom: 0 }]}>Company</Text>
      <Text style={[styles.label, { color: textColor, right: 0, bottom: 0 }]}>Industry</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    position: "absolute",
    fontSize: 11,
    fontWeight: "600",
    opacity: 0.7,
    textAlign: "center",
  },
});

type Triangle = {
  top: { x: number; y: number };
  bottomLeft: { x: number; y: number };
  bottomRight: { x: number; y: number };
};

type Particle = {
  ox: number;
  oy: number;
  norm: number;
  size: number;
  phaseX: number;
  phaseY: number;
  speed: number;
};

function generateParticles(
  seed: number,
  centroid: { x: number; y: number },
  triangle: Triangle,
  maxSpread: number,
  count: number,
): Particle[] {
  const rand = mulberry32(seed);
  const particles: Particle[] = [];
  const attempts = 50;
  const pixelSize = 3.2;

  while (particles.length < count) {
    let placed = false;
    for (let i = 0; i < attempts; i += 1) {
      const radius = Math.sqrt(rand()) * maxSpread;
      const angle = rand() * Math.PI * 2;
      const ox = Math.cos(angle) * radius;
      const oy = Math.sin(angle) * radius;
      const candidate = { x: centroid.x + ox, y: centroid.y + oy };
      if (!isInsideTriangle(candidate, triangle)) {
        continue;
      }
      const norm = clamp(radius / maxSpread, 0, 1);
      particles.push({
        ox,
        oy,
        norm,
        size: pixelSize,
        phaseX: rand() * Math.PI * 2,
        phaseY: rand() * Math.PI * 2,
        speed: 0.3 + rand() * 0.6,
      });
      placed = true;
      break;
    }
    if (!placed) {
      particles.push({
        ox: 0,
        oy: 0,
        norm: 0,
        size: pixelSize,
        phaseX: rand() * Math.PI * 2,
        phaseY: rand() * Math.PI * 2,
        speed: 0.3 + rand() * 0.6,
      });
    }
  }

  return particles;
}

function isInsideTriangle(point: { x: number; y: number }, triangle: Triangle): boolean {
  const { top, bottomLeft, bottomRight } = triangle;
  const area = triangleArea(top, bottomLeft, bottomRight);
  const area1 = triangleArea(point, bottomLeft, bottomRight);
  const area2 = triangleArea(top, point, bottomRight);
  const area3 = triangleArea(top, bottomLeft, point);
  return Math.abs(area - (area1 + area2 + area3)) <= 0.5;
}

function triangleArea(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number {
  return Math.abs(
    (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)) / 2,
  );
}

function normalizeWeights(market: number, industry: number, company: number) {
  const sum = market + industry + company || 1;
  return {
    market: market / sum,
    industry: industry / sum,
    company: company / sum,
  };
}

function withAlpha(hex: string, alpha: number): string {
  if (hex.startsWith("rgba")) {
    return hex;
  }
  if (!hex.startsWith("#") || hex.length !== 7) {
    return `rgba(0,0,0,${alpha})`;
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
