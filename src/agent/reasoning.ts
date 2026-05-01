import { generateText, stepCountIs, tool } from 'ai';
import { z } from 'zod';
import { getLLMProvider, getLLMConfig } from '../config/providers.js';
import { SYSTEM_PROMPT, buildReasoningPrompt } from './prompts.js';
import { OnchainEvent } from '../ingestion/events.js';

export interface ReasoningResult {
  decision: 'propose_action' | 'notify_only' | 'ignore';
  reasoning: string;
  confidence: number;
  suggestedAction?: {
    type: 'swap' | 'deposit' | 'withdraw' | 'notify';
    params: Record<string, unknown>;
  };
  toolCalls: Array<{ tool: string; input: unknown; output: unknown }>;
}

const tokenPriceTool = tool({
  description: 'Get current token price from Jupiter',
  inputSchema: z.object({
    mint: z.string().describe('Token mint address'),
  }),
  execute: async ({ mint }: { mint: string }) => {
    const response = await fetch(`https://price.jup.ag/v6/price?ids=${mint}`);
    const data = await response.json() as {
      data: Record<string, { price: number; priceChange24h: number }>;
    };
    return data.data[mint] || { price: 0, priceChange24h: 0 };
  },
});

const userPositionTool = tool({
  description: 'Get user DeFi position',
  inputSchema: z.object({
    wallet: z.string().describe('User wallet address'),
    protocol: z.enum(['marinade', 'kamino', 'marginfi']),
  }),
  execute: async ({ wallet, protocol }: { wallet: string; protocol: 'marinade' | 'kamino' | 'marginfi' }) => {
    return {
      protocol,
      wallet,
      positions: [],
      message: 'Position lookup not implemented yet',
    };
  },
});

const userHistoryTool = tool({
  description: 'Search user decision history via semantic search',
  inputSchema: z.object({
    query: z.string().describe('What to search for in history'),
    limit: z.number().default(5),
  }),
  execute: async ({ query, limit }: { query: string; limit: number }) => {
    return {
      query,
      results: [],
      message: 'History search not implemented yet',
    };
  },
});

export class ReasoningEngine {
  async reason(
    event: OnchainEvent,
    userContext: {
      portfolio: string;
      history: string;
      preferences: Record<string, unknown>;
    }
  ): Promise<ReasoningResult> {
    const tier1Config = getLLMConfig('tier1');
    const tier2Config = getLLMConfig('tier2');

    // Tier 1: Quick triage
    const triageResult = await generateText({
      model: getLLMProvider(tier1Config),
      system: SYSTEM_PROMPT,
      prompt: `Quick triage: Is this event relevant to the user? Event: ${JSON.stringify(event)}. Respond with just "relevant" or "irrelevant" and a one-line reason.`,
      temperature: 0.1,
      maxOutputTokens: 100,
    });

    if (triageResult.text.toLowerCase().includes('irrelevant')) {
      return {
        decision: 'ignore',
        reasoning: triageResult.text,
        confidence: 0.9,
        toolCalls: [],
      };
    }

    // Tier 2: Deep reasoning
    const context = {
      event: JSON.stringify(event, null, 2),
      portfolio: userContext.portfolio,
      history: userContext.history,
      market: 'Market data will be fetched via tools',
    };

    const result = await generateText({
      model: getLLMProvider(tier2Config),
      system: SYSTEM_PROMPT,
      prompt: buildReasoningPrompt(context),
      tools: {
        get_token_price: tokenPriceTool,
        get_user_position: userPositionTool,
        get_user_history: userHistoryTool,
      },
      stopWhen: stepCountIs(5),
      temperature: tier2Config.temperature,
    });

    return {
      decision: 'propose_action',
      reasoning: result.text,
      confidence: 0.7,
      suggestedAction: undefined,
      toolCalls: [],
    };
  }
}
