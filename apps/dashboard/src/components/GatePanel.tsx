import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

interface Workflow {
  id: string;
  taskTitle: string;
  status: string;
  temporalWorkflowId: string;
  repoUrl: string;
  branchName: string;
}

export function GatePanel() {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ workflowId: string; action: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['gate-workflows'],
    queryFn: () => apiFetch<{ data: Workflow[] }>('/workflows?status=awaiting_gate'),
    refetchInterval: 5000,
  });

  const mutation = useMutation({
    mutationFn: ({ workflowId, action }: { workflowId: string; action: string }) =>
      apiFetch(`/gates/${workflowId}/${action === 'reject' ? 'request-changes' : 'approve'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewer: 'dashboard-user', comment }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gate-workflows'] });
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

  const workflows = data?.data ?? [];

  return (
    <div className="space-y-6">
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-2">Confirm Rejection</h3>
            <p className="text-sm text-gray-600 mb-4">Are you sure you want to reject this workflow?</p>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Reason for rejection"
              className="w-full px-3 py-2 border rounded-md text-sm mb-4"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmAction(null)} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-sm">Cancel</button>
              <button onClick={() => mutation.mutate(confirmAction)} className="px-3 py-1.5 bg-red-600 text-white rounded-md text-sm hover:bg-red-700" disabled={mutation.isPending}>Reject</button>
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
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Awaiting Gate</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment (optional)" className="flex-1 px-3 py-1.5 border rounded-md text-sm" />
                  <button onClick={() => handleAction(wf.temporalWorkflowId, 'approve')} className="px-3 py-1.5 bg-green-600 text-white rounded-md text-sm hover:bg-green-700" disabled={mutation.isPending}>Approve</button>
                  <button onClick={() => handleAction(wf.temporalWorkflowId, 'reject')} className="px-3 py-1.5 bg-red-600 text-white rounded-md text-sm hover:bg-red-700" disabled={mutation.isPending}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
