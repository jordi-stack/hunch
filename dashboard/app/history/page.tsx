'use client';

import { useState } from 'react';

interface DecisionWithOutcome {
  id: string;
  eventType: string;
  reasoning: string;
  confidence: number;
  userResponse: string;
  pnl1h: number | null;
  pnl24h: number | null;
  createdAt: string;
}

export default function DecisionHistory() {
  const [decisions] = useState<DecisionWithOutcome[]>([]);

  if (decisions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <h1 className="text-2xl font-bold">Decision History</h1>
        <p className="text-gray-500">No decision history available</p>
        <p className="text-sm text-gray-600">
          Decisions will appear here once your agent starts processing events
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Decision History</h1>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-3 px-4 text-gray-400 font-medium">
                Event
              </th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">
                Confidence
              </th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">
                Response
              </th>
              <th className="text-right py-3 px-4 text-gray-400 font-medium">
                PnL 1h
              </th>
              <th className="text-right py-3 px-4 text-gray-400 font-medium">
                PnL 24h
              </th>
              <th className="text-right py-3 px-4 text-gray-400 font-medium">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {decisions.map((d) => (
              <tr key={d.id} className="border-b border-gray-800/50">
                <td className="py-3 px-4">
                  <span className="text-xs font-mono px-2 py-1 rounded bg-gray-800 text-gray-300">
                    {d.eventType}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-300">{d.confidence}%</td>
                <td className="py-3 px-4">
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      d.userResponse === 'approved'
                        ? 'bg-green-900 text-green-300'
                        : 'bg-gray-800 text-gray-300'
                    }`}
                  >
                    {d.userResponse}
                  </span>
                </td>
                <td className="py-3 px-4 text-right text-gray-300">
                  {d.pnl1h !== null ? `${d.pnl1h > 0 ? '+' : ''}${d.pnl1h}%` : '-'}
                </td>
                <td className="py-3 px-4 text-right text-gray-300">
                  {d.pnl24h !== null ? `${d.pnl24h > 0 ? '+' : ''}${d.pnl24h}%` : '-'}
                </td>
                <td className="py-3 px-4 text-right text-gray-500">
                  {new Date(d.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
