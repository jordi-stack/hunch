import { prisma } from '../lib/db.js';
import type { SemanticMemoryData } from './types.js';

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export class SemanticMemory {
  async save(data: SemanticMemoryData): Promise<string> {
    const record = await prisma.semanticMemory.create({
      data: {
        userId: data.userId,
        key: data.key,
        value: data.value,
        confidence: data.confidence,
        source: data.source,
        embedding: data.embedding ? JSON.stringify(data.embedding) : null,
      },
    });
    return record.id;
  }

  async upsert(data: SemanticMemoryData): Promise<void> {
    await prisma.semanticMemory.upsert({
      where: {
        userId_key: { userId: data.userId, key: data.key },
      },
      update: {
        value: data.value,
        confidence: data.confidence,
        source: data.source,
        embedding: data.embedding ? JSON.stringify(data.embedding) : null,
      },
      create: {
        userId: data.userId,
        key: data.key,
        value: data.value,
        confidence: data.confidence,
        source: data.source,
        embedding: data.embedding ? JSON.stringify(data.embedding) : null,
      },
    });
  }

  async getByUser(userId: string): Promise<SemanticMemoryData[]> {
    const records = await prisma.semanticMemory.findMany({
      where: { userId },
      orderBy: { confidence: 'desc' },
    });

    return records.map((r) => ({
      userId: r.userId,
      key: r.key,
      value: r.value,
      confidence: r.confidence,
      source: r.source,
      embedding: safeJsonParse<number[]>(r.embedding, undefined),
    }));
  }

  async getByKey(userId: string, key: string): Promise<SemanticMemoryData | null> {
    const record = await prisma.semanticMemory.findUnique({
      where: { userId_key: { userId, key } },
    });

    if (!record) return null;

    return {
      userId: record.userId,
      key: record.key,
      value: record.value,
      confidence: record.confidence,
      source: record.source,
      embedding: safeJsonParse<number[]>(record.embedding, undefined),
    };
  }

  async searchSimilar(
    userId: string,
    _query: string,
    limit: number = 10,
  ): Promise<SemanticMemoryData[]> {
    // Simple version: return top by confidence.
    // Would use embedding similarity against _query in production.
    const records = await prisma.semanticMemory.findMany({
      where: { userId },
      orderBy: { confidence: 'desc' },
      take: limit,
    });

    return records.map((r) => ({
      userId: r.userId,
      key: r.key,
      value: r.value,
      confidence: r.confidence,
      source: r.source,
      embedding: safeJsonParse<number[]>(r.embedding, undefined),
    }));
  }
}
