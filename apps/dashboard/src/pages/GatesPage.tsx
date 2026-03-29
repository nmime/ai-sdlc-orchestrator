import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Chip } from '@heroui/react';
import { apiFetch, mutationOptions, isDemoMode } from '../lib/api';
import { RelativeTime } from '../components/RelativeTime';
import { ShieldCheck, GitBranch, MessageSquare } from 'lucide-react';
import { SkeletonCard } from '../components/Skeleton';

interface Workflow {
  id: string;
  taskTitle: string;
  status: string;
  temporalWorkflowId: string;
  repoUrl: string;
  branchName: string;
  startedAt: string;
}

export function GatesPage() {
  const queryClient = useQueryClient();
  const [comments, setComments] = useState<Record<string, string>>({});
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
        body: JSON.stringify({ reviewer: 'dashboard-user', comment: comments[workflowId] || '' }),
      }),
    ...mutationOptions('Gate decision submitted'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gate-workflows'] });
      setComments({});
      setConfirmReject(null);
    },
  });

  const workflows = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gate Approvals</h1>
        <p className="text-sm text-default-500 mt-1">
          {workflows.length} pending approval{workflows.length !== 1 ? 's' : ''}
          {isDemoMode() && <span className="ml-2 text-xs text-warning">(demo)</span>}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : workflows.length === 0 ? (
        <Card>
          <Card.Content className="py-16">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
                <ShieldCheck size={28} className="text-success" />
              </div>
              <h3 className="text-lg font-medium text-foreground">All clear</h3>
              <p className="mt-1 text-sm text-default-500">No workflows are awaiting gate approval.</p>
            </div>
          </Card.Content>
        </Card>
      ) : (
        <div className="space-y-4">
          {workflows.map((wf) => (
            <Card key={wf.id}>
              <Card.Header>
                <div className="flex items-center justify-between w-full">
                  <div className="min-w-0">
                    <Card.Title className="truncate">{wf.taskTitle}</Card.Title>
                    <Card.Description className="flex items-center gap-2 mt-1">
                      <GitBranch size={12} />
                      <span className="truncate">{wf.repoUrl.replace('https://github.com/', '')}</span>
                      {wf.branchName && <code className="font-mono text-xs">{wf.branchName}</code>}
                    </Card.Description>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <RelativeTime date={wf.startedAt} className="text-xs text-default-400 hidden md:block" />
                    <Chip color="warning" variant="soft" size="sm">Awaiting Gate</Chip>
                  </div>
                </div>
              </Card.Header>
              <Card.Content>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <MessageSquare size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-default-400" />
                    <input
                      type="text"
                      value={comments[wf.temporalWorkflowId] ?? ''}
                      onChange={(e) => setComments(prev => ({ ...prev, [wf.temporalWorkflowId]: e.target.value }))}
                      placeholder="Review comment (optional)"
                      className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-divider bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-default-400"
                    />
                  </div>
                  <Button variant="primary" size="sm" onPress={() => mutation.mutate({ workflowId: wf.temporalWorkflowId, action: 'approve' })} isDisabled={mutation.isPending}>
                    Approve
                  </Button>
                  {confirmReject === wf.temporalWorkflowId ? (
                    <>
                      <Button variant="danger" size="sm" onPress={() => mutation.mutate({ workflowId: wf.temporalWorkflowId, action: 'reject' })} isDisabled={mutation.isPending}>Confirm Reject</Button>
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
