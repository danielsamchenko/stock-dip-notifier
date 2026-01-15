type MockSignals = {
  score: number;
};

const cache = new Map<string, MockSignals>();

function hashSymbol(symbol: string): number {
  let hash = 0;
  for (let i = 0; i < symbol.length; i += 1) {
    hash = (hash * 31 + symbol.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getMockSignalsForSymbol(symbol: string): MockSignals {
  const key = symbol.trim().toUpperCase();
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const seed = hashSymbol(key || "UNKNOWN");
  const score = seed % 101;

  const result = { score };
  cache.set(key, result);
  return result;
}
