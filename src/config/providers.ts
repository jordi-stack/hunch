import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { openrouter } from '@openrouter/ai-sdk-provider';
import { env } from './env.js';

export type LLMProvider = 'anthropic' | 'openai' | 'google' | 'openrouter';
export type LLMTier = 'tier1' | 'tier2';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

const DEFAULT_CONFIGS: Record<LLMTier, LLMConfig> = {
  tier1: {
    provider: 'openrouter',
    model: 'openai/gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 500,
  },
  tier2: {
    provider: 'openrouter',
    model: 'google/gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 2000,
  },
};

function assertProviderKey(provider: LLMProvider): void {
  const required: Record<LLMProvider, string | undefined> = {
    anthropic: env.ANTHROPIC_API_KEY,
    openai: env.OPENAI_API_KEY,
    google: env.GOOGLE_API_KEY,
    openrouter: env.OPENROUTER_API_KEY,
  };
  if (!required[provider]) {
    throw new Error(
      `Missing API key for provider "${provider}". Set the corresponding *_API_KEY in .env.`,
    );
  }
}

export function getLLMProvider(config: LLMConfig) {
  assertProviderKey(config.provider);
  switch (config.provider) {
    case 'anthropic':
      return anthropic(config.model);
    case 'openai':
      return openai(config.model);
    case 'google':
      return google(config.model);
    case 'openrouter':
      return openrouter(config.model);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

// Boot-time validation: fail fast if defaults reference a provider whose key is missing.
export function validateDefaultProviders(): void {
  for (const tier of ['tier1', 'tier2'] as LLMTier[]) {
    assertProviderKey(DEFAULT_CONFIGS[tier].provider);
  }
}

export function getLLMConfig(tier: LLMTier, overrides?: Partial<LLMConfig>): LLMConfig {
  return { ...DEFAULT_CONFIGS[tier], ...overrides };
}
