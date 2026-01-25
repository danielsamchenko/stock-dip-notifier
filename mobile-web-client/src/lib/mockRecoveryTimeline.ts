export type RecoveryHorizon = { days: number; probability: number };

const HORIZONS = [14, 30, 60, 90, 180, 365];

export function getMockRecoveryTimeline(symbol: string): RecoveryHorizon[] {
  const seed = hashString(symbol || "UNKNOWN");
  const rand = mulberry32(seed);
  const minProb = 5 + Math.round(rand() * 18);
  const maxProb = 60 + Math.round(rand() * 35);
  const curve = 1.1 + rand() * 0.9;
  const length = HORIZONS.length;
  let last = 0;

  return HORIZONS.map((days, index) => {
    const t = length <= 1 ? 1 : index / (length - 1);
    const raw = minProb + (maxProb - minProb) * Math.pow(t, curve);
    const rounded = Math.round(raw);
    const clamped = clamp(rounded, 5, 95);
    const probability = Math.max(last, clamped);
    last = probability;
    return { days, probability };
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
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
