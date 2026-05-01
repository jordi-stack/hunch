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

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

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
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

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

let lastConsolidationTime: Date | null = null;
let totalEventsProcessed = 0;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/api/health', async (_req, res) => {
  try {
    const userCount = await prisma.user.count();
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      userCount,
      lastConsolidation: lastConsolidationTime?.toISOString() ?? null,
      totalEventsProcessed,
      webhookConfigured: Boolean(env.HELIUS_WEBHOOK_SECRET),
    });
  } catch (err) {
    console.error('[API] /api/health error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

app.get('/api/decisions', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const [records, total] = await Promise.all([
      prisma.episodicMemory.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.episodicMemory.count(),
    ]);

    const decisions = records.map((r) => ({
      id: r.id,
      userId: r.userId,
      eventType: r.eventType,
      eventPayload: safeJsonParse(r.eventPayload, {}),
      reasoningTrace: r.reasoningTrace,
      confidence: r.confidence,
      actionType: r.actionType,
      actionPayload: safeJsonParse(r.actionPayload, null),
      toolCalls: safeJsonParse(r.toolCalls, null),
      userResponse: r.userResponse,
      executedAt: r.executedAt?.toISOString() ?? null,
      executionResult: safeJsonParse(r.executionResult, null),
      pnl1h: r.pnl1h,
      pnl24h: r.pnl24h,
      pnl7d: r.pnl7d,
      createdAt: r.createdAt.toISOString(),
    }));

    res.json({ decisions, total });
  } catch (err) {
    console.error('[API] /api/decisions error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

app.get('/api/decisions/:id', async (req, res) => {
  try {
    const r = await prisma.episodicMemory.findUnique({
      where: { id: req.params.id },
    });

    if (!r) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    res.json({
      id: r.id,
      userId: r.userId,
      eventType: r.eventType,
      eventPayload: safeJsonParse(r.eventPayload, {}),
      reasoningTrace: r.reasoningTrace,
      confidence: r.confidence,
      actionType: r.actionType,
      actionPayload: safeJsonParse(r.actionPayload, null),
      toolCalls: safeJsonParse(r.toolCalls, null),
      userResponse: r.userResponse,
      executedAt: r.executedAt?.toISOString() ?? null,
      executionResult: safeJsonParse(r.executionResult, null),
      pnl1h: r.pnl1h,
      pnl24h: r.pnl24h,
      pnl7d: r.pnl7d,
      createdAt: r.createdAt.toISOString(),
    });
  } catch (err) {
    console.error('[API] /api/decisions/:id error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

app.get('/api/memory', async (_req, res) => {
  try {
    const records = await prisma.semanticMemory.findMany({
      orderBy: { confidence: 'desc' },
    });

    const memories = records.map((r) => ({
      id: r.id,
      userId: r.userId,
      key: r.key,
      value: r.value,
      confidence: r.confidence,
      source: r.source,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    res.json({ memories });
  } catch (err) {
    console.error('[API] /api/memory error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

app.get('/api/stats', async (_req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalDecisions,
      approvedCount,
      skippedCount,
      avgConfidenceResult,
      winRateResult,
      pnlAggregates,
      eventsToday,
      proposedToday,
    ] = await Promise.all([
      prisma.episodicMemory.count(),
      prisma.episodicMemory.count({ where: { userResponse: 'approved' } }),
      prisma.episodicMemory.count({ where: { userResponse: 'skipped' } }),
      prisma.episodicMemory.aggregate({ _avg: { confidence: true } }),
      prisma.episodicMemory.aggregate({
        _avg: { pnl1h: true },
        where: { userResponse: 'approved', pnl1h: { not: null } },
      }),
      prisma.episodicMemory.aggregate({
        _avg: { pnl1h: true, pnl24h: true, pnl7d: true },
      }),
      prisma.episodicMemory.count({
        where: { createdAt: { gte: todayStart } },
      }),
      prisma.episodicMemory.count({
        where: {
          createdAt: { gte: todayStart },
          actionType: { not: null },
        },
      }),
    ]);

    const responded = approvedCount + skippedCount;

    res.json({
      totalDecisions,
      approvedCount,
      skippedCount,
      approvalRate: responded > 0 ? approvedCount / responded : 0,
      avgConfidence: avgConfidenceResult._avg.confidence ?? 0,
      winRate: winRateResult._avg.pnl1h ?? 0,
      avgPnl1h: pnlAggregates._avg.pnl1h ?? 0,
      avgPnl24h: pnlAggregates._avg.pnl24h ?? 0,
      avgPnl7d: pnlAggregates._avg.pnl7d ?? 0,
      eventsToday,
      proposedToday,
    });
  } catch (err) {
    console.error('[API] /api/stats error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

app.get('/api/price/:mint', async (req, res) => {
  try {
    const { mint } = req.params;
    const response = await fetch(`https://price.jup.ag/v6/price?ids=${mint}`);

    if (!response.ok) {
      res.status(502).json({ error: 'jupiter_unavailable' });
      return;
    }

    const data = (await response.json()) as {
      data: Record<string, { price: number; priceChange24h: number }>;
    };
    const mintData = data.data?.[mint];

    if (!mintData) {
      res.status(404).json({ error: 'token_not_found' });
      return;
    }

    res.json({
      mint,
      price: mintData.price,
      change24h: mintData.priceChange24h,
    });
  } catch (err) {
    console.error('[API] /api/price error:', err);
    res.status(502).json({ error: 'jupiter_unavailable' });
  }
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
        toolCalls: result.toolCalls,
      });

      totalEventsProcessed++;

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
    lastConsolidationTime = new Date();
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
