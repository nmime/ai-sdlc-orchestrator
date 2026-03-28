import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

interface Workflow {
  id: string;
  taskTitle: string;
  status: string;
  startedAt: string;
}

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

const statusColors: Record<string, string> = {
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export function SessionViewer() {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  const { data: workflows, isLoading } = useQuery({
    queryKey: ['session-workflows'],
    queryFn: () => apiFetch<{ data: Workflow[] }>('/workflows?limit=20'),
    refetchInterval: 10000,
  });

  const { data: sessions } = useQuery({
    queryKey: ['sessions', selectedWorkflowId],
    queryFn: () => apiFetch<AgentSession[]>(`/workflows/${selectedWorkflowId}/sessions`),
    enabled: !!selectedWorkflowId,
  });

  if (isLoading) return <div className="text-center py-8">Loading...</div>;

  const workflowList = workflows?.data ?? [];
  const sessionList = sessions ?? [];

  return (
    <div className="flex gap-4 h-[calc(100vh-12rem)]">
      <div className="w-1/3 bg-white rounded-lg shadow overflow-auto">
        <div className="px-4 py-3 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold">Workflows</h2>
          <p className="text-xs text-gray-500">Select a workflow to view sessions</p>
        </div>
        <div className="divide-y">
          {workflowList.map((wf) => (
            <button
              key={wf.id}
              onClick={() => setSelectedWorkflowId(wf.id)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${
                selectedWorkflowId === wf.id ? 'bg-indigo-50 border-l-2 border-indigo-500' : ''
              }`}
            >
              <p className="text-sm font-medium truncate">{wf.taskTitle}</p>
              <div className="flex gap-3 mt-1 text-xs text-gray-500">
                <span className={`px-1.5 py-0.5 rounded ${statusColors[wf.status] || 'bg-gray-100'}`}>{wf.status}</span>
                <span>{new Date(wf.startedAt).toLocaleString()}</span>
              </div>
            </button>
          ))}
          {workflowList.length === 0 && <div className="px-4 py-8 text-center text-gray-500">No workflows yet</div>}
        </div>
      </div>

      <div className="w-2/3 bg-white rounded-lg shadow overflow-auto">
        {selectedWorkflowId ? (
          sessionList.length > 0 ? (
            <div className="divide-y">
              <div className="px-4 py-3 border-b sticky top-0 bg-white">
                <h3 className="text-sm font-semibold">Agent Sessions ({sessionList.length})</h3>
              </div>
              {sessionList.map((s) => (
                <div key={s.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{s.stepId} (loop {s.loopIteration})</p>
                      {s.agentSummary && <p className="text-xs text-gray-500 mt-0.5">{s.agentSummary}</p>}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs ${statusColors[s.status] || 'bg-gray-100'}`}>{s.status}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs text-gray-600">
                    <div>Tokens: {(s.inputTokens + s.outputTokens).toLocaleString()}</div>
                    <div>AI: ${(s.aiCostUsd ?? 0).toFixed(4)}</div>
                    <div>Sandbox: ${(s.sandboxCostUsd ?? 0).toFixed(4)}</div>
                    <div>Total: ${(s.totalCostUsd ?? 0).toFixed(4)}</div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs text-gray-500">
                    <div>Tools: {s.toolCallCount}</div>
                    <div>Turns: {s.turnCount}</div>
                    <div>Sandbox: {s.sandboxDurationSeconds}s</div>
                    <div>{s.qualityScore !== null ? `Quality: ${s.qualityScore}` : ''}</div>
                  </div>
                  {s.errorCode && <p className="text-xs text-red-600">Error: {s.errorCode}</p>}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">No sessions for this workflow</div>
          )
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">Select a workflow to view its agent sessions</div>
        )}
      </div>
    </div>
  );
}
