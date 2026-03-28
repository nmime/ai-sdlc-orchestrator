import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Chip, Spinner } from '@heroui/react';
import { apiFetch } from '../lib/api';
import { Monitor, Cpu, Coins, Clock } from 'lucide-react';

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

const STATUS_COLOR: Record<string, 'default' | 'accent' | 'success' | 'danger'> = {
  running: 'accent', completed: 'success', failed: 'danger', cancelled: 'default',
};

export function SessionsPage() {
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Agent Sessions</h1>
        <p className="text-sm text-default-500 mt-1">Inspect agent sessions per workflow</p>
      </div>

      <div className="flex gap-6 h-[calc(100vh-14rem)]">
        <Card className="w-1/3 overflow-hidden flex flex-col">
          <Card.Header><Card.Title className="text-sm">Workflows</Card.Title></Card.Header>
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
                      selectedId === wf.id ? 'bg-primary/5 border-l-3 border-primary' : ''
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

        <Card className="w-2/3 overflow-hidden flex flex-col">
          {selectedId ? (
            sessList.length > 0 ? (
              <>
                <Card.Header><Card.Title className="text-sm">Sessions ({sessList.length})</Card.Title></Card.Header>
                <div className="overflow-y-auto flex-1 divide-y divide-divider">
                  {sessList.map((s) => (
                    <div key={s.id} className="px-5 py-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{s.stepId} <span className="text-default-400">loop {s.loopIteration}</span></p>
                          {s.agentSummary && <p className="text-xs text-default-500 mt-0.5">{s.agentSummary}</p>}
                        </div>
                        <Chip color={STATUS_COLOR[s.status] ?? 'default'} variant="soft" size="sm">{s.status}</Chip>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <MiniStat icon={Cpu} label="Tokens" value={(s.inputTokens + s.outputTokens).toLocaleString()} />
                        <MiniStat icon={Coins} label="AI Cost" value={`$${(s.aiCostUsd ?? 0).toFixed(4)}`} />
                        <MiniStat icon={Monitor} label="Sandbox" value={`$${(s.sandboxCostUsd ?? 0).toFixed(4)}`} />
                        <MiniStat icon={Clock} label="Duration" value={`${s.sandboxDurationSeconds}s`} />
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
                <Monitor size={32} className="mx-auto text-default-300 mb-2" />
                <p className="text-sm text-default-400">Select a workflow to view sessions</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="bg-default-50 rounded-lg px-2.5 py-2 flex items-center gap-2">
      <Icon size={14} className="text-default-400 flex-shrink-0" />
      <div>
        <p className="text-[10px] text-default-400 uppercase">{label}</p>
        <p className="text-xs font-medium text-foreground tabular-nums">{value}</p>
      </div>
    </div>
  );
}
