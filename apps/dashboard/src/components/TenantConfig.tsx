import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Chip, Spinner, TextField, Label, Input, Description } from '@heroui/react';
import { apiFetch } from '../lib/api';

interface TenantData {
  id: string;
  slug: string;
  name: string;
  status: string;
  maxConcurrentWorkflows: number;
  maxConcurrentSandboxes: number;
  monthlyCostLimitUsd: number;
  monthlyCostActualUsd: number;
  monthlyAiCostActualUsd: number;
  monthlySandboxCostActualUsd: number;
  defaultAgentProvider?: string;
  defaultAgentModel?: string;
  mcpServerPolicy: string;
  costAlertThresholds?: number[];
  sandboxHourlyRateUsd: number;
  createdAt: string;
  updatedAt: string;
}

function TenantCard({ tenant, onSave }: { tenant: TenantData; onSave: (id: string, patch: Partial<TenantData>) => void }) {
  const [editing, setEditing] = useState(false);
  const [costLimit, setCostLimit] = useState(String(tenant.monthlyCostLimitUsd));
  const [maxConcurrent, setMaxConcurrent] = useState(String(tenant.maxConcurrentWorkflows));
  const [maxSandboxes, setMaxSandboxes] = useState(String(tenant.maxConcurrentSandboxes));

  const handleSave = () => {
    onSave(tenant.id, {
      monthlyCostLimitUsd: parseFloat(costLimit),
      maxConcurrentWorkflows: parseInt(maxConcurrent, 10),
      maxConcurrentSandboxes: parseInt(maxSandboxes, 10),
    } as Partial<TenantData>);
    setEditing(false);
  };

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center justify-between w-full">
          <div>
            <Card.Title>{tenant.name}</Card.Title>
            <Card.Description className="flex items-center gap-2 mt-1">
              <span className="font-mono text-xs">{tenant.slug}</span>
              <Chip color={tenant.status === 'active' ? 'success' : 'default'} variant="soft" size="sm">{tenant.status}</Chip>
            </Card.Description>
          </div>
          <Button variant={editing ? 'primary' : 'secondary'} size="sm" onPress={() => editing ? handleSave() : setEditing(true)}>
            {editing ? 'Save Changes' : 'Edit'}
          </Button>
        </div>
      </Card.Header>
      <Card.Content>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {editing ? (
            <>
              <TextField value={costLimit} onChange={setCostLimit}>
                <Label>Monthly Cost Limit (USD)</Label>
                <Input />
              </TextField>
              <TextField value={maxConcurrent} onChange={setMaxConcurrent}>
                <Label>Max Concurrent Workflows</Label>
                <Input />
              </TextField>
              <TextField value={maxSandboxes} onChange={setMaxSandboxes}>
                <Label>Max Concurrent Sandboxes</Label>
                <Input />
              </TextField>
            </>
          ) : (
            <>
              <InfoField label="Monthly Cost Limit" value={`$${Number(tenant.monthlyCostLimitUsd).toFixed(0)}`} />
              <InfoField label="Actual Cost (Month)" value={`$${Number(tenant.monthlyCostActualUsd).toFixed(2)}`} />
              <InfoField label="AI Cost (Month)" value={`$${Number(tenant.monthlyAiCostActualUsd).toFixed(2)}`} />
              <InfoField label="Sandbox Cost (Month)" value={`$${Number(tenant.monthlySandboxCostActualUsd).toFixed(2)}`} />
              <InfoField label="Max Concurrent Workflows" value={String(tenant.maxConcurrentWorkflows)} />
              <InfoField label="Max Concurrent Sandboxes" value={String(tenant.maxConcurrentSandboxes)} />
              <InfoField label="MCP Server Policy" value={tenant.mcpServerPolicy} />
              <InfoField label="Default Agent" value={tenant.defaultAgentProvider ? `${tenant.defaultAgentProvider}/${tenant.defaultAgentModel}` : 'Not set'} />
              <InfoField label="Sandbox Rate" value={`$${Number(tenant.sandboxHourlyRateUsd).toFixed(2)}/hr`} />
              <InfoField label="Cost Alerts" value={tenant.costAlertThresholds?.map(t => `${t}%`).join(', ') || 'None'} />
              <InfoField label="Created" value={new Date(tenant.createdAt).toLocaleDateString()} />
              <InfoField label="Updated" value={new Date(tenant.updatedAt).toLocaleDateString()} />
            </>
          )}
        </div>
      </Card.Content>
    </Card>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-default-50 rounded-lg px-3 py-2.5">
      <p className="text-[10px] text-default-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

export function TenantConfig() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => apiFetch<TenantData[]>('/tenants'),
  });

  const mutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<TenantData> }) =>
      apiFetch(`/tenants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenants'] }),
  });

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (error) return <Card><Card.Content><p className="text-danger text-sm">Error: {(error as Error).message}</p></Card.Content></Card>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Tenant Configuration</h2>
        <p className="text-sm text-default-500">{data?.length ?? 0} tenant{(data?.length ?? 0) !== 1 ? 's' : ''} configured</p>
      </div>
      {mutation.isError && (
        <div className="bg-danger-50 border border-danger-200 rounded-lg p-3">
          <p className="text-sm text-danger">Failed to update tenant configuration</p>
        </div>
      )}
      {data && data.length > 0 ? data.map((tenant) => (
        <TenantCard key={tenant.id} tenant={tenant} onSave={(id, patch) => mutation.mutate({ id, patch })} />
      )) : (
        <Card><Card.Content className="py-12 text-center text-default-400">No tenants configured</Card.Content></Card>
      )}
    </div>
  );
}
