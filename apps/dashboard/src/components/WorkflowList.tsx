import { useQuery } from '@tanstack/react-query';

interface Workflow {
  id: string;
  taskTitle: string;
  status: string;
  repoUrl: string;
  totalCostUsd: number;
  startedAt: string;
  completedAt?: string;
}

async function fetchWorkflows(): Promise<{ items: Workflow[]; total: number }> {
  const res = await fetch('/api/workflows');
  if (!res.ok) throw new Error('Failed to fetch workflows');
  return res.json();
}

const statusColors: Record<string, string> = {
  queued: 'bg-gray-100 text-gray-700',
  running: 'bg-blue-100 text-blue-700',
  awaiting_gate: 'bg-yellow-100 text-yellow-700',
  awaiting_ci: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export function WorkflowList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['workflows'],
    queryFn: fetchWorkflows,
    refetchInterval: 5000,
  });

  if (isLoading) return <div className="text-center py-8">Loading workflows...</div>;
  if (error) return <div className="text-center py-8 text-red-600">Error loading workflows</div>;

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-4 py-3 border-b">
        <h2 className="text-lg font-semibold">Workflows ({data?.total ?? 0})</h2>
      </div>
      <div className="divide-y">
        {data?.items.map((wf) => (
          <div key={wf.id} className="px-4 py-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{wf.taskTitle}</p>
              <p className="text-sm text-gray-500">{wf.repoUrl}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[wf.status] || 'bg-gray-100'}`}>
                {wf.status}
              </span>
              <span className="text-sm text-gray-600">${wf.totalCostUsd.toFixed(2)}</span>
              <span className="text-xs text-gray-400">{new Date(wf.startedAt).toLocaleString()}</span>
            </div>
          </div>
        )) ?? <div className="px-4 py-8 text-center text-gray-500">No workflows yet</div>}
      </div>
    </div>
  );
}
