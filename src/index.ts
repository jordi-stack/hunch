import { createHmac } from 'node:crypto';
import express from 'express';
import { createBot } from './telegram/bot.js';
import { registerCommands } from './telegram/commands.js';
import { registerActions, buildActionCard } from './telegram/actions.js';
import { HeliusIngestion } from './ingestion/helius.js';
import { prefilterEvent } from './ingestion/prefilter.js';
import { ReasoningEngine } from './agent/reasoning.js';
import { EpisodicMemory } from './memory/episodic.js';
import { SemanticMemory } from './memory/semantic.js';
import { MemoryConsolidation } from './memory/consolidation.js';
import { prisma } from './lib/db.js';
import { env } from './config/env.js';
import type { UserPreferences } from './memory/types.js';

const bot = createBot();
registerCommands(bot);
registerActions(bot);

const helius = new HeliusIngestion();
const reasoning = new ReasoningEngine();
const episodic = new EpisodicMemory();
const semantic = new SemanticMemory();
const consolidation = new MemoryConsolidation(episodic, semantic);

const app = express();
app.use(express.json());

const DEFAULT_PREFERENCES: UserPreferences = {
  alertThresholds: {
    priceChangePercent: 5,
    whaleThresholdSol: 100,
    defiHealthRatio: 1.2,
  },
  confidenceThreshold: 0.7,
  autoExecute: false,
  dailySpendingCap: 0,
  tokenWhitelist: [],
  protocolWhitelist: [],
};

function mergePreferences(raw: Record<string, unknown> | undefined): UserPreferences {
  if (!raw) return DEFAULT_PREFERENCES;
  return {
    ...DEFAULT_PREFERENCES,
    ...raw,
    alertThresholds: {
      ...DEFAULT_PREFERENCES.alertThresholds,
      ...(raw.alertThresholds as Record<string, number> | undefined),
    },
  };
}

function verifyHeliusSignature(body: string, signature: string): boolean {
  const hmac = createHmac('sha256', env.HELIUS_WEBHOOK_SECRET);
  hmac.update(body);
  const expected = hmac.digest('hex');
  return expected === signature;
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Helius webhook - single-user mode for hackathon MVP
app.post('/webhook/helius', async (req, res) => {
  try {
    const signature = req.headers['x-helius-signature'] as string | undefined;
    if (!signature || !verifyHeliusSignature(JSON.stringify(req.body), signature)) {
      res.status(401).json({ error: 'invalid_signature' });
      return;
    }

    const events = await helius.processWebhook(req.body);
    if (events.length === 0) {
      res.json({ processed: 0 });
      return;
    }

    // Single-user: grab the first (and only) user
    const user = await prisma.user.findFirst();
    if (!user) {
      res.json({ processed: 0, reason: 'no_user' });
      return;
    }

    const rawPrefs = user.preferences ? JSON.parse(user.preferences) : undefined;
    const preferences = mergePreferences(rawPrefs);

    const portfolio: string[] = user.watchlist
      ? (JSON.parse(user.watchlist) as string[])
      : [];

    const recentMemories = await episodic.getByUser(user.id, { limit: 20 });
    const semanticMemories = await semantic.getByUser(user.id);

    const historySummary = recentMemories
      .map((m) => `${m.eventType}: ${m.userResponse ?? 'pending'} (conf ${m.confidence.toFixed(2)})`)
      .join('\n');

    const semanticSummary = semanticMemories
      .map((m) => `${m.key}: ${m.value} (conf ${m.confidence.toFixed(2)})`)
      .join('\n');

    const contextBlock = [historySummary, semanticSummary].filter(Boolean).join('\n---\n') || 'No prior decisions.';
    const portfolioStr = portfolio.length > 0 ? portfolio.join(', ') : 'none';

    let processed = 0;

    for (const event of events) {
      const filterResult = prefilterEvent(event, preferences, portfolio);
      if (!filterResult.pass) {
        continue;
      }

      const result = await reasoning.reason(event, {
        portfolio: portfolioStr,
        history: contextBlock,
        preferences: preferences as unknown as Record<string, unknown>,
      });

      const memoryId = await episodic.save({
        userId: user.id,
        eventType: event.type,
        eventPayload: event.payload,
        reasoningTrace: result.reasoning,
        confidence: result.confidence,
        actionType: result.suggestedAction?.type,
        actionPayload: result.suggestedAction?.params,
      });

      if (result.decision !== 'ignore') {
        const { text, keyboard } = buildActionCard(result, memoryId);
        await bot.api.sendMessage(user.telegramId, text, {
          reply_markup: keyboard,
        });
      }

      processed++;
    }

    res.json({ processed });
  } catch (err) {
    console.error('[Webhook] Error processing Helius webhook:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

async function runConsolidation(): Promise<void> {
  try {
    const users = await prisma.user.findMany();
    for (const user of users) {
      await consolidation.consolidate(user.id);
    }
    console.log(`[Consolidation] Completed for ${users.length} user(s)`);
  } catch (err) {
    console.error('[Consolidation] Error:', err);
  }
}

async function main(): Promise<void> {
  const port = Number(process.env.PORT) || 3000;

  await bot.start({
    onStart: (botInfo) => {
      console.log(`[Bot] Started as @${botInfo.username}`);
    },
  });

  const server = app.listen(port, () => {
    console.log(`[Server] Listening on port ${port}`);
  });

  const consolidationTimer = setInterval(runConsolidation, 60 * 60 * 1000);
  console.log('[Consolidation] Scheduled every 60 minutes');

  async function shutdown() {
    console.log('[Shutdown] Cleaning up...');
    clearInterval(consolidationTimer);
    server.close();
    bot.stop();
    await prisma.$disconnect();
    process.exit(0);
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[Main] Fatal error:', err);
  process.exit(1);
});
