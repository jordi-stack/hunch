import { generateText, generateObject, stepCountIs, tool } from 'ai';
import { z } from 'zod';
import { getLLMProvider, getLLMConfig } from '../config/providers.js';
import { SYSTEM_PROMPT, buildReasoningPrompt } from './prompts.js';
import { OnchainEvent } from '../ingestion/events.js';
import { getTokenPrice, getTokenInfo } from '../ingestion/jupiter.js';
import { EpisodicMemory } from '../memory/episodic.js';
import { env } from '../config/env.js';

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

const decisionSchema = z.object({
  decision: z.enum(['propose_action', 'notify_only', 'ignore']),
  confidence: z.number().min(0).max(1),
  action: z
    .object({
      type: z.enum(['swap', 'deposit', 'withdraw', 'notify']),
      params: z
        .object({
          fromMint: z.string().optional(),
          toMint: z.string().optional(),
          amountUsd: z.number().optional(),
          protocol: z.enum(['marinade', 'kamino', 'marginfi']).optional(),
          reason: z.string().optional(),
        })
        .passthrough(),
    })
    .nullable(),
});

interface UserContext {
  userId: string;
  walletAddress: string | null;
  portfolio: string;
  history: string;
  preferences: Record<string, unknown>;
}

function buildTools(ctx: UserContext, episodic: EpisodicMemory) {
  return {
    get_token_price: tool({
      description: 'Get current USD price and 24h change for a token mint from Jupiter.',
      inputSchema: z.object({
        mint: z.string().describe('Token mint address'),
      }),
      execute: async ({ mint }: { mint: string }) => {
        const [price, info] = await Promise.all([getTokenPrice(mint), getTokenInfo(mint)]);
        if (!price) return { mint, error: 'price_unavailable' };
        return {
          mint,
          symbol: info?.symbol ?? 'UNKNOWN',
          priceUsd: price.price,
          change24hPercent: price.priceChange24h,
        };
      },
    }),

    get_wallet_holdings: tool({
      description: 'List the SPL token holdings of the user wallet via Helius DAS.',
      inputSchema: z.object({}),
      execute: async () => {
        if (!ctx.walletAddress) return { error: 'no_wallet_linked' };
        try {
          const res = await fetch(
            `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 'holdings',
                method: 'getAssetsByOwner',
                params: {
                  ownerAddress: ctx.walletAddress,
                  page: 1,
                  limit: 50,
                  displayOptions: { showFungible: true },
                },
              }),
            },
          );
          if (!res.ok) return { error: `helius_${res.status}` };
          const json = (await res.json()) as {
            result?: {
              items?: Array<{
                id: string;
                content?: { metadata?: { symbol?: string; name?: string } };
                token_info?: { balance?: number; decimals?: number; price_info?: { total_price?: number } };
              }>;
            };
          };
          const items = json.result?.items ?? [];
          const holdings = items
            .filter((i) => i.token_info?.balance && (i.token_info.balance ?? 0) > 0)
            .map((i) => ({
              mint: i.id,
              symbol: i.content?.metadata?.symbol ?? 'UNKNOWN',
              balance: (i.token_info?.balance ?? 0) / Math.pow(10, i.token_info?.decimals ?? 0),
              valueUsd: i.token_info?.price_info?.total_price ?? 0,
            }))
            .sort((a, b) => b.valueUsd - a.valueUsd)
            .slice(0, 20);
          return { wallet: ctx.walletAddress, holdings };
        } catch (err) {
          return { error: `helius_fetch_failed: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    }),

    get_similar_decisions: tool({
      description: 'Search past decisions of the user for the same event type to learn from prior outcomes.',
      inputSchema: z.object({
        eventType: z.enum(['price_change', 'whale_tx', 'defi_position']),
        limit: z.number().min(1).max(20).default(5),
      }),
      execute: async ({ eventType, limit }: { eventType: 'price_change' | 'whale_tx' | 'defi_position'; limit: number }) => {
        const records = await episodic.getSimilarDecisions(ctx.userId, eventType, limit);
        return {
          count: records.length,
          decisions: records.map((r) => ({
            event: r.eventPayload,
            confidence: r.confidence,
            actionType: r.actionType ?? null,
            userResponse: r.userResponse ?? null,
            pnl24h: r.pnl24h ?? null,
          })),
        };
      },
    }),
  };
}

export class ReasoningEngine {
  constructor(private episodic: EpisodicMemory) {}

  async reason(event: OnchainEvent, userContext: UserContext): Promise<ReasoningResult> {
    const tier1Config = getLLMConfig('tier1');
    const tier2Config = getLLMConfig('tier2');

    // Tier 1: cheap triage
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
    const isIrrelevant = verdictMatch
      ? verdictMatch[1].toUpperCase() === 'IRRELEVANT'
      : triageResult.text.toLowerCase().includes('irrelevant');

    if (isIrrelevant) {
      return {
        decision: 'ignore',
        reasoning: triageResult.text,
        confidence: 0.9,
        toolCalls: [],
      };
    }

    // Tier 2: deep reasoning with tools (real data, not stubs)
    const tools = buildTools(userContext, this.episodic);

    const promptContext = {
      event: JSON.stringify(event, null, 2),
      portfolio: userContext.portfolio,
      history: userContext.history,
      market: 'Use get_token_price tool to fetch current market data.',
    };

    const result = await generateText({
      model: getLLMProvider(tier2Config),
      system: SYSTEM_PROMPT,
      prompt: buildReasoningPrompt(promptContext),
      tools,
      stopWhen: stepCountIs(5),
      temperature: tier2Config.temperature,
    });

    const toolCalls: Array<{ tool: string; input: unknown; output: unknown }> = [];
    if (result.steps) {
      for (const step of result.steps) {
        if (step.toolCalls) {
          for (const tc of step.toolCalls) {
            // AI SDK v6: tc.input + tr.output (was tc.args + tr.result in v4).
            const tcAny = tc as unknown as { toolName: string; toolCallId: string; input: unknown };
            const match = step.toolResults?.find((r) => r.toolCallId === tcAny.toolCallId) as
              | { output: unknown }
              | undefined;
            toolCalls.push({
              tool: tcAny.toolName,
              input: tcAny.input,
              output: match?.output,
            });
          }
        }
      }
    }

    // Final structured decision from the same tier-2 model.
    const structured = await generateObject({
      model: getLLMProvider(tier2Config),
      system: SYSTEM_PROMPT,
      schema: decisionSchema,
      prompt: `Given the reasoning below, output the final structured decision.
If decision is "propose_action", action MUST be non-null with concrete params (mints, USD amount, protocol).
If decision is "notify_only" or "ignore", action MUST be null.

Reasoning:
${result.text}

Original event:
${JSON.stringify(event, null, 2)}`,
      temperature: 0.1,
    });

    return {
      decision: structured.object.decision,
      reasoning: result.text,
      confidence: structured.object.confidence,
      suggestedAction: structured.object.action
        ? { type: structured.object.action.type, params: structured.object.action.params }
        : undefined,
      toolCalls,
    };
  }
}
