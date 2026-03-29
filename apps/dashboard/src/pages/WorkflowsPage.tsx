import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Card, Chip } from '@heroui/react';
import { apiFetch, isDemoMode } from '../lib/api';
import { Pagination } from '../components/Pagination';
import { RelativeTime } from '../components/RelativeTime';
import { SkeletonTable } from '../components/Skeleton';
import { GitBranch, Search, ExternalLink, Plus } from 'lucide-react';

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

const PAGE_SIZE = 20;

export function WorkflowsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['workflows', statusFilter, page],
    queryFn: () => apiFetch<{ data: Workflow[]; total: number }>(
      `/workflows?limit=${PAGE_SIZE}&offset=${(page - 1) * PAGE_SIZE}${statusFilter !== 'all' ? `&status=${statusFilter}` : ''}`
    ),
    refetchInterval: 5000,
  });

  const workflows = (data?.data ?? []).filter(wf =>
    !search || wf.taskTitle.toLowerCase().includes(search.toLowerCase()) || wf.repoUrl.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Workflows</h1>
          <p className="text-sm text-default-500 mt-1">
            {data?.total ?? 0} total workflows
            {isDemoMode() && <span className="ml-2 text-xs text-warning">(demo)</span>}
          </p>
        </div>
        <a
          href={`${import.meta.env.VITE_API_URL || '/api/v1'}/docs`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-default-600 border border-divider hover:bg-default-100 transition-colors"
        >
          <Plus size={14} />
          Create via API
        </a>
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
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
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
        <SkeletonTable rows={6} cols={5} />
      ) : error ? (
        <Card><Card.Content><p className="text-danger text-sm">Error: {(error as Error).message}</p></Card.Content></Card>
      ) : workflows.length === 0 ? (
        <Card>
          <Card.Content className="py-16">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-default-100">
                <GitBranch size={28} className="text-default-400" />
              </div>
              <h3 className="text-lg font-medium text-foreground">No workflows found</h3>
              <p className="mt-1 text-sm text-default-500 max-w-sm mx-auto">
                Workflows are created when triggered by webhooks or the API. Set up a webhook integration to get started.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <Link to="/app/webhooks" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors">
                  Configure Webhooks
                </Link>
                <Link to="/app/dsl" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-divider text-sm font-medium text-foreground hover:bg-default-100 transition-colors">
                  Create DSL
                </Link>
              </div>
            </div>
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
                  <th className="px-5 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {workflows.map((wf) => (
                  <tr key={wf.id} className="hover:bg-default-50 transition-colors group">
                    <td className="px-5 py-3.5">
                      <Link to="/app/workflows/$workflowId" params={{ workflowId: wf.id }} className="text-sm font-medium text-foreground truncate max-w-[300px] block hover:text-primary transition-colors">
                        {wf.taskTitle}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-sm text-default-500 truncate max-w-[200px]">{wf.repoUrl.replace('https://github.com/', '')}</p>
                      {wf.branchName && <p className="text-xs text-default-400 mt-0.5 font-mono">{wf.branchName}</p>}
                    </td>
                    <td className="px-5 py-3.5">
                      <Chip color={STATUS_COLOR[wf.status] ?? 'default'} variant="soft" size="sm">{wf.status.replace(/_/g, ' ')}</Chip>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-medium tabular-nums">${(wf.totalCostUsd ?? 0).toFixed(2)}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <RelativeTime date={wf.startedAt} className="text-xs text-default-400" />
                    </td>
                    <td className="px-5 py-3.5">
                      <Link to="/app/workflows/$workflowId" params={{ workflowId: wf.id }} className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <ExternalLink size={14} className="text-default-400" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </Card>
      )}
    </div>
  );
}
