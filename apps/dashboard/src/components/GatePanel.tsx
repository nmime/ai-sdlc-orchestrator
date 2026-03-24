import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Workflow {
  id: string;
  taskTitle: string;
  status: string;
  temporalWorkflowId: string;
  repoUrl: string;
  branchName: string;
}

interface GateDecision {
  id: string;
  workflowId: string;
  action: string;
  reviewer: string;
  comment: string;
  decidedAt: string;
}

async function fetchGateWorkflows(): Promise<{ items: Workflow[] }> {
  const res = await fetch('/api/workflows?status=awaiting_gate');
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

async function fetchGateHistory(): Promise<GateDecision[]> {
  const res = await fetch('/api/gates/history?limit=20');
  if (!res.ok) throw new Error('Failed to fetch history');
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
  const [confirmAction, setConfirmAction] = useState<{ workflowId: string; action: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['gate-workflows'],
    queryFn: fetchGateWorkflows,
    refetchInterval: 5000,
  });

  const { data: history } = useQuery({
    queryKey: ['gate-history'],
    queryFn: fetchGateHistory,
  });

  const mutation = useMutation({
    mutationFn: ({ workflowId, action }: { workflowId: string; action: string }) =>
      submitDecision(workflowId, action, 'dashboard-user', comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gate-workflows'] });
      queryClient.invalidateQueries({ queryKey: ['gate-history'] });
      setComment('');
      setConfirmAction(null);
    },
  });

  const handleAction = (workflowId: string, action: string) => {
    if (action === 'reject') {
      setConfirmAction({ workflowId, action });
    } else {
      mutation.mutate({ workflowId, action });
    }
  };

  if (isLoading) return <div className="text-center py-8">Loading gate requests...</div>;

  const workflows = data?.items ?? [];

  return (
    <div className="space-y-6">
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-2">Confirm Rejection</h3>
            <p className="text-sm text-gray-600 mb-4">Are you sure you want to reject this workflow? This action cannot be undone.</p>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Reason for rejection"
              className="w-full px-3 py-2 border rounded-md text-sm mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => mutation.mutate(confirmAction)}
                className="px-3 py-1.5 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
                disabled={mutation.isPending}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

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
                    {wf.repoUrl && <p className="text-xs text-gray-500">{wf.repoUrl} / {wf.branchName}</p>}
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
                    onClick={() => handleAction(wf.temporalWorkflowId, 'approve')}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
                    disabled={mutation.isPending}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleAction(wf.temporalWorkflowId, 'reject')}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
                    disabled={mutation.isPending}
                  >
                    Reject
                  </button>
                </div>
                {mutation.isError && (
                  <p className="text-xs text-red-600">Failed to submit decision</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {history && history.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-semibold">Approval History</h3>
          </div>
          <div className="divide-y">
            {history.map((decision) => (
              <div key={decision.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm">
                    <span className="font-medium">{decision.reviewer}</span>
                    {' '}
                    <span className={decision.action === 'approve' ? 'text-green-600' : 'text-red-600'}>
                      {decision.action}d
                    </span>
                    {' '}
                    <span className="text-gray-500">workflow {decision.workflowId.slice(0, 8)}</span>
                  </p>
                  {decision.comment && <p className="text-xs text-gray-500">{decision.comment}</p>}
                </div>
                <span className="text-xs text-gray-400">{new Date(decision.decidedAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
