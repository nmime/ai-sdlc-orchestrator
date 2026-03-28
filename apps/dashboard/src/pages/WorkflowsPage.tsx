import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Chip, Spinner, EmptyState } from '@heroui/react';
import { apiFetch } from '../lib/api';
import { GitBranch, Search } from 'lucide-react';

interface Workflow {
  id: string;
  taskTitle: string;
  status: string;
  repoUrl: string;
  branchName?: string;
  totalCostUsd: number;
  startedAt: string;
  completedAt?: string;
  agentProvider?: string;
}

const STATUS_COLOR: Record<string, 'default' | 'accent' | 'success' | 'warning' | 'danger'> = {
  queued: 'default', running: 'accent', awaiting_gate: 'warning',
  awaiting_ci: 'warning', completed: 'success', failed: 'danger', cancelled: 'default',
};

export function WorkflowsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['workflows', statusFilter],
    queryFn: () => apiFetch<{ data: Workflow[]; total: number }>(
      `/workflows?limit=50${statusFilter !== 'all' ? `&status=${statusFilter}` : ''}`
    ),
    refetchInterval: 5000,
  });

  const workflows = (data?.data ?? []).filter(wf =>
    !search || wf.taskTitle.toLowerCase().includes(search.toLowerCase()) || wf.repoUrl.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Workflows</h1>
          <p className="text-sm text-default-500 mt-1">{data?.total ?? 0} total workflows</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-default-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workflows..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-divider bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-default-400"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-divider bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All statuses</option>
          <option value="running">Running</option>
          <option value="awaiting_gate">Awaiting Gate</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : error ? (
        <Card><Card.Content><p className="text-danger text-sm">Error: {(error as Error).message}</p></Card.Content></Card>
      ) : workflows.length === 0 ? (
        <Card>
          <Card.Content className="py-16">
            <EmptyState>
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-default-100">
                  <GitBranch size={24} className="text-default-400" />
                </div>
                <h3 className="text-base font-medium text-foreground">No workflows found</h3>
                <p className="mt-1 text-sm text-default-500">Workflows appear when triggered by webhooks or the API.</p>
              </div>
            </EmptyState>
          </Card.Content>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-divider">
                  <th className="px-5 py-3 text-left text-xs font-medium text-default-500 uppercase tracking-wider">Task</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-default-500 uppercase tracking-wider">Repository</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-default-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-default-500 uppercase tracking-wider">Cost</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-default-500 uppercase tracking-wider">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {workflows.map((wf) => (
                  <tr key={wf.id} className="hover:bg-default-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-foreground truncate max-w-[300px]">{wf.taskTitle}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-sm text-default-500 truncate max-w-[200px]">{wf.repoUrl}</p>
                      {wf.branchName && <p className="text-xs text-default-400 mt-0.5 font-mono">{wf.branchName}</p>}
                    </td>
                    <td className="px-5 py-3.5">
                      <Chip color={STATUS_COLOR[wf.status] ?? 'default'} variant="soft" size="sm">{wf.status.replace(/_/g, ' ')}</Chip>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-medium tabular-nums">${(wf.totalCostUsd ?? 0).toFixed(2)}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-xs text-default-400 tabular-nums">{new Date(wf.startedAt).toLocaleString()}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
