import { describe, it, expect } from 'vitest';
import { prefilterEvent } from '../../src/ingestion/prefilter.js';
import { PriceChangeEvent, WhaleTxEvent, DefiPositionEvent } from '../../src/ingestion/events.js';
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

  // Whale TX tests
  it('should pass whale tx above threshold for relevant token', () => {
    const event: WhaleTxEvent = {
      id: 'test-whale-1',
      type: 'whale_tx',
      timestamp: new Date(),
      payload: {
        tokenMint: 'So11111111111111111111111111111111111111112',
        tokenSymbol: 'SOL',
        amount: 150,
        amountUsd: 22500,
        fromAddress: 'whale1',
        toAddress: 'whale2',
        txSignature: 'sig1',
      },
    };

    const result = prefilterEvent(event, defaultPreferences, []);
    expect(result.pass).toBe(true);
  });

  it('should drop whale tx below threshold', () => {
    const event: WhaleTxEvent = {
      id: 'test-whale-2',
      type: 'whale_tx',
      timestamp: new Date(),
      payload: {
        tokenMint: 'So11111111111111111111111111111111111111112',
        tokenSymbol: 'SOL',
        amount: 50,
        amountUsd: 7500,
        fromAddress: 'whale1',
        toAddress: 'whale2',
        txSignature: 'sig2',
      },
    };

    const result = prefilterEvent(event, defaultPreferences, []);
    expect(result.pass).toBe(false);
    expect(result.reason).toBe('amount_below_threshold');
  });

  // DeFi Position tests
  it('should pass defi position with dangerous health ratio', () => {
    const event: DefiPositionEvent = {
      id: 'test-defi-1',
      type: 'defi_position',
      timestamp: new Date(),
      payload: {
        protocol: 'marinade',
        positionType: 'stake',
        tokenMint: 'So11111111111111111111111111111111111111112',
        amount: 100,
        healthRatio: 1.2,
        change: 'health_degraded',
      },
    };

    const result = prefilterEvent(event, defaultPreferences, []);
    expect(result.pass).toBe(true);
  });

  it('should drop defi position with safe health ratio', () => {
    const event: DefiPositionEvent = {
      id: 'test-defi-2',
      type: 'defi_position',
      timestamp: new Date(),
      payload: {
        protocol: 'marinade',
        positionType: 'stake',
        tokenMint: 'So11111111111111111111111111111111111111112',
        amount: 100,
        healthRatio: 2.0,
        change: 'health_improved',
      },
    };

    const result = prefilterEvent(event, defaultPreferences, []);
    expect(result.pass).toBe(false);
    expect(result.reason).toBe('health_ratio_safe');
  });

  // Portfolio relevance test
  it('should pass for token in userPortfolio even if not in whitelist', () => {
    const event: PriceChangeEvent = {
      id: 'test-portfolio-1',
      type: 'price_change',
      timestamp: new Date(),
      payload: {
        tokenMint: 'portfolio-token-mint',
        tokenSymbol: 'PTM',
        priceUsd: 10,
        changePercent: 20,
        timeframe: '24h',
      },
    };

    const result = prefilterEvent(event, defaultPreferences, ['portfolio-token-mint']);
    expect(result.pass).toBe(true);
  });

  // Unknown event type test
  it('should drop unknown event type', () => {
    const event = {
      id: 'test-unknown',
      type: 'unknown_type',
      timestamp: new Date(),
      payload: {},
    } as any;

    const result = prefilterEvent(event, defaultPreferences, []);
    expect(result.pass).toBe(false);
    expect(result.reason).toBe('unknown_event_type');
  });
});
