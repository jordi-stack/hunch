export interface EpisodicMemoryData {
  userId: string;
  eventType: 'price_change' | 'whale_tx' | 'defi_position';
  eventPayload: Record<string, unknown>;
  reasoningTrace: string;
  confidence: number;
  actionType?: 'swap' | 'deposit' | 'withdraw' | 'notify';
  actionPayload?: Record<string, unknown>;
  userResponse?: 'approved' | 'skipped' | 'timeout';
  executedAt?: Date;
  executionResult?: Record<string, unknown>;
}

export interface SemanticMemoryData {
  userId: string;
  key: string;
  value: string;
  confidence: number;
  source: 'consolidation' | 'explicit_setting';
  embedding?: number[]; // Vector embedding
}

export interface UserPreferences {
  alertThresholds: {
    priceChangePercent: number;
    whaleThresholdSol: number;
    defiHealthRatio: number;
  };
  confidenceThreshold: number;
  autoExecute: boolean;
  dailySpendingCap: number;
  tokenWhitelist: string[];
  protocolWhitelist: string[];
}
