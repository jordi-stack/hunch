import { OnchainEvent, PriceChangeEvent } from './events.js';

export class HeliusIngestion {
  private processedEvents: Set<string> = new Set();

  async processWebhook(payload: unknown): Promise<OnchainEvent[]> {
    // Validate required fields before casting
    const raw = payload as Record<string, unknown>;
    if (
      typeof raw.signature !== 'string' ||
      typeof raw.type !== 'string' ||
      typeof raw.timestamp !== 'number'
    ) {
      return [];
    }

    const data = payload as {
      signature: string;
      type: string;
      timestamp: number;
      tokenTransfers?: Array<{
        mint: string;
        tokenAmount: number;
        fromUserAccount: string;
        toUserAccount: string;
      }>;
    };

    if (this.processedEvents.has(data.signature)) {
      return [];
    }

    // LRU-like cleanup: drop all entries when the set gets too large
    if (this.processedEvents.size > 10000) {
      this.processedEvents.clear();
    }
    this.processedEvents.add(data.signature);

    const events: OnchainEvent[] = [];

    if (data.type === 'SWAP' && data.tokenTransfers) {
      for (const transfer of data.tokenTransfers) {
        // No threshold here; prefilter handles relevance and size filtering
        events.push({
          id: `${data.signature}-${transfer.mint}`,
          type: 'whale_tx',
          timestamp: new Date(data.timestamp * 1000),
          payload: {
            tokenMint: transfer.mint,
            tokenSymbol: 'UNKNOWN',
            amount: transfer.tokenAmount,
            amountUsd: 0,
            fromAddress: transfer.fromUserAccount,
            toAddress: transfer.toUserAccount,
            txSignature: data.signature,
          },
        });
      }
    }

    return events;
  }

  async getPriceChange(tokenMint: string): Promise<PriceChangeEvent | null> {
    try {
      const response = await fetch(
        `https://price.jup.ag/v6/price?ids=${tokenMint}`
      );
      const data = await response.json() as {
        data: Record<string, { price: number; priceChange24h: number }>;
      };

      const tokenData = data.data[tokenMint];
      if (!tokenData) return null;

      return {
        id: `price-${tokenMint}-${Date.now()}`,
        type: 'price_change',
        timestamp: new Date(),
        payload: {
          tokenMint,
          tokenSymbol: 'UNKNOWN',
          priceUsd: tokenData.price,
          changePercent: tokenData.priceChange24h,
          timeframe: '24h',
        },
      };
    } catch {
      return null;
    }
  }
}
