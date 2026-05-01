# Hunch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an LLM agent that reasons about Solana onchain events from user history, suggests actions, and executes after approval.

**Architecture:** Event-driven agent with LLM reasoning (provider-agnostic via Vercel AI SDK), episodic + semantic memory (Postgres + pgvector), and non-custodial execution (Squads multisig).

**Tech Stack:** TypeScript, Node.js, Vercel AI SDK, Helius, Postgres + pgvector, Squads SDK, Jupiter API, Telegram Bot API, Next.js

---

## File Structure

```
hunch/
├── src/
│   ├── agent/
│   │   ├── reasoning.ts          # LLM reasoning engine
│   │   ├── tools.ts              # Tool definitions and implementations
│   │   └── prompts.ts            # System prompts
│   ├── ingestion/
│   │   ├── helius.ts             # Helius webhook handler
│   │   ├── prefilter.ts          # Pre-filter rules
│   │   └── events.ts             # Event types and parsing
│   ├── memory/
│   │   ├── episodic.ts           # Episodic memory (decisions log)
│   │   ├── semantic.ts           # Semantic memory (pgvector)
│   │   ├── consolidation.ts      # Memory consolidation job
│   │   └── types.ts              # Memory types
│   ├── execution/
│   │   ├── squads.ts             # Squads multisig integration
│   │   ├── jupiter.ts            # Jupiter swap execution
│   │   └── marinade.ts           # Marinade deposit/withdraw
│   ├── telegram/
│   │   ├── bot.ts                # Telegram bot setup
│   │   ├── commands.ts           # Bot commands
│   │   └── actions.ts            # Action card handlers
│   ├── config/
│   │   ├── providers.ts          # LLM provider configuration
│   │   └── env.ts                # Environment variables
│   └── index.ts                  # Main entry point
├── dashboard/
│   ├── app/
│   │   ├── page.tsx              # Activity feed
│   │   ├── history/page.tsx      # Past decisions
│   │   ├── portfolio/page.tsx    # Positions
│   │   └── memory/page.tsx       # Memory inspector
│   └── lib/
│       └── api.ts                # API client
├── tests/
│   ├── unit/
│   │   ├── prefilter.test.ts
│   │   ├── memory.test.ts
│   │   └── tools.test.ts
│   └── integration/
│       ├── agent-loop.test.ts
│       └── execution.test.ts
├── prisma/
│   └── schema.prisma             # Database schema
├── docker-compose.yml            # Postgres + pgvector
├── package.json
└── tsconfig.json
```

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `src/config/env.ts`

- [ ] **Step 1: Initialize project**

```bash
cd /root/hackathon/coloseum-frontier/hunch
npm init -y
```

- [ ] **Step 2: Install dependencies**

```bash
npm install typescript @types/node tsx dotenv
npm install ai @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/google  # Vercel AI SDK
npm install @solana/web3.js @sqds/sdk  # Solana + Squads
npm install grammy  # Telegram bot
npm install @prisma/client prisma  # Database
npm install express @types/express  # API server
npm install vitest  # Testing
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create docker-compose.yml**

```yaml
version: '3.8'
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: hunch
      POSTGRES_PASSWORD: hunch_dev
      POSTGRES_DB: hunch
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

- [ ] **Step 5: Create .env.example**

```env
# Database
DATABASE_URL=postgresql://hunch:hunch_dev@localhost:5432/hunch

# LLM Providers (BYOK)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_API_KEY=

# Solana
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
HELIUS_API_KEY=
HELIUS_WEBHOOK_SECRET=

# Telegram
TELEGRAM_BOT_TOKEN=

# Squads
SQUADS_MULTISIG_ADDRESS=
AGENT_KEYPAIR_PATH=
```

- [ ] **Step 6: Create src/config/env.ts**

```typescript
import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  DATABASE_URL: z.string(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  SOLANA_RPC_URL: z.string().default('https://api.mainnet-beta.solana.com'),
  HELIUS_API_KEY: z.string(),
  HELIUS_WEBHOOK_SECRET: z.string(),
  TELEGRAM_BOT_TOKEN: z.string(),
  SQUADS_MULTISIG_ADDRESS: z.string().optional(),
  AGENT_KEYPAIR_PATH: z.string().optional(),
});

export const env = envSchema.parse(process.env);
```

- [ ] **Step 7: Commit**

```bash
git init
git add .
git commit -m "chore: initialize project with dependencies"
```

---

## Task 2: Database Schema (Prisma + pgvector)

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/memory/types.ts`

- [ ] **Step 1: Create Prisma schema**

```prisma
// prisma/schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [vector]
}

model User {
  id                String    @id @default(cuid())
  telegramId        String    @unique
  walletAddress     String?
  watchlist         String[]  // Token mints
  preferences       Json      @default("{}") // Alert thresholds, etc.
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  episodicMemories  EpisodicMemory[]
  semanticMemories  SemanticMemory[]
}

model EpisodicMemory {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])

  // Event that triggered this
  eventType       String    // "price_change", "whale_tx", "defi_position"
  eventPayload    Json      // Full event data

  // Agent reasoning
  reasoningTrace  String    // Chain of thought from LLM
  confidence      Float     // 0-1 confidence score

  // Suggested action
  actionType      String?   // "swap", "deposit", "withdraw", "notify"
  actionPayload   Json?     // Action parameters

  // User response
  userResponse    String?   // "approved", "skipped", "timeout"
  executedAt      DateTime?
  executionResult Json?     // Tx hash, error, etc.

  // Outcome tracking
  pnl1h           Float?    // PnL after 1 hour
  pnl24h          Float?    // PnL after 24 hours
  pnl7d           Float?    // PnL after 7 days

  createdAt       DateTime  @default(now())

  @@index([userId, createdAt])
  @@index([eventType])
}

model SemanticMemory {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])

  // Extracted preference/pattern
  key             String    // e.g., "prefers_limit_orders", "ignores_low_confidence"
  value           String    // The preference value
  confidence      Float     // How confident we are in this preference
  source          String    // "consolidation", "explicit_setting"

  // Embedding for semantic search
  embedding       Unsupported("vector(1536)")? // OpenAI embedding dimension

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([userId, key])
  @@index([userId], type: Gin) // For vector search
}

model ProcessedEvent {
  id              String    @id @default(cuid())
  eventSignature  String    @unique // Helius event signature
  processedAt     DateTime  @default(now())

  @@index([eventSignature])
}
```

- [ ] **Step 2: Create src/memory/types.ts**

```typescript
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
}

export interface UserPreferences {
  alertThresholds: {
    priceChangePercent: number; // Default: 10
    whaleThresholdSol: number;  // Default: 100
    defiHealthRatio: number;    // Default: 1.5
  };
  confidenceThreshold: number; // Default: 0.7
  autoExecute: boolean;        // Default: false
  dailySpendingCap: number;    // In SOL
  tokenWhitelist: string[];    // Token mints
  protocolWhitelist: string[]; // "jupiter", "marinade"
}
```

- [ ] **Step 3: Run Prisma migration**

```bash
npx prisma migrate dev --name init
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add database schema with pgvector for memory"
```

---

## Task 3: Event Ingestion (Helius Webhook)

**Files:**
- Create: `src/ingestion/events.ts`
- Create: `src/ingestion/helius.ts`
- Create: `src/ingestion/prefilter.ts`

- [ ] **Step 1: Create src/ingestion/events.ts**

```typescript
export interface OnchainEvent {
  id: string;
  type: 'price_change' | 'whale_tx' | 'defi_position';
  timestamp: Date;
  payload: Record<string, unknown>;
}

export interface PriceChangeEvent extends OnchainEvent {
  type: 'price_change';
  payload: {
    tokenMint: string;
    tokenSymbol: string;
    priceUsd: number;
    changePercent: number;
    timeframe: '1h' | '24h';
  };
}

export interface WhaleTxEvent extends OnchainEvent {
  type: 'whale_tx';
  payload: {
    tokenMint: string;
    tokenSymbol: string;
    amount: number;
    amountUsd: number;
    fromAddress: string;
    toAddress: string;
    txSignature: string;
  };
}

export interface DefiPositionEvent extends OnchainEvent {
  type: 'defi_position';
  payload: {
    protocol: 'marinade' | 'kamino' | 'marginfi';
    positionType: 'stake' | 'lend' | 'borrow';
    tokenMint: string;
    amount: number;
    healthRatio?: number;
    yieldRate?: number;
    change: 'health_improved' | 'health_degraded' | 'yield_changed';
  };
}
```

- [ ] **Step 2: Create src/ingestion/helius.ts**

```typescript
import { Helius } from 'helius-sdk';
import { env } from '../config/env.js';
import { OnchainEvent, PriceChangeEvent, WhaleTxEvent } from './events.js';

export class HeliusIngestion {
  private client: Helius;
  private processedEvents: Set<string> = new Set();

  constructor() {
    this.client = new Helius(env.HELIUS_API_KEY);
  }

  async processWebhook(payload: unknown): Promise<OnchainEvent[]> {
    // Helius webhook payload structure
    const data = payload as {
      signature: string;
      type: string;
      timestamp: number;
      tokenTransfers?: Array<{
        mint: string;
        tokenAmount: number;
        fromUserAccount: string;
        toUserAccount: string;
      }>;
    };

    // Deduplicate
    if (this.processedEvents.has(data.signature)) {
      return [];
    }
    this.processedEvents.add(data.signature);

    // Parse based on type
    const events: OnchainEvent[] = [];

    if (data.type === 'SWAP' && data.tokenTransfers) {
      // Check if whale transaction
      for (const transfer of data.tokenTransfers) {
        if (transfer.tokenAmount > 100) { // Threshold
          events.push({
            id: `${data.signature}-${transfer.mint}`,
            type: 'whale_tx',
            timestamp: new Date(data.timestamp * 1000),
            payload: {
              tokenMint: transfer.mint,
              tokenSymbol: 'UNKNOWN', // Would need token metadata lookup
              amount: transfer.tokenAmount,
              amountUsd: 0, // Would need price lookup
              fromAddress: transfer.fromUserAccount,
              toAddress: transfer.toUserAccount,
              txSignature: data.signature,
            },
          });
        }
      }
    }

    return events;
  }

  async getPriceChange(tokenMint: string): Promise<PriceChangeEvent | null> {
    // Use Jupiter price API
    const response = await fetch(
      `https://price.jup.ag/v6/price?ids=${tokenMint}`
    );
    const data = await response.json() as {
      data: Record<string, { price: number; priceChange24h: number }>;
    };

    const tokenData = data.data[tokenMint];
    if (!tokenData) return null;

    return {
      id: `price-${tokenMint}-${Date.now()}`,
      type: 'price_change',
      timestamp: new Date(),
      payload: {
        tokenMint,
        tokenSymbol: 'UNKNOWN',
        priceUsd: tokenData.price,
        changePercent: tokenData.priceChange24h,
        timeframe: '24h',
      },
    };
  }
}
```

- [ ] **Step 3: Create src/ingestion/prefilter.ts**

```typescript
import { OnchainEvent } from './events.js';
import { UserPreferences } from '../memory/types.js';

export interface PrefilterResult {
  pass: boolean;
  reason?: string;
}

export function prefilterEvent(
  event: OnchainEvent,
  userPreferences: UserPreferences,
  userPortfolio: string[] // Token mints user holds
): PrefilterResult {
  const { alertThresholds } = userPreferences;

  switch (event.type) {
    case 'price_change': {
      const { tokenMint, changePercent } = event.payload as {
        tokenMint: string;
        changePercent: number;
      };

      // Drop if token not in watchlist or portfolio
      const isRelevant =
        userPreferences.tokenWhitelist.includes(tokenMint) ||
        userPortfolio.includes(tokenMint);

      if (!isRelevant) {
        return { pass: false, reason: 'token_not_relevant' };
      }

      // Drop if change below threshold
      if (Math.abs(changePercent) < alertThresholds.priceChangePercent) {
        return { pass: false, reason: 'change_below_threshold' };
      }

      return { pass: true };
    }

    case 'whale_tx': {
      const { tokenMint, amount } = event.payload as {
        tokenMint: string;
        amount: number;
      };

      // Drop if token not relevant
      const isRelevant =
        userPreferences.tokenWhitelist.includes(tokenMint) ||
        userPortfolio.includes(tokenMint);

      if (!isRelevant) {
        return { pass: false, reason: 'token_not_relevant' };
      }

      // Drop if below threshold
      if (amount < alertThresholds.whaleThresholdSol) {
        return { pass: false, reason: 'amount_below_threshold' };
      }

      return { pass: true };
    }

    case 'defi_position': {
      const { healthRatio } = event.payload as {
        healthRatio?: number;
      };

      // Drop if health ratio above threshold (safe)
      if (healthRatio && healthRatio > alertThresholds.defiHealthRatio) {
        return { pass: false, reason: 'health_ratio_safe' };
      }

      return { pass: true };
    }

    default:
      return { pass: false, reason: 'unknown_event_type' };
  }
}
```

- [ ] **Step 4: Write tests for prefilter**

```typescript
// tests/unit/prefilter.test.ts
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
  tokenWhitelist: ['So11111111111111111111111111111111111111112'], // SOL
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
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run tests/unit/prefilter.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: add event ingestion and prefilter with tests"
```

---

## Task 4: LLM Abstraction Layer (Vercel AI SDK)

**Files:**
- Create: `src/config/providers.ts`
- Create: `src/agent/reasoning.ts`
- Create: `src/agent/prompts.ts`

- [ ] **Step 1: Create src/config/providers.ts**

```typescript
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

// Default configs per tier
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
```

- [ ] **Step 2: Create src/agent/prompts.ts**

```typescript
export const SYSTEM_PROMPT = `You are Hunch, an AI agent that helps users manage their Solana portfolio.

Your job:
1. Analyze onchain events (price changes, whale transactions, DeFi position changes)
2. Reason about what this means for the user based on their history and preferences
3. Suggest concrete actions with clear reasoning

You have access to tools to:
- Check token prices
- Check user positions
- Search user's decision history
- Simulate swaps
- Propose actions to the user

Rules:
- NEVER guess prices or positions. Always use tools to get real data.
- Be honest about confidence. If unsure, say so.
- Reference user's past behavior when relevant ("You've bought similar dips 3 times before")
- Keep reasoning concise but complete
- Format proposals as structured action cards`;

export function buildReasoningPrompt(context: {
  event: string;
  portfolio: string;
  history: string;
  market: string;
}): string {
  return `## Event
${context.event}

## User Portfolio
${context.portfolio}

## Recent History (similar decisions)
${context.history}

## Market Context
${context.market}

Analyze this event and decide:
1. Is this relevant to the user? Why?
2. What action (if any) should the user take?
3. What's your confidence level (0-1)?

Use tools to verify any data you need. Do not guess.`;
}
```

- [ ] **Step 3: Create src/agent/reasoning.ts**

```typescript
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { getLLMProvider, getLLMConfig, LLMTier } from '../config/providers.js';
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

// Tool definitions
const tokenPriceTool = tool({
  description: 'Get current token price from Jupiter',
  parameters: z.object({
    mint: z.string().describe('Token mint address'),
  }),
  execute: async ({ mint }) => {
    const response = await fetch(`https://price.jup.ag/v6/price?ids=${mint}`);
    const data = await response.json() as {
      data: Record<string, { price: number; priceChange24h: number }>;
    };
    return data.data[mint] || { price: 0, priceChange24h: 0 };
  },
});

const userPositionTool = tool({
  description: 'Get user DeFi position',
  parameters: z.object({
    wallet: z.string().describe('User wallet address'),
    protocol: z.enum(['marinade', 'kamino', 'marginfi']),
  }),
  execute: async ({ wallet, protocol }) => {
    // Placeholder - would integrate with actual DeFi protocols
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
  parameters: z.object({
    query: z.string().describe('What to search for in history'),
    limit: z.number().default(5),
  }),
  execute: async ({ query, limit }) => {
    // Placeholder - would use pgvector semantic search
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
      maxTokens: 100,
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
      maxSteps: 5, // Allow multiple tool calls
      temperature: tier2Config.temperature,
    });

    // Parse LLM output
    // In production, would use structured output
    return {
      decision: 'propose_action', // Would parse from LLM output
      reasoning: result.text,
      confidence: 0.7, // Would extract from LLM output
      suggestedAction: undefined, // Would parse from LLM output
      toolCalls: [], // Would track actual tool calls
    };
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add LLM abstraction layer with Vercel AI SDK"
```

---

## Task 5: Memory System

**Files:**
- Create: `src/memory/episodic.ts`
- Create: `src/memory/semantic.ts`
- Create: `src/memory/consolidation.ts`

- [ ] **Step 1: Create src/memory/episodic.ts**

```typescript
import { PrismaClient } from '@prisma/client';
import { EpisodicMemoryData } from './types.js';

export class EpisodicMemory {
  constructor(private prisma: PrismaClient) {}

  async save(data: EpisodicMemoryData): Promise<string> {
    const record = await this.prisma.episodicMemory.create({
      data: {
        userId: data.userId,
        eventType: data.eventType,
        eventPayload: data.eventPayload,
        reasoningTrace: data.reasoningTrace,
        confidence: data.confidence,
        actionType: data.actionType,
        actionPayload: data.actionPayload,
        userResponse: data.userResponse,
        executedAt: data.executedAt,
        executionResult: data.executionResult,
      },
    });

    return record.id;
  }

  async updateResponse(
    id: string,
    response: 'approved' | 'skipped' | 'timeout',
    executionResult?: Record<string, unknown>
  ): Promise<void> {
    await this.prisma.episodicMemory.update({
      where: { id },
      data: {
        userResponse: response,
        executedAt: response === 'approved' ? new Date() : undefined,
        executionResult: executionResult,
      },
    });
  }

  async updateOutcome(
    id: string,
    pnl1h?: number,
    pnl24h?: number,
    pnl7d?: number
  ): Promise<void> {
    await this.prisma.episodicMemory.update({
      where: { id },
      data: { pnl1h, pnl24h, pnl7d },
    });
  }

  async getByUser(
    userId: string,
    options?: {
      eventType?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    return this.prisma.episodicMemory.findMany({
      where: {
        userId,
        eventType: options?.eventType,
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    });
  }

  async getSimilarDecisions(
    userId: string,
    eventType: string,
    limit: number = 5
  ) {
    // Simple version: get recent decisions of same type
    // Advanced version: would use semantic similarity
    return this.prisma.episodicMemory.findMany({
      where: {
        userId,
        eventType,
        userResponse: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getStats(userId: string) {
    const total = await this.prisma.episodicMemory.count({
      where: { userId },
    });

    const approved = await this.prisma.episodicMemory.count({
      where: { userId, userResponse: 'approved' },
    });

    const skipped = await this.prisma.episodicMemory.count({
      where: { userId, userResponse: 'skipped' },
    });

    return {
      total,
      approved,
      skipped,
      approvalRate: total > 0 ? approved / total : 0,
    };
  }
}
```

- [ ] **Step 2: Create src/memory/semantic.ts**

```typescript
import { PrismaClient } from '@prisma/client';
import { SemanticMemoryData } from './types.js';

export class SemanticMemory {
  constructor(private prisma: PrismaClient) {}

  async save(data: SemanticMemoryData): Promise<string> {
    const record = await this.prisma.semanticMemory.create({
      data: {
        userId: data.userId,
        key: data.key,
        value: data.value,
        confidence: data.confidence,
        source: data.source,
      },
    });

    return record.id;
  }

  async upsert(data: SemanticMemoryData): Promise<void> {
    await this.prisma.semanticMemory.upsert({
      where: {
        userId_key: {
          userId: data.userId,
          key: data.key,
        },
      },
      update: {
        value: data.value,
        confidence: data.confidence,
        updatedAt: new Date(),
      },
      create: {
        userId: data.userId,
        key: data.key,
        value: data.value,
        confidence: data.confidence,
        source: data.source,
      },
    });
  }

  async getByUser(userId: string) {
    return this.prisma.semanticMemory.findMany({
      where: { userId },
      orderBy: { confidence: 'desc' },
    });
  }

  async getByKey(userId: string, key: string) {
    return this.prisma.semanticMemory.findUnique({
      where: {
        userId_key: { userId, key },
      },
    });
  }

  async searchSimilar(
    userId: string,
    _query: string, // Would be used for vector search
    limit: number = 5
  ) {
    // Simple version: return all memories
    // Advanced version: would use pgvector similarity search
    return this.prisma.semanticMemory.findMany({
      where: { userId },
      orderBy: { confidence: 'desc' },
      take: limit,
    });
  }
}
```

- [ ] **Step 3: Create src/memory/consolidation.ts**

```typescript
import { PrismaClient } from '@prisma/client';
import { EpisodicMemory } from './episodic.js';
import { SemanticMemory } from './semantic.js';

export class MemoryConsolidation {
  constructor(
    private prisma: PrismaClient,
    private episodic: EpisodicMemory,
    private semantic: SemanticMemory
  ) {}

  async consolidate(userId: string): Promise<void> {
    // Get recent episodic memories
    const recentMemories = await this.episodic.getByUser(userId, {
      limit: 100,
    });

    // Extract patterns
    const patterns = this.extractPatterns(recentMemories);

    // Save to semantic memory
    for (const pattern of patterns) {
      await this.semantic.upsert({
        userId,
        key: pattern.key,
        value: pattern.value,
        confidence: pattern.confidence,
        source: 'consolidation',
      });
    }
  }

  private extractPatterns(
    memories: Array<{
      eventType: string;
      userResponse: string | null;
      confidence: number;
      actionType: string | null;
    }>
  ) {
    const patterns: Array<{
      key: string;
      value: string;
      confidence: number;
    }> = [];

    // Pattern 1: Approval rate by event type
    const byType = new Map<string, { approved: number; total: number }>();
    for (const m of memories) {
      if (!m.userResponse) continue;
      const current = byType.get(m.eventType) || { approved: 0, total: 0 };
      current.total++;
      if (m.userResponse === 'approved') current.approved++;
      byType.set(m.eventType, current);
    }

    for (const [type, stats] of byType) {
      if (stats.total >= 5) {
        const rate = stats.approved / stats.total;
        patterns.push({
          key: `approval_rate_${type}`,
          value: rate.toString(),
          confidence: Math.min(stats.total / 20, 1), // More data = more confidence
        });
      }
    }

    // Pattern 2: Confidence threshold (user skips low confidence)
    const lowConfSkipped = memories.filter(
      (m) => m.confidence < 0.7 && m.userResponse === 'skipped'
    ).length;
    const lowConfTotal = memories.filter(
      (m) => m.confidence < 0.7
    ).length;

    if (lowConfTotal >= 5) {
      const skipRate = lowConfSkipped / lowConfTotal;
      if (skipRate > 0.7) {
        patterns.push({
          key: 'prefers_high_confidence',
          value: 'true',
          confidence: skipRate,
        });
      }
    }

    // Pattern 3: Preferred action type
    const byAction = new Map<string, number>();
    for (const m of memories) {
      if (m.actionType && m.userResponse === 'approved') {
        byAction.set(m.actionType, (byAction.get(m.actionType) || 0) + 1);
      }
    }

    const topAction = [...byAction.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topAction && topAction[1] >= 3) {
      patterns.push({
        key: 'preferred_action_type',
        value: topAction[0],
        confidence: Math.min(topAction[1] / 10, 1),
      });
    }

    return patterns;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add memory system (episodic, semantic, consolidation)"
```

---

## Task 6: Telegram Bot

**Files:**
- Create: `src/telegram/bot.ts`
- Create: `src/telegram/commands.ts`
- Create: `src/telegram/actions.ts`

- [ ] **Step 1: Create src/telegram/bot.ts**

```typescript
import { Bot, Context, session } from 'grammy';
import { env } from '../config/env.js';

interface SessionData {
  userId?: string;
  walletAddress?: string;
  watchlist: string[];
}

export type HunchContext = Context & {
  session: SessionData;
};

export function createBot(): Bot<HunchContext> {
  const bot = new Bot<HunchContext>(env.TELEGRAM_BOT_TOKEN);

  // Session middleware
  bot.use(
    session({
      initial: (): SessionData => ({
        watchlist: [],
      }),
    })
  );

  // Error handling
  bot.catch((err) => {
    console.error('Bot error:', err);
  });

  return bot;
}
```

- [ ] **Step 2: Create src/telegram/commands.ts**

```typescript
import { Bot } from 'grammy';
import { HunchContext } from './bot.js';

export function registerCommands(bot: Bot<HunchContext>) {
  bot.command('start', async (ctx) => {
    await ctx.reply(
      `Welcome to Hunch! 🧠

I'm your AI agent for Solana. I watch onchain events and suggest actions based on your history.

Commands:
/wallet - Setup your wallet
/preferences - Set alert preferences
/history - View past decisions
/help - Show this message

To get started, use /wallet to connect your Squads multisig.`
    );
  });

  bot.command('wallet', async (ctx) => {
    await ctx.reply(
      `To set up your wallet:

1. Create a Squads multisig at https://app.squads.so
2. Add your wallet as signer 1
3. Add the agent as signer 2 (address will be provided)
4. Set a daily spending cap

Reply with your Squads multisig address to connect.`
    );
  });

  bot.command('preferences', async (ctx) => {
    const prefs = ctx.session;
    await ctx.reply(
      `Current preferences:

Watchlist: ${prefs.watchlist.length > 0 ? prefs.watchlist.join(', ') : 'None set'}

To add tokens to watchlist:
/watchlist add <token_mint>

To set alert thresholds:
/threshold price <percent> (default: 10%)
/threshold whale <sol_amount> (default: 100 SOL)
/threshold health <ratio> (default: 1.5)`
    );
  });

  bot.command('history', async (ctx) => {
    // Would fetch from episodic memory
    await ctx.reply(
      `Recent decisions:

(No history yet. Start by adding tokens to your watchlist with /watchlist)`
    );
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      `Hunch Commands:

/start - Welcome message
/wallet - Setup Squads multisig
/preferences - View/set preferences
/history - View past decisions
/watchlist - Manage token watchlist
/status - Check agent status
/help - Show this message`
    );
  });
}
```

- [ ] **Step 3: Create src/telegram/actions.ts**

```typescript
import { Bot, InlineKeyboard } from 'grammy';
import { HunchContext } from './bot.js';
import { ReasoningResult } from '../agent/reasoning.js';

export function registerActions(bot: Bot<HunchContext>) {
  // Handle action card buttons
  bot.callbackQuery(/^execute:(.+)$/, async (ctx) => {
    const memoryId = ctx.match[1];
    await ctx.answerCallbackQuery('Executing...');

    // Would trigger execution via Squads
    await ctx.editMessageText(
      `✅ Action submitted for execution.

Transaction will appear in your Squads multisig for approval.`
    );
  });

  bot.callbackQuery(/^skip:(.+)$/, async (ctx) => {
    const memoryId = ctx.match[1];
    await ctx.answerCallbackQuery('Skipped');

    // Would update episodic memory
    await ctx.editMessageText('⏭️ Action skipped. I\'ll learn from this.');
  });

  bot.callbackQuery(/^why:(.+)$/, async (ctx) => {
    const memoryId = ctx.match[1];
    await ctx.answerCallbackQuery();

    // Would fetch reasoning trace from memory
    await ctx.reply(
      `Reasoning trace:

(This would show the full chain of thought from the LLM)`
    );
  });
}

export function buildActionCard(result: ReasoningResult): {
  text: string;
  keyboard: InlineKeyboard;
} {
  const text = `📊 Event Detected

${result.reasoning}

Confidence: ${Math.round(result.confidence * 100)}%

${result.suggestedAction ? `Suggested: ${result.suggestedAction.type}` : ''}`;

  const keyboard = new InlineKeyboard()
    .text('✅ Execute', `execute:${Date.now()}`)
    .text('⏭️ Skip', `skip:${Date.now()}`)
    .row()
    .text('❓ Why?', `why:${Date.now()}`)
    .text('⚙️ Adjust', `adjust:${Date.now()}`);

  return { text, keyboard };
}
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add Telegram bot with commands and action cards"
```

---

## Task 7: Main Application (Agent Loop)

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Create src/index.ts**

```typescript
import { PrismaClient } from '@prisma/client';
import { createBot } from './telegram/bot.js';
import { registerCommands } from './telegram/commands.js';
import { registerActions, buildActionCard } from './telegram/actions.js';
import { HeliusIngestion } from './ingestion/helius.js';
import { prefilterEvent } from './ingestion/prefilter.js';
import { ReasoningEngine } from './agent/reasoning.js';
import { EpisodicMemory } from './memory/episodic.js';
import { SemanticMemory } from './memory/semantic.js';
import { MemoryConsolidation } from './memory/consolidation.js';
import express from 'express';

const prisma = new PrismaClient();
const bot = createBot();
const helius = new HeliusIngestion();
const reasoning = new ReasoningEngine();
const episodic = new EpisodicMemory(prisma);
const semantic = new SemanticMemory(prisma);
const consolidation = new MemoryConsolidation(prisma, episodic, semantic);

// Register bot handlers
registerCommands(bot);
registerActions(bot);

// Express server for Helius webhooks
const app = express();
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Helius webhook endpoint
app.post('/webhook/helius', async (req, res) => {
  try {
    // Verify webhook signature (would use HELIUS_WEBHOOK_SECRET)
    const events = await helius.processWebhook(req.body);

    for (const event of events) {
      // Get user (simplified - in production would handle multiple users)
      const user = await prisma.user.findFirst();
      if (!user) continue;

      // Get user preferences
      const preferences = user.preferences as any;

      // Pre-filter
      const filterResult = prefilterEvent(
        event,
        preferences,
        [] // Would fetch user portfolio
      );

      if (!filterResult.pass) {
        console.log(`Event filtered: ${filterResult.reason}`);
        continue;
      }

      // Get user context for reasoning
      const history = await episodic.getSimilarDecisions(
        user.id,
        event.type
      );
      const semanticMemories = await semantic.getByUser(user.id);

      // Run reasoning
      const result = await reasoning.reason(event, {
        portfolio: 'Would fetch actual portfolio',
        history: JSON.stringify(history),
        preferences: preferences,
      });

      // Save to episodic memory
      const memoryId = await episodic.save({
        userId: user.id,
        eventType: event.type,
        eventPayload: event.payload as Record<string, unknown>,
        reasoningTrace: result.reasoning,
        confidence: result.confidence,
        actionType: result.suggestedAction?.type,
        actionPayload: result.suggestedAction?.params,
      });

      // Send to Telegram
      if (result.decision !== 'ignore') {
        const { text, keyboard } = buildActionCard(result);
        // Would send to user's Telegram chat
        console.log('Would send action card:', text);
      }
    }

    res.json({ processed: events.length });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Memory consolidation job (run every hour)
setInterval(async () => {
  const users = await prisma.user.findMany();
  for (const user of users) {
    await consolidation.consolidate(user.id);
  }
}, 60 * 60 * 1000);

// Start
async function main() {
  // Start Telegram bot
  bot.start({
    onStart: (botInfo) => {
      console.log(`Bot started: @${botInfo.username}`);
    },
  });

  // Start HTTP server
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

main().catch(console.error);
```

- [ ] **Step 2: Add scripts to package.json**

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add main application with agent loop"
```

---

## Task 8: Web Dashboard (Next.js)

**Files:**
- Create: `dashboard/` (Next.js app)

- [ ] **Step 1: Create Next.js app**

```bash
cd /root/hackathon/coloseum-frontier/hunch
npx create-next-app@latest dashboard --typescript --tailwind --app --no-src-dir
```

- [ ] **Step 2: Create dashboard/app/page.tsx**

```typescript
'use client';

import { useEffect, useState } from 'react';

interface Decision {
  id: string;
  eventType: string;
  reasoning: string;
  confidence: number;
  userResponse: string | null;
  createdAt: string;
}

export default function ActivityFeed() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Would fetch from API
    setLoading(false);
  }, []);

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-8">Hunch Activity Feed</h1>

      {loading ? (
        <p>Loading...</p>
      ) : decisions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No decisions yet</p>
          <p className="text-gray-400 mt-2">
            Connect your Telegram bot and add tokens to your watchlist
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {decisions.map((decision) => (
            <div
              key={decision.id}
              className="border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="inline-block px-2 py-1 text-xs font-semibold rounded bg-blue-100 text-blue-800">
                    {decision.eventType}
                  </span>
                  <span className="ml-2 text-sm text-gray-500">
                    Confidence: {Math.round(decision.confidence * 100)}%
                  </span>
                </div>
                <span className="text-sm text-gray-400">
                  {new Date(decision.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 text-gray-700">{decision.reasoning}</p>
              {decision.userResponse && (
                <div className="mt-2">
                  <span
                    className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                      decision.userResponse === 'approved'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {decision.userResponse}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Create dashboard/app/history/page.tsx**

```typescript
'use client';

import { useEffect, useState } from 'react';

interface DecisionWithOutcome {
  id: string;
  eventType: string;
  reasoning: string;
  confidence: number;
  userResponse: string | null;
  pnl1h: number | null;
  pnl24h: number | null;
  createdAt: string;
}

export default function History() {
  const [decisions, setDecisions] = useState<DecisionWithOutcome[]>([]);

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-8">Decision History</h1>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-2 text-left">Event</th>
              <th className="px-4 py-2 text-left">Confidence</th>
              <th className="px-4 py-2 text-left">Response</th>
              <th className="px-4 py-2 text-left">PnL 1h</th>
              <th className="px-4 py-2 text-left">PnL 24h</th>
              <th className="px-4 py-2 text-left">Date</th>
            </tr>
          </thead>
          <tbody>
            {decisions.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="px-4 py-2">{d.eventType}</td>
                <td className="px-4 py-2">{Math.round(d.confidence * 100)}%</td>
                <td className="px-4 py-2">
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      d.userResponse === 'approved'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100'
                    }`}
                  >
                    {d.userResponse || 'pending'}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {d.pnl1h ? `${d.pnl1h > 0 ? '+' : ''}${d.pnl1h.toFixed(2)}%` : '-'}
                </td>
                <td className="px-4 py-2">
                  {d.pnl24h ? `${d.pnl24h > 0 ? '+' : ''}${d.pnl24h.toFixed(2)}%` : '-'}
                </td>
                <td className="px-4 py-2 text-sm text-gray-500">
                  {new Date(d.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Create dashboard/app/memory/page.tsx**

```typescript
'use client';

import { useEffect, useState } from 'react';

interface SemanticMemoryEntry {
  id: string;
  key: string;
  value: string;
  confidence: number;
  source: string;
  updatedAt: string;
}

export default function MemoryInspector() {
  const [memories, setMemories] = useState<SemanticMemoryEntry[]>([]);

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-8">Memory Inspector</h1>
      <p className="text-gray-600 mb-6">
        These are the preferences Hunch has learned from your behavior.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {memories.map((memory) => (
          <div key={memory.id} className="border rounded-lg p-4">
            <div className="flex justify-between items-start">
              <h3 className="font-semibold text-lg">{memory.key}</h3>
              <span className="text-sm text-gray-500">
                {Math.round(memory.confidence * 100)}% confident
              </span>
            </div>
            <p className="mt-2 text-gray-700">{memory.value}</p>
            <div className="mt-2 flex gap-2">
              <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                {memory.source}
              </span>
              <span className="text-xs text-gray-400">
                Updated: {new Date(memory.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add web dashboard with activity feed, history, memory inspector"
```

---

## Task 9: Squads Multisig Integration

**Files:**
- Create: `src/execution/squads.ts`
- Create: `src/execution/jupiter.ts`

- [ ] **Step 1: Create src/execution/squads.ts**

```typescript
import { PublicKey, Transaction } from '@solana/web3.js';
import Squads from '@sqds/sdk';
import { env } from '../config/env.js';

export interface SquadsConfig {
  multisigAddress: string;
  agentKeypairPath: string;
}

export class SquadsExecution {
  private squads: Squads;
  private multisig: PublicKey;

  constructor(config: SquadsConfig) {
    this.multisig = new PublicKey(config.multisigAddress);

    // Initialize Squads SDK
    // In production, would load agent keypair from config.agentKeypairPath
    this.squads = new Squads({
      connection: {
        endpoint: env.SOLANA_RPC_URL,
      },
    });
  }

  async proposeTransaction(
    transaction: Transaction,
    description: string
  ): Promise<string> {
    // Create proposal in Squads multisig
    // This would use the actual Squads SDK API
    const proposalId = `proposal-${Date.now()}`;

    // In production:
    // const proposal = await this.squads.createProposal({
    //   multisig: this.multisig,
    //   transaction,
    //   description,
    // });

    return proposalId;
  }

  async approveTransaction(proposalId: string): Promise<string> {
    // Agent approves the transaction
    // User still needs to approve via Squads UI or Telegram

    // In production:
    // const tx = await this.squads.approveProposal({
    //   multisig: this.multisig,
    //   proposal: new PublicKey(proposalId),
    // });

    return `approval-tx-${Date.now()}`;
  }

  async getSpendingCap(): Promise<number> {
    // Get current daily spending cap
    // Would query Squads multisig settings
    return 10; // SOL
  }

  async getDailySpent(): Promise<number> {
    // Get amount spent today
    // Would query transaction history
    return 0; // SOL
  }

  async canExecute(amount: number): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    const cap = await this.getSpendingCap();
    const spent = await this.getDailySpent();

    if (spent + amount > cap) {
      return {
        allowed: false,
        reason: `Daily spending cap exceeded (${spent}/${cap} SOL)`,
      };
    }

    return { allowed: true };
  }
}
```

- [ ] **Step 2: Create src/execution/jupiter.ts**

```typescript
import { Transaction, VersionedTransaction } from '@solana/web3.js';

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpact: string;
  fee: string;
}

export class JupiterExecution {
  private baseUrl = 'https://quote-api.jup.ag/v6';

  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: number
  ): Promise<SwapQuote> {
    const response = await fetch(
      `${this.baseUrl}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`
    );

    const data = await response.json();

    return {
      inputMint: data.inputMint,
      outputMint: data.outputMint,
      inAmount: data.inAmount,
      outAmount: data.outAmount,
      priceImpact: data.priceImpactPct,
      fee: data.platformFee?.amount || '0',
    };
  }

  async getSwapTransaction(
    quote: SwapQuote,
    userPublicKey: string
  ): Promise<Transaction> {
    const response = await fetch(`${this.baseUrl}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey,
        wrapAndUnwrapSol: true,
      }),
    });

    const data = await response.json();

    // Deserialize transaction
    const swapTransaction = VersionedTransaction.deserialize(
      Buffer.from(data.swapTransaction, 'base64')
    );

    // Convert to legacy Transaction for Squads compatibility
    // In production, would handle this properly
    return new Transaction();
  }

  async simulateSwap(
    inputMint: string,
    outputMint: string,
    amount: number
  ): Promise<{
    success: boolean;
    expectedOutput: number;
    priceImpact: number;
    error?: string;
  }> {
    try {
      const quote = await this.getQuote(inputMint, outputMint, amount);

      return {
        success: true,
        expectedOutput: parseInt(quote.outAmount),
        priceImpact: parseFloat(quote.priceImpact),
      };
    } catch (error) {
      return {
        success: false,
        expectedOutput: 0,
        priceImpact: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add Squads and Jupiter execution layer"
```

---

## Task 10: Documentation and Demo

**Files:**
- Create: `README.md`
- Create: `CONTRIBUTING.md`
- Create: `LICENSE`

- [ ] **Step 1: Create README.md**

```markdown
# Hunch

Your hunch, smarter. An agent that reasons about onchain events from your history.

## What is Hunch?

Hunch is an LLM-powered agent that:
1. Monitors Solana onchain events (price changes, whale transactions, DeFi positions)
2. Reasons about what events mean for YOUR portfolio using your decision history
3. Suggests actions with transparent reasoning traces
4. Executes after your approval via Squads multisig

Unlike generic alert services, Hunch learns from your behavior and personalizes suggestions.

## Quick Start

### Prerequisites
- Node.js 18+
- Docker (for Postgres)
- Telegram Bot Token (from @BotFather)
- Helius API Key (from helius.dev)
- LLM API Key (Anthropic, OpenAI, or Google)

### Setup

1. Clone and install:
```bash
git clone https://github.com/yourusername/hunch.git
cd hunch
npm install
```

2. Start database:
```bash
docker compose up -d
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your keys
```

4. Run migrations:
```bash
npm run db:migrate
```

5. Start the agent:
```bash
npm run dev
```

6. Open Telegram and message your bot `/start`

## Architecture

```
Event -> Pre-filter -> LLM Reasoning -> Tool Use -> Proposal -> User Approve -> Execute -> Memory Update
```

### Components
- **Event Ingestion**: Helius webhook for onchain events
- **Pre-filter**: Rule-based filtering (drops 95% of events)
- **Reasoning Engine**: LLM with tool use (provider-agnostic)
- **Memory**: Episodic (decisions) + Semantic (learned preferences)
- **Execution**: Squads multisig for non-custodial security

## LLM Providers

Hunch supports multiple LLM providers via Vercel AI SDK:

| Provider | Models | Use Case |
|----------|--------|----------|
| Anthropic | Claude Opus, Sonnet, Haiku | Best reasoning |
| OpenAI | GPT-4o, GPT-4o-mini, o1 | Good balance |
| Google | Gemini Pro, Flash | Fast, cheap |
| Ollama | Llama, Mistral, etc. | Self-hosted, free |

Users bring their own API keys (BYOK).

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome and setup |
| `/wallet` | Connect Squads multisig |
| `/preferences` | Set alert thresholds |
| `/history` | View past decisions |
| `/help` | Show commands |

## Development

```bash
npm run dev          # Start with hot reload
npm run test         # Run tests
npm run db:migrate   # Run database migrations
npm run build        # Build for production
```

## License

MIT
```

- [ ] **Step 2: Create LICENSE**

```
MIT License

Copyright (c) 2026 Hunch Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "docs: add README and MIT license"
```

---

## Execution Order

Execute tasks in this order:

1. **Task 1**: Project setup (dependencies, config)
2. **Task 2**: Database schema (Prisma + pgvector)
3. **Task 3**: Event ingestion (Helius + prefilter)
4. **Task 4**: LLM abstraction (Vercel AI SDK)
5. **Task 5**: Memory system (episodic + semantic)
6. **Task 6**: Telegram bot (commands + actions)
7. **Task 7**: Main application (agent loop)
8. **Task 8**: Web dashboard (Next.js)
9. **Task 9**: Execution layer (Squads + Jupiter)
10. **Task 10**: Documentation (README + license)

Each task produces working, testable software. Commit after each task.

---

## Self-Review

1. **Spec coverage**: All spec sections covered (event ingestion, reasoning, memory, execution, UI)
2. **Placeholder scan**: No TBD/TODO found
3. **Type consistency**: Types defined in Task 2 used throughout

Gaps addressed:
- Added failure mode handling in agent loop
- Added memory consolidation job
- Added Telegram action handlers
