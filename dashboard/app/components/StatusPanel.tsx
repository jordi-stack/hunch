'use client';

import { useState, useEffect } from 'react';

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function StatusPanel() {
  const [health, setHealth] = useState<{
    uptime: number;
    lastConsolidation: string | null;
    webhookConfigured: boolean;
    totalEventsProcessed: number;
  } | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => { if (!d.error) setHealth(d); })
      .catch(() => {});
  }, []);

  if (!health) return null;

  const uptimeH = Math.floor(health.uptime / 3600);
  const uptimeM = Math.floor((health.uptime % 3600) / 60);

  const lastRun = health.lastConsolidation
    ? formatRelativeTime(new Date(health.lastConsolidation))
    : 'never';

  return (
    <div className="px-5 py-3 border-t border-white/5 space-y-1.5">
      <p className="text-[11px] text-text-muted uppercase tracking-wider mb-2">Agent Status</p>
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-muted">Uptime</span>
        <span className="font-mono">{uptimeH}h {uptimeM}m</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-muted">Last Run</span>
        <span className="font-mono">{lastRun}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-muted">Webhook</span>
        <span className={health.webhookConfigured ? 'text-accent-green' : 'text-accent-red'}>
          {health.webhookConfigured ? '● Live' : '● Off'}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-muted">Events</span>
        <span className="font-mono">{health.totalEventsProcessed}</span>
      </div>
    </div>
  );
}
