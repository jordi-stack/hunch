export interface EpisodicMemoryData {
  userId: string;
  eventType: 'price_change' | 'whale_tx' | 'defi_position';
  eventPayload: Record<string, unknown>;
  reasoningTrace: string;
  confidence: number;
  actionType?: 'swap' | 'deposit' | 'withdraw' | 'notify';
  actionPayload?: Record<string, unknown>;
  toolCalls?: Array<{ tool: string; input: unknown; output: unknown }>;
  userResponse?: 'approved' | 'skipped' | 'timeout';
  executedAt?: Date;
  executionResult?: Record<string, unknown>;
  pnl1h?: number;
  pnl24h?: number;
  pnl7d?: number;
}

export interface ProcessedEventData {
  eventSignature: string;
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
    whaleThresholdUsd: number;
    defiHealthRatio: number;
  };
  confidenceThreshold: number;
  autoExecute: boolean;
  dailySpendingCap: number;
  tokenWhitelist: string[];
  protocolWhitelist: string[];
}
