import { EpisodicMemory } from './episodic.js';
import { SemanticMemory } from './semantic.js';
import type { EpisodicMemoryData } from './types.js';

export class MemoryConsolidation {
  constructor(
    private episodic: EpisodicMemory,
    private semantic: SemanticMemory,
  ) {}

  async consolidate(userId: string): Promise<void> {
    const memories = await this.episodic.getByUser(userId, { limit: 200 });
    const patterns = this.extractPatterns(memories);

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

  extractPatterns(memories: EpisodicMemoryData[]): Array<{
    key: string;
    value: string;
    confidence: number;
  }> {
    const patterns: Array<{ key: string; value: string; confidence: number }> = [];
    const responded = memories.filter((m) => m.userResponse === 'approved' || m.userResponse === 'skipped');

    // Pattern: approval_rate_by_event_type (when >= 5 decisions per type)
    const byType = new Map<string, { approved: number; total: number }>();
    for (const m of responded) {
      const entry = byType.get(m.eventType) ?? { approved: 0, total: 0 };
      entry.total += 1;
      if (m.userResponse === 'approved') entry.approved += 1;
      byType.set(m.eventType, entry);
    }

    for (const [eventType, stats] of byType) {
      if (stats.total >= 5) {
        const rate = stats.approved / stats.total;
        patterns.push({
          key: `approval_rate_${eventType}`,
          value: JSON.stringify({ rate, approved: stats.approved, total: stats.total }),
          confidence: Math.min(1, stats.total / 20),
        });
      }
    }

    // Pattern: prefers_high_confidence (when >70% of low-confidence decisions skipped)
    const lowConfidenceThreshold = 0.5;
    const lowConfidence = responded.filter((m) => m.confidence < lowConfidenceThreshold);
    if (lowConfidence.length >= 3) {
      const skippedLow = lowConfidence.filter((m) => m.userResponse === 'skipped').length;
      const skipRate = skippedLow / lowConfidence.length;
      if (skipRate > 0.7) {
        patterns.push({
          key: 'prefers_high_confidence',
          value: JSON.stringify({ skipRate, sampleSize: lowConfidence.length }),
          confidence: Math.min(1, lowConfidence.length / 10),
        });
      }
    }

    // Pattern: preferred_action_type (when >= 3 approvals of same action type)
    const approvedByAction = new Map<string, number>();
    for (const m of responded) {
      if (m.userResponse === 'approved' && m.actionType) {
        const count = (approvedByAction.get(m.actionType) ?? 0) + 1;
        approvedByAction.set(m.actionType, count);
      }
    }

    for (const [actionType, count] of approvedByAction) {
      if (count >= 3) {
        patterns.push({
          key: `preferred_action_${actionType}`,
          value: JSON.stringify({ approvals: count }),
          confidence: Math.min(1, count / 10),
        });
      }
    }

    return patterns;
  }
}
