import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Chip, Spinner, EmptyState } from '@heroui/react';
import { apiFetch } from '../lib/api';
import { ShieldCheck } from 'lucide-react';

interface Workflow {
  id: string;
  taskTitle: string;
  status: string;
  temporalWorkflowId: string;
  repoUrl: string;
  branchName: string;
}

export function GatesPage() {
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

  const workflows = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gate Approvals</h1>
        <p className="text-sm text-default-500 mt-1">{workflows.length} pending approval{workflows.length !== 1 ? 's' : ''}</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : workflows.length === 0 ? (
        <Card>
          <Card.Content className="py-16">
            <EmptyState>
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                  <ShieldCheck size={24} className="text-success" />
                </div>
                <h3 className="text-base font-medium text-foreground">All clear</h3>
                <p className="mt-1 text-sm text-default-500">No workflows are awaiting gate approval.</p>
              </div>
            </EmptyState>
          </Card.Content>
        </Card>
      ) : (
        <div className="space-y-4">
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
                <p className="text-xs text-default-400 font-mono mb-4">{wf.temporalWorkflowId}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Review comment (optional)"
                    className="flex-1 px-3 py-2 rounded-lg border border-divider bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-default-400"
                  />
                  <Button variant="primary" size="sm" onPress={() => mutation.mutate({ workflowId: wf.temporalWorkflowId, action: 'approve' })} isDisabled={mutation.isPending}>Approve</Button>
                  {confirmReject === wf.temporalWorkflowId ? (
                    <>
                      <Button variant="danger" size="sm" onPress={() => mutation.mutate({ workflowId: wf.temporalWorkflowId, action: 'reject' })} isDisabled={mutation.isPending}>Confirm</Button>
                      <Button variant="ghost" size="sm" onPress={() => setConfirmReject(null)}>Cancel</Button>
                    </>
                  ) : (
                    <Button variant="outline" size="sm" onPress={() => setConfirmReject(wf.temporalWorkflowId)}>Reject</Button>
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
