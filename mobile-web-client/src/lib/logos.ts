export function getLogoUrl(symbol: string): string {
  const normalized = symbol.trim().toUpperCase().replace(".", "-");
  return `https://raw.githubusercontent.com/davidepalazzo/ticker-logos/main/ticker_icons/${normalized}.png`;
}
