import { prisma } from '../lib/db.js';
import type { EpisodicMemoryData } from './types.js';

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

type EpisodicRecord = {
  id?: string;
  userId: string;
  eventType: string;
  eventPayload: string;
  reasoningTrace: string;
  confidence: number;
  actionType: string | null;
  actionPayload: string | null;
  toolCalls: string | null;
  userResponse: string | null;
  executedAt: Date | null;
  executionResult: string | null;
  pnl1h: number | null;
  pnl24h: number | null;
  pnl7d: number | null;
  createdAt?: Date;
};

function toData(r: EpisodicRecord): EpisodicMemoryData {
  return {
    userId: r.userId,
    eventType: r.eventType as EpisodicMemoryData['eventType'],
    eventPayload: safeJsonParse<Record<string, unknown>>(r.eventPayload, {}),
    reasoningTrace: r.reasoningTrace,
    confidence: r.confidence,
    actionType: r.actionType as EpisodicMemoryData['actionType'] | undefined,
    actionPayload: safeJsonParse<Record<string, unknown>>(r.actionPayload, undefined),
    toolCalls: safeJsonParse<EpisodicMemoryData['toolCalls']>(r.toolCalls, undefined),
    userResponse: r.userResponse as EpisodicMemoryData['userResponse'] | undefined,
    executedAt: r.executedAt ?? undefined,
    executionResult: safeJsonParse<Record<string, unknown>>(r.executionResult, undefined),
    pnl1h: r.pnl1h ?? undefined,
    pnl24h: r.pnl24h ?? undefined,
    pnl7d: r.pnl7d ?? undefined,
  };
}

export class EpisodicMemory {
  async save(data: EpisodicMemoryData): Promise<string> {
    const record = await prisma.episodicMemory.create({
      data: {
        userId: data.userId,
        eventType: data.eventType,
        eventPayload: JSON.stringify(data.eventPayload),
        reasoningTrace: data.reasoningTrace,
        confidence: data.confidence,
        actionType: data.actionType ?? null,
        actionPayload: data.actionPayload ? JSON.stringify(data.actionPayload) : null,
        toolCalls: data.toolCalls ? JSON.stringify(data.toolCalls) : null,
        userResponse: data.userResponse ?? null,
        executedAt: data.executedAt ?? null,
        executionResult: data.executionResult ? JSON.stringify(data.executionResult) : null,
        pnl1h: data.pnl1h ?? null,
        pnl24h: data.pnl24h ?? null,
        pnl7d: data.pnl7d ?? null,
      },
    });
    return record.id;
  }

  async updateResponse(
    id: string,
    response: 'approved' | 'skipped' | 'timeout',
    executionResult?: Record<string, unknown>,
  ): Promise<void> {
    await prisma.episodicMemory.update({
      where: { id },
      data: {
        userResponse: response,
        executedAt: response === 'approved' ? new Date() : null,
        executionResult: executionResult ? JSON.stringify(executionResult) : null,
      },
    });
  }

  async updateOutcome(
    id: string,
    pnl1h?: number,
    pnl24h?: number,
    pnl7d?: number,
  ): Promise<void> {
    await prisma.episodicMemory.update({
      where: { id },
      data: {
        pnl1h: pnl1h ?? null,
        pnl24h: pnl24h ?? null,
        pnl7d: pnl7d ?? null,
      },
    });
  }

  async getByUser(
    userId: string,
    options?: { limit?: number; offset?: number; eventType?: string },
  ): Promise<EpisodicMemoryData[]> {
    const records = await prisma.episodicMemory.findMany({
      where: {
        userId,
        ...(options?.eventType ? { eventType: options.eventType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    });

    return records.map(toData);
  }

  async getSimilarDecisions(
    userId: string,
    eventType: string,
    limit: number = 10,
  ): Promise<EpisodicMemoryData[]> {
    const records = await prisma.episodicMemory.findMany({
      where: {
        userId,
        eventType,
        userResponse: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return records.map(toData);
  }

  async getStats(userId: string): Promise<{
    total: number;
    approved: number;
    skipped: number;
    approvalRate: number;
  }> {
    const [total, approved, skipped] = await Promise.all([
      prisma.episodicMemory.count({ where: { userId } }),
      prisma.episodicMemory.count({ where: { userId, userResponse: 'approved' } }),
      prisma.episodicMemory.count({ where: { userId, userResponse: 'skipped' } }),
    ]);

    const responded = approved + skipped;
    return {
      total,
      approved,
      skipped,
      approvalRate: responded > 0 ? approved / responded : 0,
    };
  }
}
