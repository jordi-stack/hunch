interface JupiterPriceV3Item {
  usdPrice: number;
  priceChange24h: number;
}

interface JupiterTokenInfo {
  symbol: string;
  decimals: number;
  name: string;
}

const PRICE_BASE = 'https://lite-api.jup.ag/price/v3';
const TOKEN_BASE = 'https://lite-api.jup.ag/tokens/v2';

const priceCache = new Map<string, { value: { price: number; priceChange24h: number }; expiresAt: number }>();
const tokenCache = new Map<string, JupiterTokenInfo | null>();

const PRICE_TTL_MS = 30_000;

export async function getTokenPrice(mint: string): Promise<{ price: number; priceChange24h: number } | null> {
  const cached = priceCache.get(mint);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const res = await fetch(`${PRICE_BASE}?ids=${mint}`);
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, JupiterPriceV3Item>;
    const item = json[mint];
    if (!item || typeof item.usdPrice !== 'number') return null;

    const value = {
      price: item.usdPrice,
      priceChange24h: item.priceChange24h ?? 0,
    };
    priceCache.set(mint, { value, expiresAt: Date.now() + PRICE_TTL_MS });
    return value;
  } catch {
    return null;
  }
}

export async function getTokenInfo(mint: string): Promise<JupiterTokenInfo | null> {
  if (tokenCache.has(mint)) return tokenCache.get(mint) ?? null;

  try {
    const res = await fetch(`${TOKEN_BASE}/search?query=${mint}`);
    if (!res.ok) {
      tokenCache.set(mint, null);
      return null;
    }
    const arr = (await res.json()) as Array<{ id: string; symbol: string; decimals: number; name: string }>;
    const found = arr.find((t) => t.id === mint);
    const info: JupiterTokenInfo | null = found
      ? { symbol: found.symbol, decimals: found.decimals, name: found.name }
      : null;
    tokenCache.set(mint, info);
    return info;
  } catch {
    tokenCache.set(mint, null);
    return null;
  }
}
