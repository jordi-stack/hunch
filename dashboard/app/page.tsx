'use client';

import { useState, useEffect } from 'react';

interface Decision {
  id: string;
  eventType: string;
  eventPayload: Record<string, unknown>;
  reasoningTrace: string;
  confidence: number;
  actionType: string | null;
  actionPayload: Record<string, unknown> | null;
  toolCalls: Array<{ tool: string; input: unknown; output: unknown }>;
  userResponse: string | null;
  executedAt: string | null;
  pnl1h: number | null;
  pnl24h: number | null;
  pnl7d: number | null;
  createdAt: string;
}

interface Stats {
  totalDecisions: number;
  approvedCount: number;
  approvalRate: number;
  avgConfidence: number;
  eventsToday: number;
  proposedToday: number;
}

interface PriceData {
  mint: string;
  price: number;
  change24h: number;
}

const API_BASE = '';

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

function Sparkline({ mint }: { mint: string }) {
  const [price, setPrice] = useState<PriceData | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/price/${mint}`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setPrice(d); })
      .catch(() => {});
  }, [mint]);

  if (!price) return null;

  const positive = price.change24h >= 0;
  const color = positive ? '#22c55e' : '#ef4444';
  const points = generateSparklinePoints(positive);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-secondary font-mono">${price.price.toFixed(2)}</span>
      <svg width="60" height="20" viewBox="0 0 60 20">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className={`text-xs font-mono ${positive ? 'text-accent-green' : 'text-accent-red'}`}>
        {positive ? '+' : ''}{price.change24h.toFixed(1)}%
      </span>
    </div>
  );
}

function generateSparklinePoints(positive: boolean): string {
  const pts: string[] = [];
  let y = positive ? 15 : 5;
  for (let x = 0; x <= 60; x += 5) {
    y += (Math.random() - (positive ? 0.45 : 0.55)) * 4;
    y = Math.max(1, Math.min(19, y));
    pts.push(`${x},${y.toFixed(1)}`);
  }
  return pts.join(' ');
}

function TraceViewer({ decisionId }: { decisionId: string }) {
  const [trace, setTrace] = useState<Decision | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/decisions/${decisionId}`)
      .then((r) => r.json())
      .then((d) => { setTrace(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [decisionId]);

  if (loading) {
    return (
      <div className="mt-3 pt-3 border-t border-white/5">
        <div className="animate-shimmer h-20 rounded-lg" />
      </div>
    );
  }

  if (!trace) return null;

  return (
    <div className="mt-3 pt-3 border-t border-white/5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-accent-purple">Reasoning Trace</span>
        <span className="text-[11px] text-text-muted">Tier 2 / Sonnet</span>
      </div>
      <div className="bg-surface-0 rounded-lg p-3 font-mono text-xs text-text-secondary leading-relaxed max-h-64 overflow-y-auto">
        <pre className="whitespace-pre-wrap">{trace.reasoningTrace}</pre>
      </div>
      {trace.toolCalls && trace.toolCalls.length > 0 && (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[11px] bg-accent-purple/10 text-accent-purple px-2 py-0.5 rounded">
            {trace.toolCalls.length} tool call{trace.toolCalls.length > 1 ? 's' : ''}
          </span>
          {trace.toolCalls.map((tc, i) => (
            <span key={i} className="text-[11px] bg-white/5 text-text-muted px-2 py-0.5 rounded font-mono">
              {tc.tool}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="glass rounded-xl p-5 animate-shimmer">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-5 rounded-full bg-white/5" />
          <div className="w-10 h-4 rounded bg-white/5" />
        </div>
        <div className="w-12 h-3 rounded bg-white/5" />
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-3 rounded bg-white/5 w-full" />
        <div className="h-3 rounded bg-white/5 w-3/4" />
      </div>
      <div className="flex items-center justify-between">
        <div className="w-32 h-4 rounded bg-white/5" />
        <div className="w-20 h-6 rounded bg-white/5" />
      </div>
    </div>
  );
}

export default function ActivityFeed() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/decisions?limit=20`).then((r) => r.json()),
      fetch(`${API_BASE}/api/stats`).then((r) => r.json()),
    ])
      .then(([decisionsData, statsData]) => {
        setDecisions(decisionsData.decisions);
        setStats(statsData);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

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
        { label: 'Total Decisions', value: stats.totalDecisions.toString(), sub: 'all time' },
        { label: 'Approval Rate', value: `${(stats.approvalRate * 100).toFixed(0)}%`, sub: `${stats.approvedCount} approved` },
        { label: 'Avg Confidence', value: stats.avgConfidence.toFixed(2), sub: 'across all events' },
        { label: 'Events Today', value: stats.eventsToday.toString(), sub: `${stats.proposedToday} proposed` },
      ]
    : [];

  return (
    <div>
      <div className="mb-8 animate-fade-in">
        <h1 className="text-2xl font-semibold tracking-tight">Activity Feed</h1>
        <p className="text-sm text-text-secondary mt-1">Real-time decisions from your Hunch agent</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass rounded-xl p-4 animate-shimmer">
                <div className="w-20 h-3 rounded bg-white/5 mb-2" />
                <div className="w-16 h-7 rounded bg-white/5" />
              </div>
            ))
          : statsCards.map((stat, i) => (
              <div key={stat.label} className={`glass rounded-xl p-4 animate-slide-up stagger-${i + 1}`}>
                <p className="text-xs text-text-muted uppercase tracking-wider mb-1">{stat.label}</p>
                <p className="text-2xl font-semibold tracking-tight">{stat.value}</p>
                <p className="text-xs text-text-secondary mt-0.5">{stat.sub}</p>
              </div>
            ))}
      </div>

      {/* Activity Timeline */}
      <div className="space-y-4">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
          : decisions.map((d, i) => {
              const evt = EVENT_LABELS[d.eventType] ?? { label: d.eventType, color: 'bg-white/10 text-text-secondary' };
              const time = new Date(d.createdAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              });
              const tokenSymbol =
                (d.eventPayload as Record<string, unknown>)?.tokenSymbol as string ??
                (d.eventPayload as Record<string, unknown>)?.tokenMint as string ??
                '?';
              const tokenMint =
                (d.eventPayload as Record<string, unknown>)?.tokenMint as string ?? '';
              const isPending = !d.userResponse;

              return (
                <div
                  key={d.id}
                  className={`glass glass-hover rounded-xl p-5 animate-slide-up stagger-${Math.min(i + 1, 10)} transition-all duration-300`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${evt.color}`}>
                        {evt.label}
                      </span>
                      <span className="text-sm font-medium">{tokenSymbol}</span>
                      {d.actionType && (
                        <span className="text-[11px] text-text-muted px-2 py-0.5 rounded bg-white/5 font-mono">
                          {d.actionType}
                        </span>
                      )}
                      {tokenMint && <Sparkline mint={tokenMint} />}
                    </div>
                    <span className="text-xs text-text-muted font-mono">{time}</span>
                  </div>

                  <p className="text-sm text-text-secondary leading-relaxed mb-4">
                    {d.reasoningTrace.length > 300
                      ? d.reasoningTrace.slice(0, 300) + '...'
                      : d.reasoningTrace}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
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
                      {d.userResponse && (
                        <span className={`text-[11px] px-2.5 py-1 rounded-full border ${RESPONSE_STYLES[d.userResponse] ?? RESPONSE_STYLES.pending}`}>
                          {d.userResponse}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isPending && (
                        <>
                          <button className="text-xs px-3 py-1.5 rounded-lg bg-accent-green/10 text-accent-green border border-accent-green/20 hover:bg-accent-green/20 transition-colors">
                            Execute
                          </button>
                          <button className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-text-secondary border border-white/10 hover:bg-white/10 transition-colors">
                            Skip
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-text-muted border border-white/10 hover:bg-white/10 transition-colors"
                      >
                        {expandedId === d.id ? 'Hide' : 'Why?'}
                      </button>
                    </div>
                  </div>

                  {expandedId === d.id && <TraceViewer decisionId={d.id} />}
                </div>
              );
            })}
      </div>

      {!loading && decisions.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 gap-2">
          <p className="text-text-muted text-sm">No decisions yet</p>
          <p className="text-text-muted text-xs">Events will appear here once your agent processes them</p>
        </div>
      )}
    </div>
  );
}
