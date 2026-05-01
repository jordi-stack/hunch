'use client';

import { useState } from 'react';

interface Decision {
  id: string;
  eventType: string;
  reasoning: string;
  confidence: number;
  userResponse: string;
  createdAt: string;
}

export default function ActivityFeed() {
  const [decisions] = useState<Decision[]>([]);
  const [loading] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading decisions...</p>
      </div>
    );
  }

  if (decisions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <h1 className="text-2xl font-bold">Activity Feed</h1>
        <p className="text-gray-500">No decisions yet</p>
        <p className="text-sm text-gray-600">
          Connect your Telegram bot to start receiving decisions
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold mb-6">Activity Feed</h1>
      {decisions.map((decision) => (
        <div
          key={decision.id}
          className="border border-gray-800 rounded-lg p-4 bg-gray-900"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono px-2 py-1 rounded bg-gray-800 text-gray-300">
              {decision.eventType}
            </span>
            <span className="text-sm text-gray-400">
              {decision.confidence}% confidence
            </span>
          </div>
          <p className="text-sm text-gray-200 mb-3">{decision.reasoning}</p>
          <div className="flex items-center justify-between">
            <span className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300">
              {decision.userResponse}
            </span>
            <span className="text-xs text-gray-500">
              {new Date(decision.createdAt).toLocaleString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
