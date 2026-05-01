'use client';

import { useState } from 'react';

interface HistoryEntry {
  id: string;
  eventType: 'price_change' | 'whale_tx' | 'defi_position';
  token: string;
  confidence: number;
  action: string | null;
  userResponse: 'approved' | 'skipped';
  pnl1h: number | null;
  pnl24h: number | null;
  pnl7d: number | null;
  createdAt: string;
}

const MOCK_HISTORY: HistoryEntry[] = [
  { id: '1', eventType: 'whale_tx', token: 'SOL', confidence: 0.85, action: 'swap', userResponse: 'approved', pnl1h: 2.1, pnl24h: 5.4, pnl7d: 12.3, createdAt: '2026-04-30T18:00:00Z' },
  { id: '2', eventType: 'price_change', token: 'JTO', confidence: 0.72, action: 'swap', userResponse: 'approved', pnl1h: -0.8, pnl24h: 3.2, pnl7d: 8.1, createdAt: '2026-04-30T14:30:00Z' },
  { id: '3', eventType: 'defi_position', token: 'mSOL', confidence: 0.91, action: 'notify', userResponse: 'approved', pnl1h: 0.0, pnl24h: 0.0, pnl7d: 0.0, createdAt: '2026-04-30T10:15:00Z' },
  { id: '4', eventType: 'price_change', token: 'BONK', confidence: 0.38, action: null, userResponse: 'skipped', pnl1h: -4.2, pnl24h: -11.5, pnl7d: -22.0, createdAt: '2026-04-29T22:00:00Z' },
  { id: '5', eventType: 'whale_tx', token: 'RAY', confidence: 0.79, action: 'swap', userResponse: 'approved', pnl1h: 1.5, pnl24h: 7.8, pnl7d: 15.2, createdAt: '2026-04-29T16:45:00Z' },
  { id: '6', eventType: 'price_change', token: 'ORCA', confidence: 0.66, action: 'swap', userResponse: 'skipped', pnl1h: 0.3, pnl24h: -1.2, pnl7d: -3.4, createdAt: '2026-04-29T11:20:00Z' },
  { id: '7', eventType: 'whale_tx', token: 'USDC', confidence: 0.55, action: null, userResponse: 'skipped', pnl1h: 0.0, pnl24h: 0.0, pnl7d: 0.0, createdAt: '2026-04-28T20:10:00Z' },
  { id: '8', eventType: 'defi_position', token: 'SOL', confidence: 0.88, action: 'deposit', userResponse: 'approved', pnl1h: 0.5, pnl24h: 2.1, pnl7d: 6.7, createdAt: '2026-04-28T09:30:00Z' },
  { id: '9', eventType: 'price_change', token: 'WEN', confidence: 0.42, action: null, userResponse: 'skipped', pnl1h: -2.1, pnl24h: -8.3, pnl7d: -15.6, createdAt: '2026-04-27T15:00:00Z' },
  { id: '10', eventType: 'whale_tx', token: 'PYTH', confidence: 0.81, action: 'swap', userResponse: 'approved', pnl1h: 1.8, pnl24h: 4.5, pnl7d: 9.2, createdAt: '2026-04-27T08:45:00Z' },
];

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
  const [history] = useState<HistoryEntry[]>(MOCK_HISTORY);

  const filtered = filter === 'all' ? history : history.filter((h) => h.eventType === filter);

  const totalApproved = history.filter((h) => h.userResponse === 'approved').length;
  const avgPnl24h = history
    .filter((h) => h.pnl24h !== null && h.userResponse === 'approved')
    .reduce((sum, h) => sum + (h.pnl24h ?? 0), 0) / totalApproved || 0;
  const winRate = history.filter((h) => h.pnl24h !== null && h.pnl24h > 0 && h.userResponse === 'approved').length / totalApproved * 100 || 0;

  const stats = [
    { label: 'Total Decisions', value: history.length.toString() },
    { label: 'Approved', value: `${totalApproved}` },
    { label: 'Win Rate', value: `${winRate.toFixed(0)}%` },
    { label: 'Avg PnL (24h)', value: `${avgPnl24h > 0 ? '+' : ''}${avgPnl24h.toFixed(1)}%` },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-2xl font-semibold tracking-tight">Decision History</h1>
        <p className="text-sm text-text-secondary mt-1">
          Past decisions and their outcomes
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
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left py-3 px-5 text-[11px] text-text-muted uppercase tracking-wider font-medium">Event</th>
              <th className="text-left py-3 px-5 text-[11px] text-text-muted uppercase tracking-wider font-medium">Token</th>
              <th className="text-left py-3 px-5 text-[11px] text-text-muted uppercase tracking-wider font-medium">Confidence</th>
              <th className="text-left py-3 px-5 text-[11px] text-text-muted uppercase tracking-wider font-medium">Response</th>
              <th className="text-right py-3 px-5 text-[11px] text-text-muted uppercase tracking-wider font-medium">1h</th>
              <th className="text-right py-3 px-5 text-[11px] text-text-muted uppercase tracking-wider font-medium">24h</th>
              <th className="text-right py-3 px-5 text-[11px] text-text-muted uppercase tracking-wider font-medium">7d</th>
              <th className="text-right py-3 px-5 text-[11px] text-text-muted uppercase tracking-wider font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, i) => {
              const evt = EVENT_LABELS[d.eventType];
              const date = new Date(d.createdAt);
              return (
                <tr
                  key={d.id}
                  className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors animate-slide-up stagger-${Math.min(i + 1, 10)}`}
                >
                  <td className="py-3 px-5">
                    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${evt.color}`}>
                      {evt.label}
                    </span>
                  </td>
                  <td className="py-3 px-5 font-medium">{d.token}</td>
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
                      {d.userResponse}
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
      </div>
    </div>
  );
}
