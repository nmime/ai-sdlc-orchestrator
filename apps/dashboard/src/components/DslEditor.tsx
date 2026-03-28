import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, Button, Chip, Spinner } from '@heroui/react';
import { apiFetch } from '../lib/api';

interface DslRecord {
  id: string;
  name: string;
  version: number;
  definition: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
}

interface Workflow {
  id: string;
  taskTitle: string;
  status: string;
}

const DEFAULT_DSL = `name: my-workflow
version: "1.0"
steps:
  - id: implement
    agent: coder
    prompt: "Implement the feature"
    maxTokens: 4000
  - id: review
    agent: reviewer
    prompt: "Review the implementation"
    dependsOn:
      - implement
  - id: gate
    type: approval
    approvers:
      - team-lead
    dependsOn:
      - review
`;

export function DslEditor() {
  const [yaml, setYaml] = useState(DEFAULT_DSL);
  const [dslName, setDslName] = useState('my-workflow');
  const tenantId = localStorage.getItem('tenant_id') || '00000000-0000-0000-0000-000000000001';

  const { data: dslList, refetch: refetchDsl } = useQuery({
    queryKey: ['dsl-list', tenantId],
    queryFn: () => apiFetch<DslRecord[]>(`/tenants/${tenantId}/dsl`),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch<DslRecord>(`/tenants/${tenantId}/dsl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: dslName, definition: { raw: yaml } }),
      }),
    onSuccess: () => refetchDsl(),
  });

  const validateMutation = useMutation({
    mutationFn: (dsl: string) =>
      apiFetch<{ valid: boolean; errors: string[] }>(`/tenants/${tenantId}/dsl/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml: dsl }),
      }).catch(() => ({ valid: false, errors: ['Server validation unavailable'] })),
  });

  const { data: workflows } = useQuery({
    queryKey: ['recent-workflows'],
    queryFn: () => apiFetch<{ data: Workflow[] }>('/workflows?limit=10'),
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">DSL Editor</h2>
        <p className="text-sm text-default-500">Define and validate workflow definitions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <Card.Header>
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3 flex-1 mr-4">
                  <input
                    type="text"
                    value={dslName}
                    onChange={(e) => setDslName(e.target.value)}
                    placeholder="DSL name"
                    className="bg-default-100 rounded-lg px-3 py-1.5 text-sm text-foreground border-0 outline-none focus:ring-2 focus:ring-primary w-48"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onPress={() => validateMutation.mutate(yaml)} isDisabled={validateMutation.isPending}>
                    {validateMutation.isPending ? 'Validating...' : 'Validate'}
                  </Button>
                  <Button variant="primary" size="sm" onPress={() => saveMutation.mutate()} isDisabled={saveMutation.isPending}>
                    {saveMutation.isPending ? 'Saving...' : 'Save DSL'}
                  </Button>
                </div>
              </div>
            </Card.Header>
            <Card.Content>
              <textarea
                value={yaml}
                onChange={(e) => setYaml(e.target.value)}
                className="w-full h-[420px] font-mono text-sm p-4 bg-[#1e1e2e] text-[#cdd6f4] rounded-xl border-0 resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                spellCheck={false}
              />
            </Card.Content>
          </Card>

          {validateMutation.data && (
            <Card variant={validateMutation.data.valid ? undefined : undefined}>
              <Card.Content>
                {validateMutation.data.valid ? (
                  <div className="flex items-center gap-2">
                    <Chip color="success" variant="soft" size="sm">Valid</Chip>
                    <span className="text-sm text-success">DSL definition is valid</span>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Chip color="danger" variant="soft" size="sm">Invalid</Chip>
                      <span className="text-sm font-medium text-danger">Validation errors</span>
                    </div>
                    <ul className="text-sm text-danger space-y-1 list-disc list-inside">
                      {validateMutation.data.errors?.map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                  </div>
                )}
              </Card.Content>
            </Card>
          )}

          {saveMutation.isSuccess && (
            <Card><Card.Content><div className="flex items-center gap-2"><Chip color="success" variant="soft" size="sm">Saved</Chip><span className="text-sm text-success">DSL saved successfully</span></div></Card.Content></Card>
          )}
          {saveMutation.isError && (
            <Card><Card.Content><p className="text-sm text-danger">Failed to save: {(saveMutation.error as Error).message}</p></Card.Content></Card>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card>
            <Card.Header>
              <Card.Title className="text-sm">Saved DSLs</Card.Title>
            </Card.Header>
            {dslList && dslList.length > 0 ? (
              <div className="divide-y divide-divider">
                {dslList.map((d) => (
                  <div key={d.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{d.name} <span className="text-default-400">v{d.version}</span></p>
                      <p className="text-xs text-default-400">{new Date(d.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Chip color={d.isActive ? 'success' : 'default'} variant="soft" size="sm">{d.isActive ? 'Active' : 'Inactive'}</Chip>
                      <Button variant="ghost" size="sm" onPress={() => { setYaml(JSON.stringify(d.definition, null, 2)); setDslName(d.name); }}>Load</Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Card.Content><p className="text-sm text-default-400 text-center py-4">No DSLs saved yet</p></Card.Content>
            )}
          </Card>

          <Card>
            <Card.Header>
              <Card.Title className="text-sm">Recent Workflows</Card.Title>
            </Card.Header>
            {workflows?.data && workflows.data.length > 0 ? (
              <div className="divide-y divide-divider">
                {workflows.data.map((wf) => (
                  <div key={wf.id} className="px-5 py-3 flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground truncate">{wf.taskTitle || wf.id.slice(0, 8)}</p>
                    <Chip color={wf.status === 'completed' ? 'success' : wf.status === 'failed' ? 'danger' : wf.status === 'running' ? 'accent' : 'default'} variant="soft" size="sm">{wf.status}</Chip>
                  </div>
                ))}
              </div>
            ) : (
              <Card.Content><p className="text-sm text-default-400 text-center py-4">No workflows yet</p></Card.Content>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
