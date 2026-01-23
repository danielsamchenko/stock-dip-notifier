type RecoveryData = {
  score: number;
  label: "Low" | "Medium" | "High";
};

export function getMockRecovery(symbol: string): RecoveryData {
  const seed = hashString(symbol || "UNKNOWN");
  const rand = mulberry32(seed);
  const score = Math.round(rand() * 100);
  const label = score >= 70 ? "High" : score >= 40 ? "Medium" : "Low";
  return { score, label };
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
