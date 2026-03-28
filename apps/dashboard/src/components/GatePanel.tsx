import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Chip, Spinner, EmptyState } from '@heroui/react';
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
  const [confirmReject, setConfirmReject] = useState<string | null>(null);

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
      setConfirmReject(null);
    },
  });

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;

  const workflows = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Gate Approvals</h2>
        <p className="text-sm text-default-500">{workflows.length} pending approval{workflows.length !== 1 ? 's' : ''}</p>
      </div>

      {workflows.length === 0 ? (
        <Card>
          <Card.Content className="py-16">
            <EmptyState>
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-success"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <h3 className="text-base font-medium text-foreground">All clear</h3>
                <p className="mt-1 text-sm text-default-500">No workflows are awaiting gate approval.</p>
              </div>
            </EmptyState>
          </Card.Content>
        </Card>
      ) : (
        <div className="grid gap-4">
          {workflows.map((wf) => (
            <Card key={wf.id}>
              <Card.Header>
                <div className="flex items-center justify-between w-full">
                  <div>
                    <Card.Title>{wf.taskTitle}</Card.Title>
                    <Card.Description>{wf.repoUrl}{wf.branchName ? ` / ${wf.branchName}` : ''}</Card.Description>
                  </div>
                  <Chip color="warning" variant="soft" size="sm">Awaiting Gate</Chip>
                </div>
              </Card.Header>
              <Card.Content>
                <p className="text-xs text-default-400 font-mono mb-3">{wf.temporalWorkflowId}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Comment (optional)"
                    className="flex-1 bg-default-100 rounded-lg px-3 py-2 text-sm text-foreground border-0 outline-none focus:ring-2 focus:ring-primary placeholder:text-default-400"
                  />
                  <Button variant="primary" size="sm" onPress={() => mutation.mutate({ workflowId: wf.temporalWorkflowId, action: 'approve' })} isDisabled={mutation.isPending}>Approve</Button>
                  {confirmReject === wf.temporalWorkflowId ? (
                    <>
                      <Button variant="danger" size="sm" onPress={() => mutation.mutate({ workflowId: wf.temporalWorkflowId, action: 'reject' })} isDisabled={mutation.isPending}>Confirm Reject</Button>
                      <Button variant="ghost" size="sm" onPress={() => setConfirmReject(null)}>Cancel</Button>
                    </>
                  ) : (
                    <Button variant="danger" size="sm" onPress={() => setConfirmReject(wf.temporalWorkflowId)} isDisabled={mutation.isPending}>Reject</Button>
                  )}
                </div>
              </Card.Content>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
