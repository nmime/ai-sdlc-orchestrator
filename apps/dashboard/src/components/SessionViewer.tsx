import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

interface AgentSession {
  id: string;
  agentSummary: string;
  stepId: string;
  loopIteration: number;
  inputTokens: number;
  outputTokens: number;
  aiCostUsd: number;
  sandboxCostUsd: number;
  totalCostUsd: number;
  toolCallCount: number;
  sandboxDurationSeconds: number;
  turnCount: number;
  qualityScore: number | null;
  status: string;
  errorCode: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface ToolCall {
  id: string;
  sequenceNumber: number;
  toolName: string;
  inputSummary: Record<string, unknown>;
  outputSummary: Record<string, unknown>;
  status: string;
  durationMs: number;
  createdAt: string;
}

async function fetchSessions(): Promise<{ items: AgentSession[]; total: number }> {
  const res = await fetch('/api/sessions');
  if (!res.ok) throw new Error('Failed to fetch sessions');
  return res.json();
}

async function fetchToolCalls(sessionId: string): Promise<ToolCall[]> {
  const res = await fetch(`/api/sessions/${sessionId}/tool-calls`);
  if (!res.ok) throw new Error('Failed to fetch tool calls');
  return res.json();
}

const statusColors: Record<string, string> = {
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export function SessionViewer() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['sessions'],
    queryFn: fetchSessions,
    refetchInterval: 5000,
  });

  const { data: toolCalls } = useQuery({
    queryKey: ['tool-calls', selectedId],
    queryFn: () => fetchToolCalls(selectedId!),
    enabled: !!selectedId,
  });

  if (isLoading) return <div className="text-center py-8">Loading sessions...</div>;
  if (error) return <div className="text-center py-8 text-red-600">Error loading sessions</div>;

  const sessions = data?.items ?? [];
  const selected = sessions.find((s) => s.id === selectedId);

  return (
    <div className="flex gap-4 h-[calc(100vh-12rem)]">
      <div className="w-1/3 bg-white rounded-lg shadow overflow-auto">
        <div className="px-4 py-3 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold">Agent Sessions ({data?.total ?? 0})</h2>
        </div>
        <div className="divide-y">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => setSelectedId(session.id)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${
                selectedId === session.id ? 'bg-indigo-50 border-l-2 border-indigo-500' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium truncate">{session.agentSummary}</p>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[session.status] || 'bg-gray-100'}`}>
                  {session.status}
                </span>
              </div>
              <div className="flex gap-3 mt-1 text-xs text-gray-500">
                <span>Step: {session.stepId}</span>
                <span>Loop: {session.loopIteration}</span>
                <span>${session.totalCostUsd.toFixed(4)}</span>
              </div>
            </button>
          ))}
          {sessions.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-500">No sessions yet</div>
          )}
        </div>
      </div>

      <div className="w-2/3 bg-white rounded-lg shadow overflow-auto">
        {selected ? (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{selected.agentSummary}</h3>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[selected.status] || 'bg-gray-100'}`}>
                {selected.status}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Input Tokens', value: selected.inputTokens.toLocaleString() },
                { label: 'Output Tokens', value: selected.outputTokens.toLocaleString() },
                { label: 'Tool Calls', value: selected.toolCallCount },
                { label: 'AI Cost', value: `$${selected.aiCostUsd.toFixed(4)}` },
                { label: 'Sandbox Cost', value: `$${selected.sandboxCostUsd.toFixed(4)}` },
                { label: 'Total Cost', value: `$${selected.totalCostUsd.toFixed(4)}` },
                { label: 'Turns', value: selected.turnCount },
                { label: 'Sandbox Duration', value: `${selected.sandboxDurationSeconds}s` },
                { label: 'Quality Score', value: selected.qualityScore ?? 'N/A' },
              ].map((stat) => (
                <div key={stat.label} className="bg-gray-50 rounded p-2">
                  <p className="text-xs text-gray-500">{stat.label}</p>
                  <p className="text-sm font-semibold">{stat.value}</p>
                </div>
              ))}
            </div>

            {selected.errorCode && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <p className="text-sm text-red-700">Error: {selected.errorCode}</p>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold mb-2">Tool Calls</h4>
              {toolCalls && toolCalls.length > 0 ? (
                <div className="border rounded divide-y">
                  {toolCalls.map((tc) => (
                    <div key={tc.id} className="px-3 py-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">#{tc.sequenceNumber}</span>
                          <span className="text-sm font-medium">{tc.toolName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-xs ${
                            tc.status === 'success' ? 'bg-green-100 text-green-700' :
                            tc.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-gray-100'
                          }`}>
                            {tc.status}
                          </span>
                          <span className="text-xs text-gray-400">{tc.durationMs}ms</span>
                        </div>
                      </div>
                      {tc.inputSummary && (
                        <pre className="mt-1 text-xs text-gray-600 bg-gray-50 p-1 rounded overflow-auto max-h-20">
                          {JSON.stringify(tc.inputSummary, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No tool calls recorded</p>
              )}
            </div>

            <div className="text-xs text-gray-400">
              <span>Started: {new Date(selected.startedAt).toLocaleString()}</span>
              {selected.completedAt && <span className="ml-4">Completed: {new Date(selected.completedAt).toLocaleString()}</span>}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">Select a session to view details</div>
        )}
      </div>
    </div>
  );
}
