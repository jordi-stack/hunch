'use client';

import { useState, useEffect } from 'react';

interface MemoryEntry {
  id: string;
  key: string;
  value: string;
  confidence: number;
  source: string;
  createdAt: string;
  updatedAt: string;
}

const API_BASE = '';

function categorizeKey(key: string): 'pattern' | 'preference' | 'threshold' {
  if (key.startsWith('approval_rate_') || key.startsWith('preferred_action_')) return 'pattern';
  if (key.endsWith('_threshold') || key.endsWith('Threshold')) return 'threshold';
  return 'preference';
}

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
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function MemoryInspector() {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pattern' | 'preference' | 'threshold'>('all');

  useEffect(() => {
    fetch(`${API_BASE}/api/memory`)
      .then((r) => r.json())
      .then((d) => {
        setMemories(d.memories);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const withCategory = memories.map((m) => ({ ...m, category: categorizeKey(m.key) }));
  const filtered = filter === 'all' ? withCategory : withCategory.filter((m) => m.category === filter);

  const patterns = withCategory.filter((m) => m.category === 'pattern').length;
  const avgConf = memories.length > 0
    ? memories.reduce((sum, m) => sum + m.confidence, 0) / memories.length
    : 0;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-accent-red text-sm">Failed to load: {error}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-xs px-4 py-2 rounded-lg bg-white/5 text-text-secondary border border-white/10 hover:bg-white/10 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const statsCards = [
    { label: 'Total Memories', value: loading ? '...' : memories.length.toString() },
    { label: 'Patterns Found', value: loading ? '...' : patterns.toString() },
    { label: 'Avg Confidence', value: loading ? '...' : `${(avgConf * 100).toFixed(0)}%` },
    { label: 'Last Updated', value: loading ? '...' : memories.length > 0 ? 'recently' : 'never' },
  ];

  return (
    <div>
      <div className="mb-8 animate-fade-in">
        <h1 className="text-2xl font-semibold tracking-tight">Memory Inspector</h1>
        <p className="text-sm text-text-secondary mt-1">What your Hunch agent has learned about you</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass rounded-xl p-4 animate-shimmer">
                <div className="w-20 h-3 rounded bg-white/5 mb-2" />
                <div className="w-16 h-6 rounded bg-white/5" />
              </div>
            ))
          : statsCards.map((stat, i) => (
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
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass rounded-xl p-5 animate-shimmer">
              <div className="w-32 h-4 rounded bg-white/5 mb-3" />
              <div className="w-full h-3 rounded bg-white/5 mb-2" />
              <div className="w-2/3 h-3 rounded bg-white/5" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((m, i) => {
            const cat = CATEGORY_STYLES[m.category];
            const date = new Date(m.updatedAt);

            return (
              <div
                key={m.id}
                className={`glass glass-hover rounded-xl p-5 animate-slide-up stagger-${Math.min(i + 1, 10)} transition-all duration-300`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-medium tracking-tight">{formatKey(m.key)}</h3>
                    <p className="text-xs text-text-muted font-mono mt-0.5">{m.key}</p>
                  </div>
                  <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${cat.color}`}>
                    {cat.label}
                  </span>
                </div>

                <p className="text-sm text-text-secondary mb-4 leading-relaxed">
                  {formatValue(m.key, m.value)}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
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
                    <span className={`text-[11px] px-2 py-0.5 rounded ${SOURCE_STYLES[m.source] ?? 'bg-white/5 text-text-muted'}`}>
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
      )}

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center h-32 gap-2 mt-4">
          <p className="text-text-muted text-sm">
            {memories.length === 0
              ? 'No memories yet. They will appear after your agent consolidates patterns.'
              : 'No memories match this filter.'}
          </p>
        </div>
      )}
    </div>
  );
}
