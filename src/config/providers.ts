import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { env } from './env.js';

export type LLMProvider = 'anthropic' | 'openai' | 'google';
export type LLMTier = 'tier1' | 'tier2';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

const DEFAULT_CONFIGS: Record<LLMTier, LLMConfig> = {
  tier1: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 500,
  },
  tier2: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    temperature: 0.7,
    maxTokens: 2000,
  },
};

export function getLLMProvider(config: LLMConfig) {
  switch (config.provider) {
    case 'anthropic':
      return anthropic(config.model);
    case 'openai':
      return openai(config.model);
    case 'google':
      return google(config.model);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

export function getLLMConfig(tier: LLMTier, overrides?: Partial<LLMConfig>): LLMConfig {
  return { ...DEFAULT_CONFIGS[tier], ...overrides };
}
