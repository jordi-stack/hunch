'use client';

import { useState, useEffect } from 'react';

interface Decision {
  id: string;
  eventType: string;
  confidence: number;
  actionType: string | null;
  userResponse: string | null;
  pnl1h: number | null;
  pnl24h: number | null;
  pnl7d: number | null;
  createdAt: string;
}

interface Stats {
  totalDecisions: number;
  approvedCount: number;
  winRate: number;
  avgPnl24h: number;
}

const API_BASE = '';

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  price_change: { label: 'Price', color: 'bg-accent-amber/15 text-accent-amber' },
  whale_tx: { label: 'Whale', color: 'bg-accent-purple/15 text-accent-purple' },
  defi_position: { label: 'DeFi', color: 'bg-accent-cyan/15 text-accent-cyan' },
};

const FILTERS = ['all', 'price_change', 'whale_tx', 'defi_position'] as const;

function PnlCell({ value }: { value: number | null }) {
  if (value === null || value === 0) return <span className="text-text-muted">--</span>;
  const positive = value > 0;
  return (
    <span className={positive ? 'text-accent-green' : 'text-accent-red'}>
      {positive ? '+' : ''}{value.toFixed(1)}%
    </span>
  );
}

export default function DecisionHistory() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [history, setHistory] = useState<Decision[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/decisions?limit=50`).then((r) => r.json()),
      fetch(`${API_BASE}/api/stats`).then((r) => r.json()),
    ])
      .then(([decisionsData, statsData]) => {
        setHistory(decisionsData.decisions);
        setStats({
          totalDecisions: statsData.totalDecisions,
          approvedCount: statsData.approvedCount,
          winRate: statsData.winRate,
          avgPnl24h: statsData.avgPnl24h,
        });
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const filtered = filter === 'all' ? history : history.filter((h) => h.eventType === filter);

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

  const statsCards = stats
    ? [
        { label: 'Total Decisions', value: stats.totalDecisions.toString() },
        { label: 'Approved', value: stats.approvedCount.toString() },
        { label: 'Win Rate', value: `${(stats.winRate * 100).toFixed(0)}%` },
        { label: 'Avg PnL (24h)', value: `${stats.avgPnl24h > 0 ? '+' : ''}${stats.avgPnl24h.toFixed(1)}%` },
      ]
    : [];

  return (
    <div>
      <div className="mb-8 animate-fade-in">
        <h1 className="text-2xl font-semibold tracking-tight">Decision History</h1>
        <p className="text-sm text-text-secondary mt-1">Past decisions and their outcomes</p>
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
        {FILTERS.map((f) => {
          const info = EVENT_LABELS[f];
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

      {/* Table */}
      <div className="glass rounded-xl overflow-hidden animate-slide-up stagger-6">
        {loading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 rounded bg-white/5 animate-shimmer" />
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left py-3 px-5 text-[11px] text-text-muted uppercase tracking-wider font-medium">Event</th>
                <th className="text-left py-3 px-5 text-[11px] text-text-muted uppercase tracking-wider font-medium">Confidence</th>
                <th className="text-left py-3 px-5 text-[11px] text-text-muted uppercase tracking-wider font-medium">Response</th>
                <th className="text-right py-3 px-5 text-[11px] text-text-muted uppercase tracking-wider font-medium">1h</th>
                <th className="text-right py-3 px-5 text-[11px] text-text-muted uppercase tracking-wider font-medium">24h</th>
                <th className="text-right py-3 px-5 text-[11px] text-text-muted uppercase tracking-wider font-medium">7d</th>
                <th className="text-right py-3 px-5 text-[11px] text-text-muted uppercase tracking-wider font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const evt = EVENT_LABELS[d.eventType] ?? { label: d.eventType, color: 'bg-white/10 text-text-secondary' };
                const date = new Date(d.createdAt);
                return (
                  <tr key={d.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-5">
                      <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${evt.color}`}>
                        {evt.label}
                      </span>
                    </td>
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${d.confidence * 100}%`,
                              background: d.confidence > 0.7 ? '#22c55e' : d.confidence > 0.5 ? '#f59e0b' : '#ef4444',
                            }}
                          />
                        </div>
                        <span className="text-xs text-text-secondary font-mono">
                          {(d.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-5">
                      <span className={`text-[11px] px-2 py-0.5 rounded ${
                        d.userResponse === 'approved'
                          ? 'bg-accent-green/10 text-accent-green'
                          : 'bg-white/5 text-text-muted'
                      }`}>
                        {d.userResponse ?? 'pending'}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-xs"><PnlCell value={d.pnl1h} /></td>
                    <td className="py-3 px-5 text-right font-mono text-xs"><PnlCell value={d.pnl24h} /></td>
                    <td className="py-3 px-5 text-right font-mono text-xs"><PnlCell value={d.pnl7d} /></td>
                    <td className="py-3 px-5 text-right text-text-muted text-xs">
                      {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center h-32 gap-2 mt-4">
          <p className="text-text-muted text-sm">No decisions found</p>
        </div>
      )}
    </div>
  );
}
