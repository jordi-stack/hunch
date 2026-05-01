'use client';

import { useState } from 'react';

interface MemoryEntry {
  id: string;
  key: string;
  value: string;
  confidence: number;
  source: 'consolidation' | 'explicit_setting';
  category: 'preference' | 'pattern' | 'threshold';
  updatedAt: string;
}

const MOCK_MEMORIES: MemoryEntry[] = [
  {
    id: '1',
    key: 'approval_rate_whale_tx',
    value: '{"rate": 0.72, "approved": 13, "total": 18}',
    confidence: 0.9,
    source: 'consolidation',
    category: 'pattern',
    updatedAt: '2026-05-01T12:00:00Z',
  },
  {
    id: '2',
    key: 'approval_rate_price_change',
    value: '{"rate": 0.45, "approved": 9, "total": 20}',
    confidence: 1.0,
    source: 'consolidation',
    category: 'pattern',
    updatedAt: '2026-05-01T12:00:00Z',
  },
  {
    id: '3',
    key: 'prefers_high_confidence',
    value: '{"skipRate": 0.82, "sampleSize": 11}',
    confidence: 1.0,
    source: 'consolidation',
    category: 'preference',
    updatedAt: '2026-05-01T12:00:00Z',
  },
  {
    id: '4',
    key: 'preferred_action_swap',
    value: '{"approvals": 14}',
    confidence: 1.0,
    source: 'consolidation',
    category: 'pattern',
    updatedAt: '2026-05-01T12:00:00Z',
  },
  {
    id: '5',
    key: 'preferred_action_notify',
    value: '{"approvals": 8}',
    confidence: 0.8,
    source: 'consolidation',
    category: 'pattern',
    updatedAt: '2026-05-01T12:00:00Z',
  },
  {
    id: '6',
    key: 'confidence_threshold',
    value: '0.7',
    confidence: 1.0,
    source: 'explicit_setting',
    category: 'threshold',
    updatedAt: '2026-04-28T09:00:00Z',
  },
  {
    id: '7',
    key: 'meme_token_avoidance',
    value: 'User skips 4/5 meme token signals. Low confidence on speculative pumps.',
    confidence: 0.8,
    source: 'consolidation',
    category: 'preference',
    updatedAt: '2026-04-30T18:00:00Z',
  },
  {
    id: '8',
    key: 'whale_threshold_sol',
    value: '100',
    confidence: 1.0,
    source: 'explicit_setting',
    category: 'threshold',
    updatedAt: '2026-04-28T09:00:00Z',
  },
];

const CATEGORY_STYLES: Record<string, { label: string; color: string }> = {
  preference: { label: 'Preference', color: 'bg-accent-purple/15 text-accent-purple' },
  pattern: { label: 'Pattern', color: 'bg-accent-cyan/15 text-accent-cyan' },
  threshold: { label: 'Threshold', color: 'bg-accent-amber/15 text-accent-amber' },
};

const SOURCE_STYLES: Record<string, string> = {
  consolidation: 'bg-accent-cyan/10 text-accent-cyan',
  explicit_setting: 'bg-accent-green/10 text-accent-green',
};

function formatValue(key: string, value: string): string {
  try {
    const parsed = JSON.parse(value);
    if (parsed.rate !== undefined) return `${(parsed.rate * 100).toFixed(0)}% approval (${parsed.approved}/${parsed.total})`;
    if (parsed.skipRate !== undefined) return `${(parsed.skipRate * 100).toFixed(0)}% skip rate on low-confidence signals`;
    if (parsed.approvals !== undefined) return `${parsed.approvals} approvals`;
  } catch {
    // not JSON
  }
  return value;
}

function formatKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function MemoryInspector() {
  const [memories] = useState<MemoryEntry[]>(MOCK_MEMORIES);
  const [filter, setFilter] = useState<'all' | 'pattern' | 'preference' | 'threshold'>('all');

  const filtered = filter === 'all' ? memories : memories.filter((m) => m.category === filter);

  const patterns = memories.filter((m) => m.category === 'pattern').length;
  const avgConf = memories.reduce((sum, m) => sum + m.confidence, 0) / memories.length;

  const stats = [
    { label: 'Total Memories', value: memories.length.toString() },
    { label: 'Patterns Found', value: patterns.toString() },
    { label: 'Avg Confidence', value: `${(avgConf * 100).toFixed(0)}%` },
    { label: 'Last Updated', value: '2h ago' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-2xl font-semibold tracking-tight">Memory Inspector</h1>
        <p className="text-sm text-text-secondary mt-1">
          What your Hunch agent has learned about you
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {stats.map((stat, i) => (
          <div key={stat.label} className={`glass rounded-xl p-4 animate-slide-up stagger-${i + 1}`}>
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">{stat.label}</p>
            <p className="text-xl font-semibold tracking-tight">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-5 animate-slide-up stagger-5">
        {(['all', 'pattern', 'preference', 'threshold'] as const).map((f) => {
          const info = CATEGORY_STYLES[f];
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all duration-200 ${
                filter === f
                  ? 'bg-accent-purple/15 text-accent-purple border-accent-purple/30'
                  : 'bg-white/5 text-text-muted border-white/10 hover:bg-white/10 hover:text-text-secondary'
              }`}
            >
              {f === 'all' ? 'All' : info?.label ?? f}
            </button>
          );
        })}
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((m, i) => {
          const cat = CATEGORY_STYLES[m.category];
          const date = new Date(m.updatedAt);

          return (
            <div
              key={m.id}
              className={`glass glass-hover rounded-xl p-5 animate-slide-up stagger-${Math.min(i + 1, 10)} transition-all duration-300`}
            >
              {/* Top */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-medium tracking-tight">{formatKey(m.key)}</h3>
                  <p className="text-xs text-text-muted font-mono mt-0.5">{m.key}</p>
                </div>
                <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${cat.color}`}>
                  {cat.label}
                </span>
              </div>

              {/* Value */}
              <p className="text-sm text-text-secondary mb-4 leading-relaxed">
                {formatValue(m.key, m.value)}
              </p>

              {/* Bottom */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Confidence bar */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-text-muted">Confidence</span>
                    <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full animate-bar-fill"
                        style={{
                          width: `${m.confidence * 100}%`,
                          background: 'linear-gradient(90deg, #a855f7, #06b6d4)',
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono text-text-secondary">
                      {(m.confidence * 100).toFixed(0)}%
                    </span>
                  </div>

                  {/* Source badge */}
                  <span className={`text-[11px] px-2 py-0.5 rounded ${SOURCE_STYLES[m.source]}`}>
                    {m.source === 'consolidation' ? 'Learned' : 'Manual'}
                  </span>
                </div>

                <span className="text-[11px] text-text-muted">
                  {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
