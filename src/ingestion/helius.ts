import { OnchainEvent, PriceChangeEvent } from './events.js';
import { getTokenInfo, getTokenPrice } from './jupiter.js';

interface HeliusTransaction {
  signature: string;
  type: string;
  timestamp: number;
  tokenTransfers?: Array<{
    mint: string;
    tokenAmount: number;
    fromUserAccount: string;
    toUserAccount: string;
  }>;
}

function isHeliusTx(value: unknown): value is HeliusTransaction {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.signature === 'string' &&
    typeof v.type === 'string' &&
    typeof v.timestamp === 'number'
  );
}

export class HeliusIngestion {
  async processWebhook(payload: unknown): Promise<OnchainEvent[]> {
    // Helius enhanced webhooks send an array of transactions per request.
    // Accept either an array or a single object for resilience.
    const txs: unknown[] = Array.isArray(payload) ? payload : [payload];
    const events: OnchainEvent[] = [];

    for (const raw of txs) {
      if (!isHeliusTx(raw)) continue;
      if (raw.type !== 'SWAP' || !raw.tokenTransfers) continue;

      // Enrich every transfer in parallel.
      const enriched = await Promise.all(
        raw.tokenTransfers.map(async (transfer) => {
          const [info, price] = await Promise.all([
            getTokenInfo(transfer.mint),
            getTokenPrice(transfer.mint),
          ]);
          return {
            transfer,
            symbol: info?.symbol ?? 'UNKNOWN',
            priceUsd: price?.price ?? 0,
          };
        }),
      );

      for (const { transfer, symbol, priceUsd } of enriched) {
        events.push({
          id: `${raw.signature}-${transfer.mint}`,
          type: 'whale_tx',
          timestamp: new Date(raw.timestamp * 1000),
          payload: {
            tokenMint: transfer.mint,
            tokenSymbol: symbol,
            amount: transfer.tokenAmount,
            amountUsd: transfer.tokenAmount * priceUsd,
            fromAddress: transfer.fromUserAccount,
            toAddress: transfer.toUserAccount,
            txSignature: raw.signature,
          },
        });
      }
    }

    return events;
  }

  async getPriceChange(tokenMint: string): Promise<PriceChangeEvent | null> {
    const [price, info] = await Promise.all([
      getTokenPrice(tokenMint),
      getTokenInfo(tokenMint),
    ]);
    if (!price) return null;

    return {
      id: `price-${tokenMint}-${Date.now()}`,
      type: 'price_change',
      timestamp: new Date(),
      payload: {
        tokenMint,
        tokenSymbol: info?.symbol ?? 'UNKNOWN',
        priceUsd: price.price,
        changePercent: price.priceChange24h,
        timeframe: '24h',
      },
    };
  }
}
