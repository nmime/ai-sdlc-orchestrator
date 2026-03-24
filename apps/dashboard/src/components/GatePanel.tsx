import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Workflow {
  id: string;
  taskTitle: string;
  status: string;
  temporalWorkflowId: string;
}

async function fetchGateWorkflows(): Promise<{ items: Workflow[] }> {
  const res = await fetch('/api/workflows?status=awaiting_gate');
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

async function submitDecision(workflowId: string, action: string, reviewer: string, comment: string) {
  const res = await fetch(`/api/gates/${workflowId}/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, reviewer, comment }),
  });
  if (!res.ok) throw new Error('Failed to submit decision');
  return res.json();
}

export function GatePanel() {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['gate-workflows'],
    queryFn: fetchGateWorkflows,
    refetchInterval: 5000,
  });

  const mutation = useMutation({
    mutationFn: ({ workflowId, action }: { workflowId: string; action: string }) =>
      submitDecision(workflowId, action, 'dashboard-user', comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gate-workflows'] });
      setComment('');
    },
  });

  if (isLoading) return <div className="text-center py-8">Loading gate requests...</div>;

  const workflows = data?.items ?? [];

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-4 py-3 border-b">
        <h2 className="text-lg font-semibold">Gate Approvals ({workflows.length})</h2>
      </div>
      {workflows.length === 0 ? (
        <div className="px-4 py-8 text-center text-gray-500">No workflows awaiting approval</div>
      ) : (
        <div className="divide-y">
          {workflows.map((wf) => (
            <div key={wf.id} className="px-4 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{wf.taskTitle}</p>
                  <p className="text-xs text-gray-400">{wf.temporalWorkflowId}</p>
                </div>
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                  Awaiting Gate
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Comment (optional)"
                  className="flex-1 px-3 py-1.5 border rounded-md text-sm"
                />
                <button
                  onClick={() => mutation.mutate({ workflowId: wf.temporalWorkflowId, action: 'approve' })}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
                  disabled={mutation.isPending}
                >
                  Approve
                </button>
                <button
                  onClick={() => mutation.mutate({ workflowId: wf.temporalWorkflowId, action: 'reject' })}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
                  disabled={mutation.isPending}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
