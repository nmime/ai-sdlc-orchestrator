import { useQuery } from '@tanstack/react-query';
import { Card, Chip, Spinner, EmptyState } from '@heroui/react';
import { apiFetch } from '../lib/api';

interface Workflow {
  id: string;
  taskTitle: string;
  status: string;
  repoUrl: string;
  totalCostUsd: number;
  startedAt: string;
  completedAt?: string;
}

const STATUS_COLOR: Record<string, 'default' | 'accent' | 'success' | 'warning' | 'danger'> = {
  queued: 'default',
  running: 'accent',
  awaiting_gate: 'warning',
  awaiting_ci: 'warning',
  completed: 'success',
  failed: 'danger',
  cancelled: 'default',
};

export function WorkflowList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['workflows'],
    queryFn: () => apiFetch<{ data: Workflow[]; total: number }>('/workflows'),
    refetchInterval: 5000,
  });

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (error) return <Card><Card.Content><p className="text-danger text-sm">Error: {(error as Error).message}</p></Card.Content></Card>;

  const workflows = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Workflows</h2>
          <p className="text-sm text-default-500">{data?.total ?? 0} total workflows</p>
        </div>
      </div>

      {workflows.length === 0 ? (
        <Card>
          <Card.Content className="py-16">
            <EmptyState>
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-default-100">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-default-400"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                </div>
                <h3 className="text-base font-medium text-foreground">No workflows yet</h3>
                <p className="mt-1 text-sm text-default-500">Workflows will appear here when they are created via the API or triggered by webhooks.</p>
              </div>
            </EmptyState>
          </Card.Content>
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-divider">
            {workflows.map((wf) => (
              <div key={wf.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{wf.taskTitle}</p>
                  <p className="text-xs text-default-400 mt-0.5 truncate">{wf.repoUrl}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Chip color={STATUS_COLOR[wf.status] ?? 'default'} variant="soft" size="sm">{wf.status.replace(/_/g, ' ')}</Chip>
                  <span className="text-xs font-medium text-default-600 tabular-nums">${(wf.totalCostUsd ?? 0).toFixed(2)}</span>
                  <span className="text-xs text-default-400 tabular-nums">{new Date(wf.startedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
