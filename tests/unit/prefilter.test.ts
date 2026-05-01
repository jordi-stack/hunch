import { describe, it, expect } from 'vitest';
import { prefilterEvent } from '../../src/ingestion/prefilter.js';
import { PriceChangeEvent, WhaleTxEvent } from '../../src/ingestion/events.js';
import { UserPreferences } from '../../src/memory/types.js';

const defaultPreferences: UserPreferences = {
  alertThresholds: {
    priceChangePercent: 10,
    whaleThresholdSol: 100,
    defiHealthRatio: 1.5,
  },
  confidenceThreshold: 0.7,
  autoExecute: false,
  dailySpendingCap: 10,
  tokenWhitelist: ['So11111111111111111111111111111111111111112'],
  protocolWhitelist: ['jupiter', 'marinade'],
};

describe('prefilterEvent', () => {
  it('should pass price change above threshold for relevant token', () => {
    const event: PriceChangeEvent = {
      id: 'test-1',
      type: 'price_change',
      timestamp: new Date(),
      payload: {
        tokenMint: 'So11111111111111111111111111111111111111112',
        tokenSymbol: 'SOL',
        priceUsd: 150,
        changePercent: 15,
        timeframe: '24h',
      },
    };

    const result = prefilterEvent(event, defaultPreferences, []);
    expect(result.pass).toBe(true);
  });

  it('should drop price change below threshold', () => {
    const event: PriceChangeEvent = {
      id: 'test-2',
      type: 'price_change',
      timestamp: new Date(),
      payload: {
        tokenMint: 'So11111111111111111111111111111111111111112',
        tokenSymbol: 'SOL',
        priceUsd: 150,
        changePercent: 5,
        timeframe: '24h',
      },
    };

    const result = prefilterEvent(event, defaultPreferences, []);
    expect(result.pass).toBe(false);
    expect(result.reason).toBe('change_below_threshold');
  });

  it('should drop event for irrelevant token', () => {
    const event: PriceChangeEvent = {
      id: 'test-3',
      type: 'price_change',
      timestamp: new Date(),
      payload: {
        tokenMint: 'irrelevant-token-mint',
        tokenSymbol: 'UNKNOWN',
        priceUsd: 1,
        changePercent: 50,
        timeframe: '24h',
      },
    };

    const result = prefilterEvent(event, defaultPreferences, []);
    expect(result.pass).toBe(false);
    expect(result.reason).toBe('token_not_relevant');
  });
});
