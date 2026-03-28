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
  monthlyAiCostLimitUsd?: number;
  monthlySandboxCostLimitUsd?: number;
  defaultAgentProvider?: string;
  defaultAgentModel?: string;
  mcpServerPolicy: string;
  costAlertThresholds?: number[];
  sandboxHourlyRateUsd: number;
  agentMaxTurns?: number;
  agentMaxDurationMs?: number;
  sandboxTimeoutMs?: number;
  aiInputCostPer1m?: number;
  aiOutputCostPer1m?: number;
  budgetReservationUsd?: number;
  sanitizerMode?: string;
  rateLimitMax?: number;
  rateLimitWindow?: string;
  webhookMaxRetries?: number;
  createdAt: string;
  updatedAt: string;
}

const EDITABLE_FIELDS: { key: keyof TenantData; label: string; type: 'number' | 'string' }[] = [
  { key: 'monthlyCostLimitUsd', label: 'Monthly Cost Limit (USD)', type: 'number' },
  { key: 'monthlyAiCostLimitUsd', label: 'Monthly AI Cost Limit (USD)', type: 'number' },
  { key: 'monthlySandboxCostLimitUsd', label: 'Monthly Sandbox Limit (USD)', type: 'number' },
  { key: 'maxConcurrentWorkflows', label: 'Max Concurrent Workflows', type: 'number' },
  { key: 'maxConcurrentSandboxes', label: 'Max Concurrent Sandboxes', type: 'number' },
  { key: 'defaultAgentProvider', label: 'Default Agent Provider', type: 'string' },
  { key: 'defaultAgentModel', label: 'Default Agent Model', type: 'string' },
  { key: 'agentMaxTurns', label: 'Agent Max Turns', type: 'number' },
  { key: 'agentMaxDurationMs', label: 'Agent Max Duration (ms)', type: 'number' },
  { key: 'sandboxTimeoutMs', label: 'Sandbox Timeout (ms)', type: 'number' },
  { key: 'sandboxHourlyRateUsd', label: 'Sandbox Hourly Rate (USD)', type: 'number' },
  { key: 'aiInputCostPer1m', label: 'AI Input Cost per 1M tokens', type: 'number' },
  { key: 'aiOutputCostPer1m', label: 'AI Output Cost per 1M tokens', type: 'number' },
  { key: 'budgetReservationUsd', label: 'Budget Reservation (USD)', type: 'number' },
  { key: 'sanitizerMode', label: 'Sanitizer Mode (block/warn/off)', type: 'string' },
  { key: 'rateLimitMax', label: 'Rate Limit Max', type: 'number' },
  { key: 'rateLimitWindow', label: 'Rate Limit Window', type: 'string' },
  { key: 'webhookMaxRetries', label: 'Webhook Max Retries', type: 'number' },
];

function TenantCard({ tenant, onSave }: { tenant: TenantData; onSave: (id: string, patch: Record<string, unknown>) => void }) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  const startEdit = () => {
    const v: Record<string, string> = {};
    EDITABLE_FIELDS.forEach(f => { v[f.key] = String(tenant[f.key] ?? ''); });
    setValues(v);
    setEditing(true);
  };

  const handleSave = () => {
    const patch: Record<string, unknown> = {};
    EDITABLE_FIELDS.forEach(f => {
      const raw = values[f.key];
      if (raw === '' || raw === undefined) return;
      patch[f.key] = f.type === 'number' ? parseFloat(raw) : raw;
    });
    onSave(tenant.id, patch);
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
          <div className="flex gap-2">
            {editing && <Button variant="outline" size="sm" onPress={() => setEditing(false)}>Cancel</Button>}
            <Button variant={editing ? 'primary' : 'secondary'} size="sm" onPress={() => editing ? handleSave() : startEdit()}>
              {editing ? 'Save Changes' : 'Edit'}
            </Button>
          </div>
        </div>
      </Card.Header>
      <Card.Content>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {editing ? (
            EDITABLE_FIELDS.map(f => (
              <TextField key={f.key} value={values[f.key] ?? ''} onChange={v => setValues(prev => ({ ...prev, [f.key]: v }))}>
                <Label>{f.label}</Label>
                <Input />
              </TextField>
            ))
          ) : (
            <>
              <InfoField label="Monthly Cost Limit" value={`$${Number(tenant.monthlyCostLimitUsd).toFixed(0)}`} />
              <InfoField label="Actual Cost (Month)" value={`$${Number(tenant.monthlyCostActualUsd).toFixed(2)}`} />
              <InfoField label="AI Cost (Month)" value={`$${Number(tenant.monthlyAiCostActualUsd).toFixed(2)}`} />
              <InfoField label="Sandbox Cost (Month)" value={`$${Number(tenant.monthlySandboxCostActualUsd).toFixed(2)}`} />
              <InfoField label="Max Workflows" value={String(tenant.maxConcurrentWorkflows)} />
              <InfoField label="Max Sandboxes" value={String(tenant.maxConcurrentSandboxes)} />
              <InfoField label="Default Agent" value={tenant.defaultAgentProvider ? `${tenant.defaultAgentProvider}/${tenant.defaultAgentModel || '*'}` : 'auto'} />
              <InfoField label="Agent Max Turns" value={tenant.agentMaxTurns != null ? String(tenant.agentMaxTurns) : 'System default'} />
              <InfoField label="Agent Max Duration" value={tenant.agentMaxDurationMs != null ? `${(tenant.agentMaxDurationMs / 60000).toFixed(0)}min` : 'System default'} />
              <InfoField label="Sandbox Timeout" value={tenant.sandboxTimeoutMs != null ? `${(tenant.sandboxTimeoutMs / 60000).toFixed(0)}min` : 'System default'} />
              <InfoField label="Sandbox Rate" value={`$${Number(tenant.sandboxHourlyRateUsd).toFixed(2)}/hr`} />
              <InfoField label="AI Input Cost/1M" value={tenant.aiInputCostPer1m != null ? `$${tenant.aiInputCostPer1m}` : 'System default'} />
              <InfoField label="AI Output Cost/1M" value={tenant.aiOutputCostPer1m != null ? `$${tenant.aiOutputCostPer1m}` : 'System default'} />
              <InfoField label="Budget Reservation" value={tenant.budgetReservationUsd != null ? `$${tenant.budgetReservationUsd}` : 'System default'} />
              <InfoField label="Sanitizer" value={tenant.sanitizerMode || 'System default'} />
              <InfoField label="MCP Policy" value={tenant.mcpServerPolicy} />
              <InfoField label="Rate Limit" value={tenant.rateLimitMax ? `${tenant.rateLimitMax}/${tenant.rateLimitWindow || '1 minute'}` : 'System default'} />
              <InfoField label="Webhook Retries" value={tenant.webhookMaxRetries != null ? String(tenant.webhookMaxRetries) : 'System default'} />
              <InfoField label="Cost Alerts" value={tenant.costAlertThresholds?.map(t => `${t}%`).join(', ') || 'None'} />
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
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
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
        <p className="text-sm text-default-500">{data?.length ?? 0} tenant{(data?.length ?? 0) !== 1 ? 's' : ''} configured — all fields are UI-editable</p>
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
