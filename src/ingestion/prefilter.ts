import { OnchainEvent } from './events.js';
import { UserPreferences } from '../memory/types.js';

export interface PrefilterResult {
  pass: boolean;
  reason?: string;
}

export function prefilterEvent(
  event: OnchainEvent,
  userPreferences: UserPreferences,
  userPortfolio: string[]
): PrefilterResult {
  const { alertThresholds } = userPreferences;

  switch (event.type) {
    case 'price_change': {
      const { tokenMint, changePercent } = event.payload as {
        tokenMint: string;
        changePercent: number;
      };

      const isRelevant =
        userPreferences.tokenWhitelist.includes(tokenMint) ||
        userPortfolio.includes(tokenMint);

      if (!isRelevant) {
        return { pass: false, reason: 'token_not_relevant' };
      }

      if (Math.abs(changePercent) < alertThresholds.priceChangePercent) {
        return { pass: false, reason: 'change_below_threshold' };
      }

      return { pass: true };
    }

    case 'whale_tx': {
      const { tokenMint, amountUsd } = event.payload as {
        tokenMint: string;
        amountUsd: number;
      };

      const isRelevant =
        userPreferences.tokenWhitelist.includes(tokenMint) ||
        userPortfolio.includes(tokenMint);

      if (!isRelevant) {
        return { pass: false, reason: 'token_not_relevant' };
      }

      if (amountUsd < alertThresholds.whaleThresholdUsd) {
        return { pass: false, reason: 'amount_below_threshold' };
      }

      return { pass: true };
    }

    case 'defi_position': {
      // DeFi positions are user-specific and always relevant to the owner,
      // so we skip the token relevance check here and only filter on health ratio.
      const { healthRatio } = event.payload as {
        healthRatio?: number;
      };

      if (healthRatio && healthRatio > alertThresholds.defiHealthRatio) {
        return { pass: false, reason: 'health_ratio_safe' };
      }

      return { pass: true };
    }

    default:
      return { pass: false, reason: 'unknown_event_type' };
  }
}
