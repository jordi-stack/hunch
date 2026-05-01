'use client';

import { useState } from 'react';

interface SemanticMemoryEntry {
  id: string;
  key: string;
  value: string;
  confidence: number;
  source: string;
  updatedAt: string;
}

export default function MemoryInspector() {
  const [memories] = useState<SemanticMemoryEntry[]>([]);

  if (memories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <h1 className="text-2xl font-bold">Memory Inspector</h1>
        <p className="text-gray-500">No semantic memories stored</p>
        <p className="text-sm text-gray-600">
          Memories will appear here as your agent learns from interactions
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Memory Inspector</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {memories.map((memory) => (
          <div
            key={memory.id}
            className="border border-gray-800 rounded-lg p-4 bg-gray-900"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-white">{memory.key}</h3>
              <span className="text-xs text-gray-400">
                {memory.confidence}%
              </span>
            </div>
            <p className="text-sm text-gray-300 mb-3">{memory.value}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-400">
                {memory.source}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(memory.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
