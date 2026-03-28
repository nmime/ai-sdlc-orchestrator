import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Chip, Spinner, EmptyState } from '@heroui/react';
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

const STATUS_COLOR: Record<string, 'default' | 'accent' | 'success' | 'warning' | 'danger'> = {
  running: 'accent',
  completed: 'success',
  failed: 'danger',
  cancelled: 'default',
};

export function SessionViewer() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: workflows, isLoading } = useQuery({
    queryKey: ['session-workflows'],
    queryFn: () => apiFetch<{ data: Workflow[] }>('/workflows?limit=20'),
    refetchInterval: 10000,
  });

  const { data: sessions } = useQuery({
    queryKey: ['sessions', selectedId],
    queryFn: () => apiFetch<AgentSession[]>(`/workflows/${selectedId}/sessions`),
    enabled: !!selectedId,
  });

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;

  const wfList = workflows?.data ?? [];
  const sessList = sessions ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Agent Sessions</h2>
        <p className="text-sm text-default-500">Select a workflow to inspect its agent sessions</p>
      </div>

      <div className="flex gap-4 h-[calc(100vh-14rem)]">
        <Card className="w-1/3 overflow-hidden">
          <Card.Header>
            <Card.Title className="text-sm">Workflows</Card.Title>
          </Card.Header>
          <div className="overflow-y-auto flex-1">
            {wfList.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-default-400">No workflows yet</div>
            ) : (
              <div className="divide-y divide-divider">
                {wfList.map((wf) => (
                  <button
                    key={wf.id}
                    onClick={() => setSelectedId(wf.id)}
                    className={`w-full text-left px-4 py-3 transition-colors hover:bg-default-100 ${
                      selectedId === wf.id ? 'bg-primary-50 border-l-3 border-primary' : ''
                    }`}
                  >
                    <p className="text-sm font-medium text-foreground truncate">{wf.taskTitle}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Chip color={STATUS_COLOR[wf.status] ?? 'default'} variant="soft" size="sm">{wf.status}</Chip>
                      <span className="text-xs text-default-400">{new Date(wf.startedAt).toLocaleDateString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="w-2/3 overflow-hidden">
          {selectedId ? (
            sessList.length > 0 ? (
              <>
                <Card.Header>
                  <Card.Title className="text-sm">Agent Sessions ({sessList.length})</Card.Title>
                </Card.Header>
                <div className="overflow-y-auto divide-y divide-divider">
                  {sessList.map((s) => (
                    <div key={s.id} className="px-5 py-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{s.stepId} <span className="text-default-400">loop {s.loopIteration}</span></p>
                          {s.agentSummary && <p className="text-xs text-default-500 mt-0.5">{s.agentSummary}</p>}
                        </div>
                        <Chip color={STATUS_COLOR[s.status] ?? 'default'} variant="soft" size="sm">{s.status}</Chip>
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        <StatMini label="Tokens" value={(s.inputTokens + s.outputTokens).toLocaleString()} />
                        <StatMini label="AI Cost" value={`$${(s.aiCostUsd ?? 0).toFixed(4)}`} />
                        <StatMini label="Sandbox" value={`$${(s.sandboxCostUsd ?? 0).toFixed(4)}`} />
                        <StatMini label="Total" value={`$${(s.totalCostUsd ?? 0).toFixed(4)}`} />
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        <StatMini label="Tools" value={String(s.toolCallCount)} />
                        <StatMini label="Turns" value={String(s.turnCount)} />
                        <StatMini label="Sandbox Time" value={`${s.sandboxDurationSeconds}s`} />
                        <StatMini label="Quality" value={s.qualityScore !== null ? String(s.qualityScore) : '—'} />
                      </div>
                      {s.errorCode && <p className="text-xs text-danger">Error: {s.errorCode}</p>}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-default-400 text-sm">No sessions for this workflow</div>
            )
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-default-300 mb-2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                <p className="text-sm text-default-400">Select a workflow to view sessions</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-default-50 rounded-lg px-2.5 py-1.5">
      <p className="text-[10px] text-default-400 uppercase tracking-wider">{label}</p>
      <p className="text-xs font-medium text-foreground tabular-nums">{value}</p>
    </div>
  );
}
