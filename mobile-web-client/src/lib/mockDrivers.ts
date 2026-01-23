type DriverData = {
  market: number;
  industry: number;
  company: number;
  summary: string;
  confidence: number;
};

const SUMMARIES = {
  market:
    "Broader market risk-off today; many large caps are down with SPY weakness.",
  industry:
    "Sector-specific pressure is driving most of the move right now.",
  company:
    "Company-specific headlines appear to be the main driver of the drop.",
};

export function getMockDrivers(symbol: string): DriverData {
  const seed = hashString(symbol || "UNKNOWN");
  const rand = mulberry32(seed);
  const a = rand();
  const b = rand();
  const c = rand();
  const confidence = 0.35 + rand() * 0.6;
  const sum = a + b + c || 1;
  const market = a / sum;
  const industry = b / sum;
  const company = c / sum;

  const dominant = getDominant(market, industry, company);
  const summary = SUMMARIES[dominant];

  return { market, industry, company, summary, confidence };
}

function getDominant(
  market: number,
  industry: number,
  company: number,
): "market" | "industry" | "company" {
  if (market >= industry && market >= company) {
    return "market";
  }
  if (industry >= market && industry >= company) {
    return "industry";
  }
  return "company";
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
