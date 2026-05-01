'use client';

import { useState } from 'react';

interface Decision {
  id: string;
  eventType: 'price_change' | 'whale_tx' | 'defi_position';
  token: string;
  reasoning: string;
  confidence: number;
  action: string | null;
  userResponse: 'pending' | 'approved' | 'skipped';
  createdAt: string;
}

const MOCK_DECISIONS: Decision[] = [
  {
    id: '1',
    eventType: 'whale_tx',
    token: 'SOL',
    reasoning: 'A whale moved 12,450 SOL ($1.87M) from Binance to an unknown wallet. This pattern historically precedes a 4-8% price increase within 24h based on 3 similar events in your history. Your portfolio is 62% SOL, so this is directly relevant.',
    confidence: 0.82,
    action: 'swap',
    userResponse: 'pending',
    createdAt: '2026-05-01T14:23:00Z',
  },
  {
    id: '2',
    eventType: 'price_change',
    token: 'JTO',
    reasoning: 'JTO dropped 12.3% in the last hour. You approved a buy on a similar 10% dip two weeks ago and it recovered 18%. Current price is $2.14, below your typical entry range.',
    confidence: 0.75,
    action: 'swap',
    userResponse: 'approved',
    createdAt: '2026-05-01T13:45:00Z',
  },
  {
    id: '3',
    eventType: 'defi_position',
    token: 'mSOL',
    reasoning: 'Your Marinade staking health ratio dropped to 1.15, approaching the 1.2 warning threshold. No immediate action needed but monitoring recommended. The ratio has been declining for 3 days.',
    confidence: 0.91,
    action: 'notify',
    userResponse: 'approved',
    createdAt: '2026-05-01T12:10:00Z',
  },
  {
    id: '4',
    eventType: 'price_change',
    token: 'BONK',
    reasoning: 'BONK is up 34% in 24h. You historically skip meme token pumps (4/5 skipped in your history). Confidence is low because this could be a local top.',
    confidence: 0.45,
    action: null,
    userResponse: 'skipped',
    createdAt: '2026-05-01T10:30:00Z',
  },
  {
    id: '5',
    eventType: 'whale_tx',
    token: 'USDC',
    reasoning: 'Large USDC movement ($5M) into a known Jupiter routing wallet. This typically signals upcoming large swaps. No direct portfolio impact detected.',
    confidence: 0.63,
    action: null,
    userResponse: 'skipped',
    createdAt: '2026-05-01T09:15:00Z',
  },
];

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  price_change: { label: 'Price', color: 'bg-accent-amber/15 text-accent-amber' },
  whale_tx: { label: 'Whale', color: 'bg-accent-purple/15 text-accent-purple' },
  defi_position: { label: 'DeFi', color: 'bg-accent-cyan/15 text-accent-cyan' },
};

const RESPONSE_STYLES: Record<string, string> = {
  pending: 'bg-accent-amber/10 text-accent-amber border-accent-amber/20',
  approved: 'bg-accent-green/10 text-accent-green border-accent-green/20',
  skipped: 'bg-white/5 text-text-muted border-white/10',
};

export default function ActivityFeed() {
  const [decisions] = useState<Decision[]>(MOCK_DECISIONS);

  const stats = [
    { label: 'Total Decisions', value: '47', sub: 'last 7 days' },
    { label: 'Approval Rate', value: '68%', sub: '32 approved' },
    { label: 'Avg Confidence', value: '0.74', sub: 'above threshold' },
    { label: 'Events Today', value: '12', sub: '5 proposed' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-2xl font-semibold tracking-tight">Activity Feed</h1>
        <p className="text-sm text-text-secondary mt-1">
          Real-time decisions from your Hunch agent
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={`glass rounded-xl p-4 animate-slide-up stagger-${i + 1}`}
          >
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
              {stat.label}
            </p>
            <p className="text-2xl font-semibold tracking-tight">{stat.value}</p>
            <p className="text-xs text-text-secondary mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Activity Timeline */}
      <div className="space-y-4">
        {decisions.map((d, i) => {
          const evt = EVENT_LABELS[d.eventType];
          const time = new Date(d.createdAt).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div
              key={d.id}
              className={`glass glass-hover rounded-xl p-5 animate-slide-up stagger-${i + 1} transition-all duration-300`}
            >
              {/* Top row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${evt.color}`}>
                    {evt.label}
                  </span>
                  <span className="text-sm font-medium">{d.token}</span>
                  {d.action && (
                    <span className="text-[11px] text-text-muted px-2 py-0.5 rounded bg-white/5 font-mono">
                      {d.action}
                    </span>
                  )}
                </div>
                <span className="text-xs text-text-muted font-mono">{time}</span>
              </div>

              {/* Reasoning */}
              <p className="text-sm text-text-secondary leading-relaxed mb-4">
                {d.reasoning}
              </p>

              {/* Bottom row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Confidence bar */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-text-muted">Confidence</span>
                    <div className="w-24 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full animate-bar-fill"
                        style={{
                          width: `${d.confidence * 100}%`,
                          background:
                            d.confidence > 0.7
                              ? 'linear-gradient(90deg, #22c55e, #06b6d4)'
                              : d.confidence > 0.5
                                ? 'linear-gradient(90deg, #f59e0b, #22c55e)'
                                : 'linear-gradient(90deg, #ef4444, #f59e0b)',
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono text-text-secondary">
                      {(d.confidence * 100).toFixed(0)}%
                    </span>
                  </div>

                  {/* Response badge */}
                  <span className={`text-[11px] px-2.5 py-1 rounded-full border ${RESPONSE_STYLES[d.userResponse]}`}>
                    {d.userResponse}
                  </span>
                </div>

                {/* Actions */}
                {d.userResponse === 'pending' && (
                  <div className="flex items-center gap-2">
                    <button className="text-xs px-3 py-1.5 rounded-lg bg-accent-green/10 text-accent-green border border-accent-green/20 hover:bg-accent-green/20 transition-colors">
                      Execute
                    </button>
                    <button className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-text-secondary border border-white/10 hover:bg-white/10 transition-colors">
                      Skip
                    </button>
                    <button className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-text-muted border border-white/10 hover:bg-white/10 transition-colors">
                      Why?
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
