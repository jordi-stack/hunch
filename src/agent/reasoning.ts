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
    try {
      const response = await fetch(`https://price.jup.ag/v6/price?ids=${mint}`);
      if (!response.ok) {
        return { price: 0, priceChange24h: 0, error: `Jupiter API returned ${response.status}` };
      }
      const data = await response.json() as {
        data: Record<string, { price: number; priceChange24h: number }>;
      };
      return data.data[mint] || { price: 0, priceChange24h: 0, error: 'Token not found' };
    } catch (err) {
      return { price: 0, priceChange24h: 0, error: `Jupiter fetch failed: ${err}` };
    }
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

    // Tier 1: Quick triage with structured output
    const triageResult = await generateText({
      model: getLLMProvider(tier1Config),
      system: SYSTEM_PROMPT,
      prompt: `Quick triage: Is this event relevant to the user? Event: ${JSON.stringify(event)}.
Respond with EXACTLY one of these lines first:
VERDICT: RELEVANT
VERDICT: IRRELEVANT
Then a one-line reason.`,
      temperature: 0.1,
      maxOutputTokens: 100,
    });

    const verdictMatch = triageResult.text.match(/VERDICT:\s*(RELEVANT|IRRELEVANT)/i);
    const isIrrelevant = verdictMatch ? verdictMatch[1].toUpperCase() === 'IRRELEVANT' : triageResult.text.toLowerCase().includes('irrelevant');

    if (isIrrelevant) {
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

    // Extract tool calls from result steps
    const toolCalls: Array<{ tool: string; input: unknown; output: unknown }> = [];
    if (result.steps) {
      for (const step of result.steps) {
        if (step.toolCalls) {
          for (const tc of step.toolCalls) {
            toolCalls.push({
              tool: tc.toolName,
              input: tc.args,
              output: step.toolResults?.find(r => r.toolCallId === tc.toolCallId)?.result,
            });
          }
        }
      }
    }

    // Parse LLM output for suggested action
    const actionMatch = result.text.match(/ACTION:\s*(swap|deposit|withdraw|notify)/i);
    const suggestedAction = actionMatch ? {
      type: actionMatch[1].toLowerCase() as 'swap' | 'deposit' | 'withdraw' | 'notify',
      params: {},
    } : undefined;

    // Parse confidence from LLM output
    const confMatch = result.text.match(/CONFIDENCE:\s*([\d.]+)/);
    const confidence = confMatch ? Math.min(1, Math.max(0, parseFloat(confMatch[1]))) : 0.7;

    return {
      decision: suggestedAction ? 'propose_action' : 'notify_only',
      reasoning: result.text,
      confidence,
      suggestedAction,
      toolCalls,
    };
  }
}
